/**
 * Google Cloud Storage Upload Service
 * Handles uploading images, metadata, and embeddings to GCS and Firestore
 */

const { Storage } = require('@google-cloud/storage');
const { Firestore } = require('@google-cloud/firestore');
const fs = require('fs').promises;
const path = require('path');
const { getGCPConfig, validateConfig, getCredentialsForSDK } = require('../../../config/gcp-config');

let storage = null;
let firestore = null;
let bucket = null;
let config = null;
let logger = null;
let db = null;
let initialized = false;

/**
 * Initialize GCS upload service
 */
async function initialize(database, loggerInstance) {
  logger = loggerInstance;
  db = database;

  try {
    // Load GCP configuration
    config = getGCPConfig();

    // Validate configuration
    const validation = validateConfig(config);
    if (!validation.valid) {
      logger.warn('GCP configuration incomplete', { errors: validation.errors });
      logger.info('GCP upload will be disabled. To enable: set GOOGLE_APPLICATION_CREDENTIALS or add gcp-service-account.json');
      initialized = false;
      return { success: false, errors: validation.errors };
    }

    // Initialize Google Cloud Storage
    const credentials = getCredentialsForSDK(config);
    storage = new Storage(credentials);
    bucket = storage.bucket(config.bucket.name);

    // Initialize Firestore (for embeddings)
    if (config.firestore.projectId) {
      firestore = new Firestore({
        ...credentials,
        projectId: config.firestore.projectId,
        databaseId: config.firestore.databaseId
      });
    }

    // Verify bucket exists
    const [exists] = await bucket.exists();
    if (!exists) {
      logger.warn('GCS bucket does not exist', { bucket: config.bucket.name });
      logger.info('Bucket will be created on first upload');
    }

    initialized = true;
    logger.info('✓ GCS upload service initialized', {
      bucket: config.bucket.name,
      firestore: !!firestore
    });

    return { success: true };
  } catch (error) {
    logger.error('Failed to initialize GCS upload service', {
      error: error.message,
      stack: error.stack
    });
    initialized = false;
    return { success: false, error: error.message };
  }
}

/**
 * Check if service is initialized and ready
 */
function isReady() {
  return initialized;
}

/**
 * Upload image file to GCS (legacy - uploads to images/ folder)
 * @param {string} localPath - Local file path
 * @param {string} collectionId - Collection ID for organizing
 * @param {string} imageId - Image ID
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadImage(localPath, collectionId, imageId) {
  if (!isReady()) {
    logger.warn('GCS upload skipped - not ready', { imageId });
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    // Determine file extension
    const ext = path.extname(localPath) || '.jpg';

    // Generate GCS path
    const gcsPath = `images/${collectionId}/${imageId}${ext}`;

    logger.info('📤 Starting GCS upload...', {
      imageId,
      localPath,
      gcsPath,
      bucket: config.bucket.name
    });

    // Check if local file exists
    const fsSync = require('fs');
    if (!fsSync.existsSync(localPath)) {
      logger.error('Local file not found for GCS upload', { localPath, imageId });
      return { success: false, error: `Local file not found: ${localPath}` };
    }

    // Upload file
    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: getContentType(ext),
        metadata: {
          imageId,
          collectionId,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('✅ Image uploaded to GCS', { imageId, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('❌ Failed to upload image to GCS', {
      imageId,
      localPath,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload original image to GCS (full quality for downloads)
 * @param {string} localPath - Local file path
 * @param {string} collectionId - Collection ID for organizing
 * @param {string} imageId - Image ID
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadOriginalImage(localPath, collectionId, imageId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const ext = path.extname(localPath) || '.jpg';
    const gcsPath = `originals/${collectionId}/${imageId}${ext}`;

    const fsSync = require('fs');
    if (!fsSync.existsSync(localPath)) {
      logger.error('Original file not found for GCS upload', { localPath, imageId });
      return { success: false, error: `Local file not found: ${localPath}` };
    }

    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: getContentType(ext),
        metadata: {
          imageId,
          collectionId,
          version: 'original',
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('✅ Original image uploaded to GCS', { imageId, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('❌ Failed to upload original image to GCS', {
      imageId,
      localPath,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Upload compressed image to GCS (web-optimized for display)
 * @param {string} localPath - Local file path
 * @param {string} collectionId - Collection ID for organizing
 * @param {string} imageId - Image ID
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadCompressedImage(localPath, collectionId, imageId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `compressed/${collectionId}/${imageId}.jpg`;

    const fsSync = require('fs');
    if (!fsSync.existsSync(localPath)) {
      logger.error('Compressed file not found for GCS upload', { localPath, imageId });
      return { success: false, error: `Local file not found: ${localPath}` };
    }

    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          imageId,
          collectionId,
          version: 'compressed',
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('✅ Compressed image uploaded to GCS', { imageId, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('❌ Failed to upload compressed image to GCS', {
      imageId,
      localPath,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Upload thumbnail to GCS (for gallery grid)
 * @param {string} localPath - Local file path
 * @param {string} collectionId - Collection ID for organizing
 * @param {string} imageId - Image ID
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadThumbnail(localPath, collectionId, imageId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `thumbnails/${collectionId}/${imageId}_thumb.jpg`;

    const fsSync = require('fs');
    if (!fsSync.existsSync(localPath)) {
      logger.error('Thumbnail file not found for GCS upload', { localPath, imageId });
      return { success: false, error: `Local file not found: ${localPath}` };
    }

    await bucket.upload(localPath, {
      destination: gcsPath,
      metadata: {
        contentType: 'image/jpeg',
        metadata: {
          imageId,
          collectionId,
          version: 'thumbnail',
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('✅ Thumbnail uploaded to GCS', { imageId, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('❌ Failed to upload thumbnail to GCS', {
      imageId,
      localPath,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Download original image from GCS (for download feature)
 * @param {string} gcsPath - GCS path to the original image
 * @param {string} destPath - Local destination path
 * @returns {Promise<{success: boolean, localPath?: string, error?: string}>}
 */
async function downloadOriginalFromGCS(gcsPath, destPath) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    // Extract file path from gs:// URL if provided
    let filePath = gcsPath;
    if (gcsPath.startsWith('gs://')) {
      filePath = gcsPath.replace(`gs://${config.bucket.name}/`, '');
    }

    const file = bucket.file(filePath);

    const [exists] = await file.exists();
    if (!exists) {
      return { success: false, error: 'File not found in GCS' };
    }

    await file.download({ destination: destPath });

    logger.info('✅ Original downloaded from GCS', { gcsPath: filePath, destPath });

    return {
      success: true,
      localPath: destPath
    };
  } catch (error) {
    logger.error('❌ Failed to download original from GCS', {
      gcsPath,
      destPath,
      error: error.message
    });
    return { success: false, error: error.message };
  }
}

/**
 * Upload face metadata JSON to GCS
 * @param {object} metadata - Face metadata object
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadFaceMetadata(metadata) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `metadata/faces/${metadata.face_id}.json`;

    // Create file object in GCS
    const file = bucket.file(gcsPath);

    // Upload JSON content
    await file.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        metadata: {
          faceId: metadata.face_id,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('Face metadata uploaded to GCS', { faceId: metadata.face_id, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('Failed to upload face metadata to GCS', {
      faceId: metadata.face_id,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload embedding to GCS as JSON
 * @param {object} embeddingData - Embedding data object
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadEmbeddingToGCS(embeddingData) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `embeddings/${embeddingData.face_id}.json`;

    const file = bucket.file(gcsPath);
    await file.save(JSON.stringify(embeddingData, null, 2), {
      contentType: 'application/json',
      metadata: {
        metadata: {
          faceId: embeddingData.face_id,
          dimensions: embeddingData.dimensions,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('Embedding uploaded to GCS', { faceId: embeddingData.face_id, gcsPath });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('Failed to upload embedding to GCS', {
      faceId: embeddingData.face_id,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Upload embedding to Firestore
 * @param {object} embeddingData - Embedding data object
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function uploadEmbeddingToFirestore(embeddingData) {
  if (!isReady() || !firestore) {
    return { success: false, error: 'Firestore not initialized' };
  }

  try {
    const collection = firestore.collection(config.firestore.collections.embeddings);

    await collection.doc(embeddingData.face_id).set({
      face_id: embeddingData.face_id,
      collection_id: embeddingData.collection_id,
      vector: embeddingData.vector,
      dimensions: embeddingData.dimensions,
      created_at: embeddingData.generated_at,
      uploaded_at: new Date().toISOString()
    });

    logger.info('Embedding uploaded to Firestore', { faceId: embeddingData.face_id });

    return { success: true };
  } catch (error) {
    logger.error('Failed to upload embedding to Firestore', {
      faceId: embeddingData.face_id,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sync a single image and all its faces to GCP
 * Uploads original, compressed, and thumbnail versions
 * @param {string} imageId - Image ID to sync
 * @returns {Promise<{success: boolean, results: object, error?: string}>}
 */
async function syncImage(imageId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    logger.info('Starting image sync', { imageId });

    // Get image data from database (including compression paths)
    const image = db.prepare(`
      SELECT * FROM images WHERE image_id = ?
    `).get(imageId);

    if (!image) {
      return { success: false, error: 'Image not found' };
    }

    // Get collection ID for this image
    const face = db.prepare(`
      SELECT fcm.collection_id
      FROM faces f
      LEFT JOIN face_collection_members fcm ON f.face_id = fcm.face_id
      WHERE f.image_id = ?
      LIMIT 1
    `).get(imageId);

    const collectionId = face?.collection_id || 'uncategorized';

    // Upload all image versions
    let originalUpload = { success: false };
    let compressedUpload = { success: false };
    let thumbnailUpload = { success: false };

    // 1. Upload original (if available)
    if (image.original_path) {
      originalUpload = await uploadOriginalImage(image.original_path, collectionId, imageId);
      if (originalUpload.success) {
        db.prepare(`UPDATE images SET original_gcs_path = ? WHERE image_id = ?`)
          .run(originalUpload.gcsPath, imageId);
      }
    }

    // 2. Upload compressed (if available)
    if (image.compressed_path) {
      compressedUpload = await uploadCompressedImage(image.compressed_path, collectionId, imageId);
      if (compressedUpload.success) {
        db.prepare(`UPDATE images SET compressed_gcs_path = ? WHERE image_id = ?`)
          .run(compressedUpload.gcsPath, imageId);
      }
    }

    // 3. Upload thumbnail (if available)
    if (image.thumbnail_path) {
      thumbnailUpload = await uploadThumbnail(image.thumbnail_path, collectionId, imageId);
      if (thumbnailUpload.success) {
        db.prepare(`UPDATE images SET thumbnail_gcs_path = ? WHERE image_id = ?`)
          .run(thumbnailUpload.gcsPath, imageId);
      }
    }

    // 4. Upload the main image (fallback, or for backwards compatibility)
    const imageUpload = await uploadImage(image.image_path, collectionId, imageId);
    if (!imageUpload.success) {
      throw new Error(`Failed to upload image: ${imageUpload.error}`);
    }

    // Update database with GCS path
    db.prepare(`
      UPDATE images
      SET gcs_path = ?, sync_status = 'uploading'
      WHERE image_id = ?
    `).run(imageUpload.gcsPath, imageId);

    // Get all faces for this image
    const faces = db.prepare(`
      SELECT f.*, fcm.collection_id
      FROM faces f
      LEFT JOIN face_collection_members fcm ON f.face_id = fcm.face_id
      WHERE f.image_id = ?
    `).all(imageId);

    const results = {
      image: imageUpload,
      imageVersions: {
        original: originalUpload,
        compressed: compressedUpload,
        thumbnail: thumbnailUpload
      },
      faces: [],
      metadata: [],
      embeddings: { gcs: [], firestore: [] }
    };

    // Upload each face's metadata and embeddings
    for (const face of faces) {
      // Prepare metadata
      const metadata = {
        face_id: face.face_id,
        collection_id: face.collection_id,
        image_id: imageId,
        bounding_box: JSON.parse(face.bounding_box),
        confidence: face.confidence,
        landmarks: face.landmarks ? JSON.parse(face.landmarks) : null,
        quality_score: face.quality_score,
        created_at: face.created_at
      };

      // Upload metadata to GCS
      const metadataUpload = await uploadFaceMetadata(metadata);
      results.metadata.push(metadataUpload);

      // Prepare embedding data
      const embeddingData = {
        face_id: face.face_id,
        collection_id: face.collection_id,
        vector: JSON.parse(face.embedding_vector),
        dimensions: 128,
        generated_at: face.created_at
      };

      // Upload embedding to GCS
      const embeddingGCS = await uploadEmbeddingToGCS(embeddingData);
      results.embeddings.gcs.push(embeddingGCS);

      // Upload embedding to Firestore (if available)
      if (firestore) {
        const embeddingFirestore = await uploadEmbeddingToFirestore(embeddingData);
        results.embeddings.firestore.push(embeddingFirestore);
      }

      // Update face sync status
      if (metadataUpload.success) {
        db.prepare(`
          UPDATE faces
          SET metadata_gcs_path = ?, sync_status = 'completed', synced_at = datetime('now')
          WHERE face_id = ?
        `).run(metadataUpload.gcsPath, face.face_id);
      }
    }

    // Update image sync status to completed
    db.prepare(`
      UPDATE images
      SET sync_status = 'completed', synced_at = datetime('now')
      WHERE image_id = ?
    `).run(imageId);

    logger.info('Image sync completed', {
      imageId,
      facesCount: faces.length
    });

    return {
      success: true,
      results
    };
  } catch (error) {
    logger.error('Image sync failed', {
      imageId,
      error: error.message,
      stack: error.stack
    });

    // Update sync status to failed
    db.prepare(`
      UPDATE images
      SET sync_status = 'failed', processing_error = ?
      WHERE image_id = ?
    `).run(error.message, imageId);

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Batch sync multiple images
 * @param {string[]} imageIds - Array of image IDs to sync (if not provided, syncs all unsynced images)
 * @returns {Promise<{success: boolean, results: object[]}>}
 */
async function batchSync(imageIds) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  // If no imageIds provided, get all images that haven't been synced
  if (!imageIds || imageIds.length === 0) {
    const unsyncedImages = db.prepare(`
      SELECT image_id
      FROM images
      WHERE processing_status = 'completed'
        AND (gcs_path IS NULL OR gcs_path = '')
      ORDER BY upload_time DESC
    `).all();

    imageIds = unsyncedImages.map(img => img.image_id);
  }

  logger.info('Starting batch sync', { count: imageIds.length });

  const results = [];
  let succeeded = 0;
  let failed = 0;

  for (const imageId of imageIds) {
    const result = await syncImage(imageId);
    results.push({ imageId, ...result });

    if (result.success) {
      succeeded++;
    } else {
      failed++;
    }
  }

  logger.info('Batch sync completed', { total: imageIds.length, succeeded, failed });

  return {
    success: true,
    results,
    stats: { total: imageIds.length, succeeded, failed }
  };
}

/**
 * Upload collection metadata to GCS
 * @param {string} collectionId - Collection ID
 * @returns {Promise<{success: boolean, gcsPath?: string, error?: string}>}
 */
async function uploadCollectionMetadata(collectionId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    // Get collection data from database
    const collection = db.prepare(`
      SELECT * FROM face_collections WHERE collection_id = ?
    `).get(collectionId);

    if (!collection) {
      return { success: false, error: 'Collection not found' };
    }

    // Get all faces in this collection with embeddings
    const faces = db.prepare(`
      SELECT f.face_id, f.image_id, f.confidence, f.quality_score, f.created_at,
             f.embedding_vector,
             fcm.similarity_score, fcm.is_representative
      FROM face_collection_members fcm
      JOIN faces f ON fcm.face_id = f.face_id
      WHERE fcm.collection_id = ?
      ORDER BY fcm.is_representative DESC, f.quality_score DESC
    `).all(collectionId);

    // Get unique images
    const imageIds = [...new Set(faces.map(f => f.image_id))];

    // Prepare collection metadata
    const metadata = {
      collection_id: collectionId,
      name: collection.name,
      total_faces: collection.total_faces,
      total_images: collection.total_images,
      representative_face_id: collection.representative_face_id,
      created_at: collection.created_at,
      updated_at: collection.updated_at,
      faces: faces.map(f => ({
        face_id: f.face_id,
        image_id: f.image_id,
        confidence: f.confidence,
        quality_score: f.quality_score,
        similarity_score: f.similarity_score,
        is_representative: f.is_representative === 1,
        embedding_vector: JSON.parse(f.embedding_vector),
        created_at: f.created_at
      })),
      image_ids: imageIds,
      synced_at: new Date().toISOString()
    };

    // Upload to GCS
    const gcsPath = `collections/${collectionId}.json`;
    const file = bucket.file(gcsPath);

    await file.save(JSON.stringify(metadata, null, 2), {
      contentType: 'application/json',
      metadata: {
        metadata: {
          collectionId: collectionId,
          totalFaces: collection.total_faces,
          totalImages: collection.total_images,
          uploadedAt: new Date().toISOString()
        }
      }
    });

    logger.info('Collection metadata uploaded to GCS', {
      collectionId,
      gcsPath,
      totalFaces: collection.total_faces,
      totalImages: collection.total_images
    });

    return {
      success: true,
      gcsPath: `gs://${config.bucket.name}/${gcsPath}`
    };
  } catch (error) {
    logger.error('Failed to upload collection metadata', {
      collectionId,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Sync all collections to GCS
 * @returns {Promise<{success: boolean, results: object[], stats: object}>}
 */
async function syncAllCollections() {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    logger.info('Starting collection sync');

    // Get all collections
    const collections = db.prepare(`
      SELECT collection_id FROM face_collections
      ORDER BY updated_at DESC
    `).all();

    const results = [];
    let succeeded = 0;
    let failed = 0;

    for (const collection of collections) {
      const result = await uploadCollectionMetadata(collection.collection_id);
      results.push({ collectionId: collection.collection_id, ...result });

      if (result.success) {
        succeeded++;
      } else {
        failed++;
      }
    }

    logger.info('Collection sync completed', {
      total: collections.length,
      succeeded,
      failed
    });

    return {
      success: true,
      results,
      stats: { total: collections.length, succeeded, failed }
    };
  } catch (error) {
    logger.error('Collection sync failed', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Fetch collection metadata from GCS
 * @param {string} collectionId - Collection ID
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
async function fetchCollectionFromGCS(collectionId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `collections/${collectionId}.json`;
    const file = bucket.file(gcsPath);

    const [exists] = await file.exists();
    if (!exists) {
      return { success: false, error: 'Collection not found in GCS' };
    }

    const [contents] = await file.download();
    const metadata = JSON.parse(contents.toString());

    logger.info('Collection fetched from GCS', { collectionId });

    return {
      success: true,
      data: metadata
    };
  } catch (error) {
    logger.error('Failed to fetch collection from GCS', {
      collectionId,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * List all collections from GCS
 * @returns {Promise<{success: boolean, collections?: array, error?: string}>}
 */
async function listCollectionsFromGCS() {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const [files] = await bucket.getFiles({
      prefix: 'collections/',
      delimiter: '/'
    });

    const collections = [];

    for (const file of files) {
      if (file.name.endsWith('.json')) {
        const collectionId = file.name.replace('collections/', '').replace('.json', '');
        const [metadata] = await file.getMetadata();

        collections.push({
          collection_id: collectionId,
          gcs_path: `gs://${config.bucket.name}/${file.name}`,
          size: metadata.size,
          updated: metadata.updated,
          created: metadata.timeCreated
        });
      }
    }

    logger.info('Collections listed from GCS', { count: collections.length });

    return {
      success: true,
      collections
    };
  } catch (error) {
    logger.error('Failed to list collections from GCS', { error: error.message });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete a collection from GCS
 * @param {string} collectionId - Collection ID to delete
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteCollectionFromGCS(collectionId) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const gcsPath = `collections/${collectionId}.json`;
    const file = bucket.file(gcsPath);

    // Check if file exists
    const [exists] = await file.exists();

    if (!exists) {
      logger.warn('Collection not found in GCS', { collectionId, gcsPath });
      return { success: true }; // Already deleted
    }

    // Delete the file
    await file.delete();

    logger.info('Collection deleted from GCS', { collectionId, gcsPath });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete collection from GCS', {
      collectionId,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete an image from GCS
 * @param {string} gcsPath - GCS path to the image (e.g., "images/collection_id/image_id.jpg")
 * @returns {Promise<{success: boolean, error?: string}>}
 */
async function deleteImageFromGCS(gcsPath) {
  if (!isReady()) {
    return { success: false, error: 'GCS service not initialized' };
  }

  try {
    const file = bucket.file(gcsPath);

    // Check if file exists
    const [exists] = await file.exists();

    if (!exists) {
      logger.warn('Image not found in GCS', { gcsPath });
      return { success: true }; // Already deleted
    }

    // Delete the file
    await file.delete();

    logger.info('Image deleted from GCS', { gcsPath });

    return { success: true };
  } catch (error) {
    logger.error('Failed to delete image from GCS', {
      gcsPath,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Get content type from file extension
 */
function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp'
  };
  return types[ext.toLowerCase()] || 'application/octet-stream';
}

module.exports = {
  initialize,
  isReady,
  uploadImage,
  uploadOriginalImage,
  uploadCompressedImage,
  uploadThumbnail,
  downloadOriginalFromGCS,
  uploadFaceMetadata,
  uploadEmbeddingToGCS,
  uploadEmbeddingToFirestore,
  syncImage,
  batchSync,
  uploadCollectionMetadata,
  syncAllCollections,
  fetchCollectionFromGCS,
  listCollectionsFromGCS,
  deleteCollectionFromGCS,
  deleteImageFromGCS
};
