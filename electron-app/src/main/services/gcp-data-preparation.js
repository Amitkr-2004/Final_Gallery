/**
 * GCP Data Preparation Service
 * Prepares local face detection data for Google Cloud Platform upload
 *
 * This service:
 * - Queries processed images/faces/collections
 * - Generates JSON metadata for faces
 * - Organizes data by collection_id
 * - Marks items for sync
 */

const path = require('path');
const fs = require('fs-extra');

let db = null;
let logger = null;
let config = null;

/**
 * Initialize data preparation service
 */
function initialize(database, loggerInstance, appConfig) {
  db = database;
  logger = loggerInstance;
  config = appConfig;
}

/**
 * Get all items pending GCP sync
 * @returns {Promise<object>} Pending sync data
 */
async function getPendingSyncData() {
  try {
    // Get images pending sync (processing complete but not synced)
    const pendingImages = db.prepare(`
      SELECT
        image_id,
        image_path,
        original_filename,
        file_hash,
        file_size,
        width,
        height,
        total_faces_detected,
        processed_at,
        sync_status
      FROM images
      WHERE processing_status = 'completed'
      AND (sync_status = 'pending' OR sync_status IS NULL)
    `).all();

    // Get faces pending sync
    const pendingFaces = db.prepare(`
      SELECT
        f.face_id,
        f.image_id,
        f.bounding_box,
        f.embedding_vector,
        f.confidence,
        f.landmarks,
        f.quality_score,
        f.created_at,
        fcm.collection_id,
        fcm.similarity_score,
        fcm.is_representative
      FROM faces f
      LEFT JOIN face_collection_members fcm ON f.face_id = fcm.face_id
      WHERE (f.sync_status = 'pending' OR f.sync_status IS NULL)
    `).all();

    // Get collections with their stats
    const collections = db.prepare(`
      SELECT
        fc.collection_id,
        fc.name,
        fc.representative_face_id,
        fc.total_faces,
        fc.total_images,
        fc.created_at,
        fc.updated_at
      FROM face_collections fc
    `).all();

    logger.info('Retrieved pending sync data', {
      pendingImages: pendingImages.length,
      pendingFaces: pendingFaces.length,
      totalCollections: collections.length
    });

    return {
      images: pendingImages,
      faces: pendingFaces,
      collections: collections,
      stats: {
        pendingImages: pendingImages.length,
        pendingFaces: pendingFaces.length,
        totalCollections: collections.length
      }
    };
  } catch (error) {
    logger.error('Error getting pending sync data', { error: error.message });
    throw error;
  }
}

/**
 * Generate face metadata JSON for GCP
 * @param {object} face - Face object from database
 * @returns {object} Metadata JSON
 */
function generateFaceMetadata(face) {
  return {
    face_id: face.face_id,
    collection_id: face.collection_id,
    image_id: face.image_id,
    bounding_box: JSON.parse(face.bounding_box),
    confidence: face.confidence,
    landmarks: face.landmarks ? JSON.parse(face.landmarks) : null,
    quality_score: face.quality_score,
    similarity_score: face.similarity_score,
    is_representative: face.is_representative === 1,
    created_at: face.created_at,
    embedding_dimensions: 128 // Mock detection uses 128-dim vectors
  };
}

/**
 * Generate embedding JSON for GCP
 * @param {object} face - Face object with embedding_vector
 * @returns {object} Embedding JSON
 */
function generateEmbeddingData(face) {
  return {
    face_id: face.face_id,
    collection_id: face.collection_id,
    vector: JSON.parse(face.embedding_vector),
    dimensions: 128,
    generated_at: face.created_at
  };
}

/**
 * Prepare data structure for GCP upload
 * Returns organized data ready for upload to GCS
 *
 * Structure:
 * {
 *   images: [
 *     {
 *       collection_id: "uuid",
 *       image_id: "uuid",
 *       local_path: "path/to/image.jpg",
 *       gcs_path: "images/{collection_id}/{image_id}.jpg"
 *     }
 *   ],
 *   face_metadata: [
 *     {
 *       face_id: "uuid",
 *       metadata: {...},
 *       gcs_path: "metadata/faces/{face_id}.json"
 *     }
 *   ],
 *   embeddings: [
 *     {
 *       face_id: "uuid",
 *       data: {...},
 *       gcs_path: "embeddings/{face_id}.json"
 *     }
 *   ]
 * }
 */
async function prepareGCPUploadData() {
  try {
    logger.info('Starting GCP data preparation...');

    const pendingData = await getPendingSyncData();

    // Prepare image upload data
    const imageUploads = pendingData.images.map(image => {
      // Find collection_id for this image (from its faces)
      const imageFaces = pendingData.faces.filter(f => f.image_id === image.image_id);
      const collection_id = imageFaces.length > 0 ? imageFaces[0].collection_id : 'uncategorized';

      return {
        image_id: image.image_id,
        collection_id: collection_id,
        local_path: image.image_path,
        original_filename: image.original_filename,
        file_size: image.file_size,
        gcs_path: `images/${collection_id}/${image.image_id}.jpg`
      };
    });

    // Prepare face metadata uploads
    const metadataUploads = pendingData.faces.map(face => ({
      face_id: face.face_id,
      metadata: generateFaceMetadata(face),
      gcs_path: `metadata/faces/${face.face_id}.json`
    }));

    // Prepare embedding uploads
    const embeddingUploads = pendingData.faces.map(face => ({
      face_id: face.face_id,
      data: generateEmbeddingData(face),
      gcs_path: `embeddings/${face.face_id}.json`
    }));

    const uploadData = {
      images: imageUploads,
      face_metadata: metadataUploads,
      embeddings: embeddingUploads,
      collections: pendingData.collections,
      stats: {
        total_images: imageUploads.length,
        total_face_metadata: metadataUploads.length,
        total_embeddings: embeddingUploads.length,
        total_collections: pendingData.collections.length
      }
    };

    logger.info('GCP upload data prepared', uploadData.stats);

    return uploadData;
  } catch (error) {
    logger.error('Error preparing GCP upload data', { error: error.message });
    throw error;
  }
}

/**
 * Mark items as ready for sync
 * Updates sync_status to 'ready' for items that have been prepared
 */
async function markItemsForSync(imageIds, faceIds) {
  try {
    const transaction = db.transaction(() => {
      // Mark images as ready for sync
      if (imageIds && imageIds.length > 0) {
        const placeholders = imageIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE images
          SET sync_status = 'ready'
          WHERE image_id IN (${placeholders})
        `).run(...imageIds);
      }

      // Mark faces as ready for sync
      if (faceIds && faceIds.length > 0) {
        const placeholders = faceIds.map(() => '?').join(',');
        db.prepare(`
          UPDATE faces
          SET sync_status = 'ready'
          WHERE face_id IN (${placeholders})
        `).run(...faceIds);
      }
    });

    transaction();

    logger.info('Marked items for sync', {
      images: imageIds?.length || 0,
      faces: faceIds?.length || 0
    });

    return {
      success: true,
      markedImages: imageIds?.length || 0,
      markedFaces: faceIds?.length || 0
    };
  } catch (error) {
    logger.error('Error marking items for sync', { error: error.message });
    throw error;
  }
}

/**
 * Export face metadata to local JSON file (for testing/backup)
 */
async function exportFaceMetadataToFile(outputDir) {
  try {
    await fs.ensureDir(outputDir);

    const uploadData = await prepareGCPUploadData();

    // Export face metadata files
    for (const item of uploadData.face_metadata) {
      const filePath = path.join(outputDir, 'metadata', 'faces', `${item.face_id}.json`);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJSON(filePath, item.metadata, { spaces: 2 });
    }

    // Export embeddings
    for (const item of uploadData.embeddings) {
      const filePath = path.join(outputDir, 'embeddings', `${item.face_id}.json`);
      await fs.ensureDir(path.dirname(filePath));
      await fs.writeJSON(filePath, item.data, { spaces: 2 });
    }

    // Export collections summary
    const collectionsPath = path.join(outputDir, 'collections.json');
    await fs.writeJSON(collectionsPath, uploadData.collections, { spaces: 2 });

    logger.info('Exported face metadata to files', {
      outputDir,
      metadata_files: uploadData.face_metadata.length,
      embedding_files: uploadData.embeddings.length
    });

    return {
      success: true,
      outputDir,
      filesCreated: uploadData.face_metadata.length + uploadData.embeddings.length + 1
    };
  } catch (error) {
    logger.error('Error exporting metadata to files', { error: error.message });
    throw error;
  }
}

module.exports = {
  initialize,
  getPendingSyncData,
  generateFaceMetadata,
  generateEmbeddingData,
  prepareGCPUploadData,
  markItemsForSync,
  exportFaceMetadataToFile
};
