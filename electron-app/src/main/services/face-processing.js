/**
 * Face Processing Orchestrator
 * Coordinates the entire face detection and clustering pipeline
 */

const { v4: uuidv4 } = require('uuid');
const path = require('path');
const sizeOf = require('image-size');
// Use REAL face detection with face-api.js for proper matching
const { detectFaces } = require('./face-detection');
const { assignFaceToCollection } = require('./face-clustering');
const gcsUpload = require('./gcs-upload');

let db = null;
let logger = null;

/**
 * Initialize face processing service
 */
function initialize(database, loggerInstance) {
  db = database;
  logger = loggerInstance;
}

/**
 * Process an uploaded image for face detection
 * This is the main entry point called after image upload
 *
 * @param {string} imagePath - Full path to uploaded image
 * @param {string} originalFilename - Original filename
 * @param {string} fileHash - MD5 hash of file
 * @param {number} fileSize - File size in bytes
 * @returns {Promise<object>} Processing result
 */
async function processImage(imagePath, originalFilename, fileHash, fileSize) {
  const imageId = uuidv4();

  try {
    logger.info('🔍 Starting face processing', {
      image_id: imageId,
      filename: originalFilename,
      path: imagePath
    });

    // Get image dimensions
    const dimensions = sizeOf(imagePath);

    logger.info('📏 Image dimensions', {
      width: dimensions.width,
      height: dimensions.height
    });

    // Insert image record with pending status
    db.prepare(`
      INSERT INTO images (
        image_id,
        image_path,
        original_filename,
        file_hash,
        upload_time,
        file_size,
        width,
        height,
        processing_status
      ) VALUES (?, ?, ?, ?, datetime('now'), ?, ?, ?, 'pending')
    `).run(
      imageId,
      imagePath,
      originalFilename,
      fileHash,
      fileSize,
      dimensions.width,
      dimensions.height
    );

    logger.info('✅ Image record inserted', { image_id: imageId });

    logger.info('Image registered for face processing', {
      image_id: imageId,
      filename: originalFilename,
      dimensions: `${dimensions.width}x${dimensions.height}`
    });

    // Process faces asynchronously (don't block upload response)
    processImageFaces(imageId, imagePath).catch(error => {
      logger.error('Async face processing failed', {
        image_id: imageId,
        error: error.message
      });
    });

    return {
      success: true,
      image_id: imageId,
      message: 'Image queued for face processing'
    };
  } catch (error) {
    logger.error('Failed to register image for processing', {
      path: imagePath,
      error: error.message
    });

    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process faces in an image (async)
 * This runs in background after upload completes
 */
async function processImageFaces(imageId, imagePath) {
  try {
    // Update status to processing
    db.prepare(`
      UPDATE images
      SET processing_status = 'processing'
      WHERE image_id = ?
    `).run(imageId);

    logger.info('Starting face detection', { image_id: imageId });

    // Detect faces
    const detectedFaces = await detectFaces(imagePath);

    if (detectedFaces.length === 0) {
      logger.info('No faces detected', { image_id: imageId });

      db.prepare(`
        UPDATE images
        SET
          total_faces_detected = 0,
          processing_status = 'completed',
          processed_at = datetime('now')
        WHERE image_id = ?
      `).run(imageId);

      return;
    }

    logger.info(`Detected ${detectedFaces.length} face(s)`, { image_id: imageId });

    // Process each detected face
    for (const face of detectedFaces) {
      try {
        // Insert face into database
        db.prepare(`
          INSERT INTO faces (
            face_id,
            image_id,
            bounding_box,
            embedding_vector,
            confidence,
            landmarks,
            quality_score,
            created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
        `).run(
          face.face_id,
          imageId,
          JSON.stringify(face.bounding_box),
          JSON.stringify(face.embedding_vector),
          face.confidence,
          JSON.stringify(face.landmarks),
          face.quality_score
        );

        logger.info('Face saved to database', {
          face_id: face.face_id,
          confidence: face.confidence.toFixed(3),
          quality: face.quality_score.toFixed(3)
        });

        // Assign face to collection (clustering)
        const assignment = await assignFaceToCollection(face, imageId);

        logger.info('Face assigned to collection', {
          face_id: face.face_id,
          action: assignment.action,
          collection_id: assignment.collection_id
        });
      } catch (error) {
        logger.error('Failed to process face', {
          face_id: face.face_id,
          error: error.message
        });
      }
    }

    // Update image with final count and status
    db.prepare(`
      UPDATE images
      SET
        total_faces_detected = ?,
        processing_status = 'completed',
        processed_at = datetime('now')
      WHERE image_id = ?
    `).run(detectedFaces.length, imageId);

    logger.info('Face processing completed', {
      image_id: imageId,
      total_faces: detectedFaces.length
    });

    // Auto-sync image to GCS (don't wait, run in background)
    if (gcsUpload && gcsUpload.isReady()) {
      gcsUpload.syncImage(imageId).catch(err => {
        logger.warn('Failed to auto-sync image to GCS', {
          image_id: imageId,
          error: err.message
        });
      });
    }
  } catch (error) {
    logger.error('Face processing failed', {
      image_id: imageId,
      error: error.message,
      stack: error.stack
    });

    // Update status to failed
    db.prepare(`
      UPDATE images
      SET
        processing_status = 'failed',
        processing_error = ?,
        processed_at = datetime('now')
      WHERE image_id = ?
    `).run(error.message, imageId);
  }
}

/**
 * Get processing status for an image
 */
function getProcessingStatus(imageId) {
  return db.prepare(`
    SELECT
      image_id,
      processing_status,
      total_faces_detected,
      processing_error,
      processed_at
    FROM images
    WHERE image_id = ?
  `).get(imageId);
}

/**
 * Get all images with their face counts
 */
function getAllImagesWithFaces() {
  return db.prepare(`
    SELECT
      i.*,
      COUNT(f.face_id) as face_count
    FROM images i
    LEFT JOIN faces f ON i.image_id = f.image_id
    GROUP BY i.image_id
    ORDER BY i.upload_time DESC
  `).all();
}

/**
 * Get statistics
 */
function getStatistics() {
  const imageStats = db.prepare(`
    SELECT
      COUNT(*) as total_images,
      SUM(CASE WHEN processing_status = 'completed' THEN 1 ELSE 0 END) as processed,
      SUM(CASE WHEN processing_status = 'pending' THEN 1 ELSE 0 END) as pending,
      SUM(CASE WHEN processing_status = 'failed' THEN 1 ELSE 0 END) as failed
    FROM images
  `).get();

  const faceStats = db.prepare(`
    SELECT COUNT(*) as total_faces FROM faces
  `).get();

  const collectionStats = db.prepare(`
    SELECT COUNT(*) as total_collections FROM face_collections
  `).get();

  return {
    images: imageStats,
    faces: faceStats,
    collections: collectionStats
  };
}

/**
 * Batch process all pending images
 */
async function batchProcessImages() {
  const pendingImages = db.prepare(`
    SELECT image_id, image_path, original_filename, file_hash, file_size
    FROM images
    WHERE processing_status = 'pending' OR processing_status IS NULL
    ORDER BY upload_time ASC
  `).all();

  logger.info('Batch processing images', { count: pendingImages.length });

  for (const image of pendingImages) {
    try {
      // For batch processing, directly process faces without re-inserting the image
      await processImageFaces(image.image_id, image.image_path);
    } catch (error) {
      logger.error('Failed to process image in batch', {
        image_id: image.image_id,
        error: error.message
      });
    }
  }

  logger.info('Batch processing complete', { count: pendingImages.length });
  return { success: true, processed: pendingImages.length };
}

module.exports = {
  initialize,
  processImage,
  batchProcessImages,
  getProcessingStatus,
  getAllImagesWithFaces,
  getStatistics
};
