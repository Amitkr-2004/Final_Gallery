/**
 * Face Scanner Service
 * Scans faces from images and matches them against collections in GCS
 */

const faceapi = require('face-api.js');
const canvas = require('canvas');
const { getDatabase } = require('../database/schema');
const gcsUpload = require('./gcs-upload');

let logger = null;

/**
 * Calculate Euclidean distance between two embeddings
 */
function euclideanDistance(embedding1, embedding2) {
  if (embedding1.length !== embedding2.length) {
    throw new Error('Embeddings must have the same length');
  }

  let sum = 0;
  for (let i = 0; i < embedding1.length; i++) {
    const diff = embedding1[i] - embedding2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

/**
 * Scan a face from an image and generate embedding
 * @param {string} imagePath - Path to the image file
 * @returns {Promise<Object>} Scan result with face detection and embedding
 */
async function scanFace(imagePath) {
  try {
    logger.info('Scanning face from image', { imagePath });

    // Load image
    const img = await canvas.loadImage(imagePath);

    // Detect face with landmarks and descriptor
    const detection = await faceapi
      .detectSingleFace(img)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      return {
        success: false,
        error: 'No face detected in the image'
      };
    }

    const embedding = Array.from(detection.descriptor);
    const boundingBox = detection.detection.box;

    logger.info('Face detected and embedding generated', {
      confidence: detection.detection.score,
      embeddingLength: embedding.length
    });

    return {
      success: true,
      face: {
        embedding,
        confidence: detection.detection.score,
        boundingBox: {
          x: boundingBox.x,
          y: boundingBox.y,
          width: boundingBox.width,
          height: boundingBox.height
        },
        landmarks: detection.landmarks.positions.map(p => ({ x: p.x, y: p.y }))
      }
    };
  } catch (error) {
    logger.error('Failed to scan face', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Compare an embedding against a collection's representative faces
 * @param {Array<number>} queryEmbedding - The embedding to search for
 * @param {Object} collection - Collection metadata with faces
 * @param {number} threshold - Maximum distance for a match (default: 0.6)
 * @returns {Object} Match result with similarity score
 */
function compareWithCollection(queryEmbedding, collection, threshold = 0.6) {
  let bestMatch = null;
  let minDistance = Infinity;

  // Compare against all faces in the collection
  for (const face of collection.faces) {
    if (!face.embedding_vector) continue;

    const distance = euclideanDistance(queryEmbedding, face.embedding_vector);

    if (distance < minDistance) {
      minDistance = distance;
      bestMatch = {
        face_id: face.face_id,
        image_id: face.image_id,
        distance,
        similarity: 1 - distance, // Convert distance to similarity score
        confidence: face.confidence,
        is_representative: face.is_representative
      };
    }
  }

  if (!bestMatch || minDistance > threshold) {
    return null;
  }

  return bestMatch;
}

/**
 * Search for matching collections in GCS
 * @param {Array<number>} embedding - The face embedding to search for
 * @param {number} threshold - Maximum distance for a match (default: 0.6)
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Search results with matching collections
 */
async function searchCollections(embedding, threshold = 0.6, limit = 10) {
  try {
    logger.info('Searching collections for face match', { threshold, limit });

    // Get all collections from GCS
    const collectionsResult = await gcsUpload.listCollectionsFromGCS();

    if (!collectionsResult.success) {
      return {
        success: false,
        error: 'Failed to list collections from GCS'
      };
    }

    const matches = [];

    // Process each collection
    for (const collectionFile of collectionsResult.collections) {
      const collectionId = collectionFile.name.replace('collections/', '').replace('.json', '');

      // Fetch collection metadata
      const collectionResult = await gcsUpload.fetchCollectionFromGCS(collectionId);

      if (!collectionResult.success) {
        logger.warn('Failed to fetch collection', { collectionId });
        continue;
      }

      const collection = collectionResult.collection;

      // Compare against this collection
      const match = compareWithCollection(embedding, collection, threshold);

      if (match) {
        matches.push({
          collection_id: collectionId,
          collection_name: collection.name,
          total_faces: collection.total_faces,
          image_ids: collection.image_ids,
          match: {
            ...match,
            matched_at: new Date().toISOString()
          }
        });
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.match.similarity - a.match.similarity);

    // Limit results
    const limitedMatches = matches.slice(0, limit);

    logger.info('Face search completed', {
      totalCollectionsScanned: collectionsResult.collections.length,
      matchesFound: matches.length,
      returningTop: limitedMatches.length
    });

    return {
      success: true,
      matches: limitedMatches,
      stats: {
        total_collections_scanned: collectionsResult.collections.length,
        total_matches_found: matches.length,
        threshold_used: threshold
      }
    };
  } catch (error) {
    logger.error('Failed to search collections', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Search for matching collections using local database (faster)
 * @param {Array<number>} embedding - The face embedding to search for
 * @param {number} threshold - Maximum distance for a match (default: 0.6)
 * @param {number} limit - Maximum number of results to return
 * @returns {Promise<Object>} Search results with matching collections
 */
async function searchCollectionsLocal(embedding, threshold = 0.6, limit = 10) {
  try {
    logger.info('Searching collections locally for face match', { threshold, limit });

    const db = getDatabase();
    const matches = [];

    // Get all collections
    const collections = db.prepare(`
      SELECT * FROM face_collections
      ORDER BY total_faces DESC
    `).all();

    for (const collection of collections) {
      // Get representative faces for this collection
      const faces = db.prepare(`
        SELECT
          f.*,
          fcm.similarity_score,
          fcm.is_representative
        FROM face_collection_members fcm
        JOIN faces f ON fcm.face_id = f.face_id
        WHERE fcm.collection_id = ?
        ORDER BY fcm.is_representative DESC, fcm.similarity_score DESC
        LIMIT 5
      `).all(collection.collection_id);

      let bestMatch = null;
      let minDistance = Infinity;

      // Compare against faces
      for (const face of faces) {
        if (!face.embedding_vector) continue;

        const faceEmbedding = JSON.parse(face.embedding_vector);
        const distance = euclideanDistance(embedding, faceEmbedding);

        if (distance < minDistance) {
          minDistance = distance;
          bestMatch = {
            face_id: face.face_id,
            image_id: face.image_id,
            distance,
            similarity: 1 - distance,
            confidence: face.confidence,
            is_representative: face.is_representative === 1
          };
        }
      }

      if (bestMatch && minDistance <= threshold) {
        matches.push({
          collection_id: collection.collection_id,
          collection_name: collection.name,
          total_faces: collection.total_faces,
          created_at: collection.created_at,
          match: {
            ...bestMatch,
            matched_at: new Date().toISOString()
          }
        });
      }
    }

    // Sort by similarity (highest first)
    matches.sort((a, b) => b.match.similarity - a.match.similarity);

    // Limit results
    const limitedMatches = matches.slice(0, limit);

    logger.info('Local face search completed', {
      totalCollectionsScanned: collections.length,
      matchesFound: matches.length,
      returningTop: limitedMatches.length
    });

    return {
      success: true,
      matches: limitedMatches,
      stats: {
        total_collections_scanned: collections.length,
        total_matches_found: matches.length,
        threshold_used: threshold,
        search_mode: 'local'
      }
    };
  } catch (error) {
    logger.error('Failed to search collections locally', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Full workflow: Scan face and find matching collections
 * @param {string} imagePath - Path to the image file
 * @param {Object} options - Search options
 * @returns {Promise<Object>} Complete scan and search results
 */
async function scanAndMatch(imagePath, options = {}) {
  const {
    threshold = 0.6,
    limit = 10,
    searchMode = 'local' // 'local' or 'gcs'
  } = options;

  try {
    logger.info('Starting scan and match workflow', { imagePath, options });

    // Step 1: Scan the face
    const scanResult = await scanFace(imagePath);

    if (!scanResult.success) {
      return scanResult;
    }

    // Step 2: Search for matches
    const searchResult = searchMode === 'gcs'
      ? await searchCollections(scanResult.face.embedding, threshold, limit)
      : await searchCollectionsLocal(scanResult.face.embedding, threshold, limit);

    if (!searchResult.success) {
      return {
        success: false,
        error: searchResult.error,
        scanned_face: scanResult.face
      };
    }

    return {
      success: true,
      scanned_face: {
        confidence: scanResult.face.confidence,
        boundingBox: scanResult.face.boundingBox
      },
      matches: searchResult.matches,
      stats: searchResult.stats
    };
  } catch (error) {
    logger.error('Failed to scan and match', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Initialize the face scanner service
 */
function initialize(loggerInstance) {
  logger = loggerInstance;
  logger.info('✓ Face scanner service initialized');
}

module.exports = {
  initialize,
  scanFace,
  searchCollections,
  searchCollectionsLocal,
  scanAndMatch,
  euclideanDistance
};
