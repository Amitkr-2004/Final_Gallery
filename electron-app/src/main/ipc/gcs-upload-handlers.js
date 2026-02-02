/**
 * IPC Handlers for GCS Upload Operations
 */

const gcsUpload = require('../services/gcs-upload');
const { getDatabase } = require('../database/schema');

function registerGCSUploadHandlers(ipcMain, getService) {
  /**
   * Check if GCS service is ready
   */
  ipcMain.handle('core:gcs:is-ready', async () => {
    try {
      const isReady = gcsUpload.isReady();
      return {
        success: true,
        ready: isReady
      };
    } catch (error) {
      return {
        success: false,
        ready: false,
        error: error.message
      };
    }
  });

  /**
   * Sync a single image to GCS
   */
  ipcMain.handle('core:gcs:sync-image', async (event, imageId) => {
    const logger = getService('logger');

    try {
      logger.info('Syncing image to GCS', { imageId });
      const result = await gcsUpload.syncImage(imageId);
      return result;
    } catch (error) {
      logger.error('Failed to sync image', { imageId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Batch sync multiple images to GCS
   */
  ipcMain.handle('core:gcs:batch-sync', async (event, { imageIds, limit }) => {
    const logger = getService('logger');
    const db = getDatabase();

    try {
      // If no imageIds provided, get all pending images
      let idsToSync = imageIds;

      if (!idsToSync || idsToSync.length === 0) {
        const pendingImages = db.prepare(`
          SELECT image_id
          FROM images
          WHERE processing_status = 'completed'
          AND (sync_status = 'pending' OR sync_status IS NULL)
          ${limit ? `LIMIT ${limit}` : ''}
        `).all();

        idsToSync = pendingImages.map(img => img.image_id);
      }

      if (idsToSync.length === 0) {
        return {
          success: true,
          message: 'No images to sync',
          results: [],
          stats: { total: 0, succeeded: 0, failed: 0 }
        };
      }

      logger.info('Starting batch sync', { count: idsToSync.length });
      const result = await gcsUpload.batchSync(idsToSync);

      return result;
    } catch (error) {
      logger.error('Failed to batch sync', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get sync statistics
   */
  ipcMain.handle('core:gcs:get-sync-stats', async () => {
    const logger = getService('logger');
    const db = getDatabase();

    try {
      const stats = {
        pending: db.prepare(`
          SELECT COUNT(*) as count FROM images
          WHERE processing_status = 'completed'
          AND (sync_status = 'pending' OR sync_status IS NULL)
        `).get().count,

        uploading: db.prepare(`
          SELECT COUNT(*) as count FROM images
          WHERE sync_status = 'uploading'
        `).get().count,

        completed: db.prepare(`
          SELECT COUNT(*) as count FROM images
          WHERE sync_status = 'completed'
        `).get().count,

        failed: db.prepare(`
          SELECT COUNT(*) as count FROM images
          WHERE sync_status = 'failed'
        `).get().count,

        total: db.prepare(`
          SELECT COUNT(*) as count FROM images
        `).get().count
      };

      return {
        success: true,
        stats
      };
    } catch (error) {
      logger.error('Failed to get sync stats', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Retry failed syncs
   */
  ipcMain.handle('core:gcs:retry-failed', async () => {
    const logger = getService('logger');
    const db = getDatabase();

    try {
      // Get failed images
      const failedImages = db.prepare(`
        SELECT image_id FROM images
        WHERE sync_status = 'failed'
      `).all();

      if (failedImages.length === 0) {
        return {
          success: true,
          message: 'No failed syncs to retry',
          results: [],
          stats: { total: 0, succeeded: 0, failed: 0 }
        };
      }

      // Reset status to pending
      db.prepare(`
        UPDATE images
        SET sync_status = 'pending', processing_error = NULL
        WHERE sync_status = 'failed'
      `).run();

      logger.info('Retrying failed syncs', { count: failedImages.length });

      const imageIds = failedImages.map(img => img.image_id);
      const result = await gcsUpload.batchSync(imageIds);

      return result;
    } catch (error) {
      logger.error('Failed to retry syncs', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Upload single collection metadata to GCS
   */
  ipcMain.handle('core:gcs:upload-collection', async (event, collectionId) => {
    const logger = getService('logger');

    try {
      logger.info('Uploading collection to GCS', { collectionId });
      const result = await gcsUpload.uploadCollectionMetadata(collectionId);
      return result;
    } catch (error) {
      logger.error('Failed to upload collection', { collectionId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Sync all collections to GCS
   */
  ipcMain.handle('core:gcs:sync-all-collections', async () => {
    const logger = getService('logger');

    try {
      logger.info('Syncing all collections to GCS');
      const result = await gcsUpload.syncAllCollections();
      return result;
    } catch (error) {
      logger.error('Failed to sync collections', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Fetch collection from GCS
   */
  ipcMain.handle('core:gcs:fetch-collection', async (event, collectionId) => {
    const logger = getService('logger');

    try {
      logger.info('Fetching collection from GCS', { collectionId });
      const result = await gcsUpload.fetchCollectionFromGCS(collectionId);
      return result;
    } catch (error) {
      logger.error('Failed to fetch collection', { collectionId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * List all collections from GCS
   */
  ipcMain.handle('core:gcs:list-collections', async () => {
    const logger = getService('logger');

    try {
      logger.info('Listing collections from GCS');
      const result = await gcsUpload.listCollectionsFromGCS();
      return result;
    } catch (error) {
      logger.error('Failed to list collections', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  const logger = getService('logger');
  logger.info('✓ GCS Upload IPC handlers registered');
}

module.exports = { registerGCSUploadHandlers };
