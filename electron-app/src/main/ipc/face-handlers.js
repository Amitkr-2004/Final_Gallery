/**
 * Face & Collection IPC Handlers
 * Handles: core:face:* and core:collection:*
 */

const { getDatabase } = require('../database/schema');
const {
  getAllCollections,
  getFacesInCollection,
  getImagesWithPerson,
  renameCollection,
  deleteCollection
} = require('../services/face-clustering');
const { processImage } = require('../services/face-processing');
const fs = require('fs').promises;
const fssync = require('fs');

function registerFaceHandlers(ipcMain, getService) {
  /**
   * Get all face collections
   * Channel: core:face:get-collections
   */
  ipcMain.handle('core:face:get-collections', async () => {
    const logger = getService('logger');

    try {
      const collections = getAllCollections();

      return {
        success: true,
        collections
      };
    } catch (error) {
      logger.error('Failed to get collections', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get faces in a collection
   * Channel: core:face:get-collection-faces
   */
  ipcMain.handle('core:face:get-collection-faces', async (event, collectionId) => {
    const logger = getService('logger');

    try {
      const faces = getFacesInCollection(collectionId);

      return {
        success: true,
        faces
      };
    } catch (error) {
      logger.error('Failed to get collection faces', {
        collectionId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get images containing a specific person
   * Channel: core:face:get-person-images
   */
  ipcMain.handle('core:face:get-person-images', async (event, collectionId) => {
    const logger = getService('logger');

    try {
      const images = getImagesWithPerson(collectionId);

      return {
        success: true,
        images
      };
    } catch (error) {
      logger.error('Failed to get person images', {
        collectionId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Rename a collection
   * Channel: core:face:rename-collection
   */
  ipcMain.handle('core:face:rename-collection', async (event, collectionId, newName) => {
    const logger = getService('logger');

    try {
      renameCollection(collectionId, newName);

      logger.info('Collection renamed', { collectionId, newName });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to rename collection', {
        collectionId,
        newName,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete a collection
   * Channel: core:face:delete-collection
   */
  ipcMain.handle('core:face:delete-collection', async (event, collectionId) => {
    const logger = getService('logger');

    try {
      await deleteCollection(collectionId);

      logger.info('Collection deleted', { collectionId });

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to delete collection', {
        collectionId,
        error: error.message
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get face processing statistics
   * Channel: core:face:get-stats
   */
  ipcMain.handle('core:face:get-stats', async () => {
    const logger = getService('logger');
    const db = getDatabase();

    try {
      const stats = db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM images) as total_images,
          (SELECT COUNT(*) FROM images WHERE processing_status = 'completed') as processed_images,
          (SELECT COUNT(*) FROM images WHERE processing_status = 'pending') as pending_images,
          (SELECT COUNT(*) FROM images WHERE processing_status = 'failed') as failed_images,
          (SELECT COUNT(*) FROM faces) as total_faces,
          (SELECT COUNT(*) FROM face_collections) as total_collections
      `).get();

      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Failed to get face stats', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Batch process existing images
   * Channel: core:face:batch-process
   */
  ipcMain.handle('core:face:batch-process', async () => {
    const logger = getService('logger');
    const db = getDatabase();

    try {
      // Get all files from uploaded_files that haven't been processed yet
      const uploadedFiles = db.prepare(`
        SELECT id, filename, filepath, file_hash, file_size
        FROM uploaded_files
        WHERE file_hash NOT IN (
          SELECT file_hash FROM images WHERE file_hash IS NOT NULL
        )
        ORDER BY id ASC
      `).all();

      logger.info('Starting batch face processing', {
        total_files: uploadedFiles.length
      });

      if (uploadedFiles.length === 0) {
        return {
          success: true,
          processed: 0,
          failed: 0,
          message: 'All images already processed'
        };
      }

      let processed = 0;
      let failed = 0;

      for (const file of uploadedFiles) {
        try {
          // Check if file exists
          if (!fssync.existsSync(file.filepath)) {
            logger.warn('File not found', { filename: file.filename });
            failed++;
            continue;
          }

          await processImage(
            file.filepath,
            file.filename,
            file.file_hash,
            file.file_size
          );

          processed++;

        } catch (error) {
          logger.error('Failed to process image', {
            filename: file.filename,
            error: error.message
          });
          failed++;
        }
      }

      logger.info('Batch processing complete', {
        processed,
        failed,
        total: uploadedFiles.length
      });

      return {
        success: true,
        processed,
        failed,
        total: uploadedFiles.length
      };

    } catch (error) {
      logger.error('Batch processing failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = {
  registerFaceHandlers
};
