/**
 * Face Clustering Service
 * Handles face matching, collection creation, and person identification
 */

const { v4: uuidv4 } = require('uuid');
// Use mock face detection (works without TensorFlow)
const { cosineSimilarity } = require('./mock-face-detection');

// Similarity threshold for face matching (0.0 - 1.0)
// Higher = stricter matching, Lower = more lenient
const SIMILARITY_THRESHOLD = 0.6;

let db = null;
let logger = null;

/**
 * Initialize clustering service
 */
function initialize(database, loggerInstance) {
  db = database;
  logger = loggerInstance;
}

/**
 * Process a newly detected face and assign to collection
 * @param {object} face - Face object with embedding_vector
 * @param {string} imageId - Image ID this face belongs to
 * @returns {Promise<object>} Collection assignment result
 */
async function assignFaceToCollection(face, imageId) {
  try {
    // Get all existing collections with their representative faces
    const collections = db.prepare(`
      SELECT fc.*, f.embedding_vector
      FROM face_collections fc
      LEFT JOIN faces f ON fc.representative_face_id = f.face_id
    `).all();

    if (collections.length === 0) {
      // No collections yet, create first one
      return await createNewCollection(face, imageId);
    }

    // Find best matching collection
    let bestMatch = null;
    let bestScore = 0;

    for (const collection of collections) {
      if (!collection.embedding_vector) {
        continue; // Skip if no representative face
      }

      const repEmbedding = JSON.parse(collection.embedding_vector);
      const score = cosineSimilarity(face.embedding_vector, repEmbedding);

      if (score > bestScore) {
        bestScore = score;
        bestMatch = collection;
      }
    }

    // Decision: create new collection or add to existing
    if (bestScore >= SIMILARITY_THRESHOLD) {
      // Match found - add to existing collection
      logger.info('Face matched to existing collection', {
        collection_id: bestMatch.collection_id,
        similarity: bestScore.toFixed(3)
      });

      await addFaceToCollection(face, bestMatch.collection_id, bestScore, imageId);

      return {
        action: 'added_to_existing',
        collection_id: bestMatch.collection_id,
        similarity_score: bestScore
      };
    } else {
      // No good match - create new collection
      logger.info('Creating new collection for face', {
        best_score: bestScore.toFixed(3),
        threshold: SIMILARITY_THRESHOLD
      });

      const newCollection = await createNewCollection(face, imageId);

      return {
        action: 'created_new',
        collection_id: newCollection.collection_id,
        similarity_score: 0
      };
    }
  } catch (error) {
    logger.error('Error in assignFaceToCollection', { error: error.message });
    throw error;
  }
}

/**
 * Create a new face collection
 */
async function createNewCollection(face, imageId) {
  const collectionId = uuidv4();
  const collectionCount = db.prepare('SELECT COUNT(*) as count FROM face_collections').get().count;
  const collectionName = `Person ${collectionCount + 1}`;

  // Begin transaction
  db.prepare('BEGIN').run();

  try {
    // Create collection
    db.prepare(`
      INSERT INTO face_collections (
        collection_id,
        name,
        representative_face_id,
        total_faces,
        total_images,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, datetime('now'), datetime('now'))
    `).run(collectionId, collectionName, face.face_id, 1, 1);

    // Add face to collection
    db.prepare(`
      INSERT INTO face_collection_members (
        collection_id,
        face_id,
        similarity_score,
        is_representative,
        added_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(collectionId, face.face_id, 1.0, 1); // Representative face has score 1.0

    db.prepare('COMMIT').run();

    logger.info('Created new face collection', {
      collection_id: collectionId,
      name: collectionName
    });

    return {
      collection_id: collectionId,
      name: collectionName
    };
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

/**
 * Add face to existing collection
 */
async function addFaceToCollection(face, collectionId, similarityScore, imageId) {
  db.prepare('BEGIN').run();

  try {
    // Add to junction table
    db.prepare(`
      INSERT INTO face_collection_members (
        collection_id,
        face_id,
        similarity_score,
        is_representative,
        added_at
      ) VALUES (?, ?, ?, ?, datetime('now'))
    `).run(collectionId, face.face_id, similarityScore, 0);

    // Update collection stats
    const stats = db.prepare(`
      SELECT
        COUNT(DISTINCT fcm.face_id) as total_faces,
        COUNT(DISTINCT f.image_id) as total_images
      FROM face_collection_members fcm
      JOIN faces f ON fcm.face_id = f.face_id
      WHERE fcm.collection_id = ?
    `).get(collectionId);

    db.prepare(`
      UPDATE face_collections
      SET
        total_faces = ?,
        total_images = ?,
        updated_at = datetime('now')
      WHERE collection_id = ?
    `).run(stats.total_faces, stats.total_images, collectionId);

    // Check if we should update representative face (if new face has better quality)
    await updateRepresentativeFaceIfBetter(collectionId, face);

    db.prepare('COMMIT').run();
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

/**
 * Update representative face if new face has better quality
 */
async function updateRepresentativeFaceIfBetter(collectionId, newFace) {
  const currentRep = db.prepare(`
    SELECT f.quality_score, f.face_id
    FROM face_collections fc
    JOIN faces f ON fc.representative_face_id = f.face_id
    WHERE fc.collection_id = ?
  `).get(collectionId);

  if (!currentRep) {
    return; // No current representative
  }

  if (newFace.quality_score > currentRep.quality_score) {
    // Update representative face
    db.prepare(`
      UPDATE face_collections
      SET representative_face_id = ?
      WHERE collection_id = ?
    `).run(newFace.face_id, collectionId);

    // Update is_representative flags
    db.prepare(`
      UPDATE face_collection_members
      SET is_representative = 0
      WHERE collection_id = ? AND face_id = ?
    `).run(collectionId, currentRep.face_id);

    db.prepare(`
      UPDATE face_collection_members
      SET is_representative = 1
      WHERE collection_id = ? AND face_id = ?
    `).run(collectionId, newFace.face_id);

    logger.info('Updated representative face for collection', {
      collection_id: collectionId,
      old_quality: currentRep.quality_score.toFixed(3),
      new_quality: newFace.quality_score.toFixed(3)
    });
  }
}

/**
 * Get all face collections with stats
 */
function getAllCollections() {
  return db.prepare(`
    SELECT
      fc.*,
      f.image_id as rep_image_id,
      i.image_path as rep_image_path
    FROM face_collections fc
    LEFT JOIN faces f ON fc.representative_face_id = f.face_id
    LEFT JOIN images i ON f.image_id = i.image_id
    ORDER BY fc.created_at DESC
  `).all();
}

/**
 * Get all faces in a collection
 */
function getFacesInCollection(collectionId) {
  return db.prepare(`
    SELECT
      f.*,
      i.image_path,
      i.original_filename,
      fcm.similarity_score,
      fcm.is_representative
    FROM face_collection_members fcm
    JOIN faces f ON fcm.face_id = f.face_id
    JOIN images i ON f.image_id = i.image_id
    WHERE fcm.collection_id = ?
    ORDER BY fcm.similarity_score DESC
  `).all(collectionId);
}

/**
 * Get all images containing a specific person
 */
function getImagesWithPerson(collectionId) {
  return db.prepare(`
    SELECT DISTINCT
      i.*,
      COUNT(f.face_id) as face_count
    FROM images i
    JOIN faces f ON i.image_id = f.image_id
    JOIN face_collection_members fcm ON f.face_id = fcm.face_id
    WHERE fcm.collection_id = ?
    GROUP BY i.image_id
    ORDER BY i.upload_time DESC
  `).all(collectionId);
}

/**
 * Rename a collection
 */
function renameCollection(collectionId, newName) {
  db.prepare(`
    UPDATE face_collections
    SET name = ?, updated_at = datetime('now')
    WHERE collection_id = ?
  `).run(newName, collectionId);

  logger.info('Renamed collection', { collection_id: collectionId, new_name: newName });
}

/**
 * Delete a collection (reassign faces to new collections)
 */
async function deleteCollection(collectionId) {
  db.prepare('BEGIN').run();

  try {
    // Remove all face memberships
    db.prepare(`
      DELETE FROM face_collection_members
      WHERE collection_id = ?
    `).run(collectionId);

    // Delete collection
    db.prepare(`
      DELETE FROM face_collections
      WHERE collection_id = ?
    `).run(collectionId);

    db.prepare('COMMIT').run();

    logger.info('Deleted collection', { collection_id: collectionId });
  } catch (error) {
    db.prepare('ROLLBACK').run();
    throw error;
  }
}

module.exports = {
  initialize,
  assignFaceToCollection,
  getAllCollections,
  getFacesInCollection,
  getImagesWithPerson,
  renameCollection,
  deleteCollection,
  SIMILARITY_THRESHOLD
};
