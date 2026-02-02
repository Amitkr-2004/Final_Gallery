/**
 * IPC Handlers for GCP Data Preparation
 */

const gcpDataPrep = require('../services/gcp-data-preparation');
const path = require('path');

function registerGCPHandlers(ipcMain, getService) {
  /**
   * Get pending sync data stats
   */
  ipcMain.handle('core:gcp:get-pending-sync', async () => {
    const logger = getService('logger');

    try {
      logger.info('Getting pending sync data...');
      const data = await gcpDataPrep.getPendingSyncData();
      return {
        success: true,
        data: data.stats
      };
    } catch (error) {
      logger.error('Failed to get pending sync data', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Prepare GCP upload data
   */
  ipcMain.handle('core:gcp:prepare-upload', async () => {
    const logger = getService('logger');

    try {
      logger.info('Preparing GCP upload data...');
      const uploadData = await gcpDataPrep.prepareGCPUploadData();
      return {
        success: true,
        data: uploadData.stats,
        preview: {
          sample_image: uploadData.images[0],
          sample_metadata: uploadData.face_metadata[0],
          sample_embedding: uploadData.embeddings[0]
        }
      };
    } catch (error) {
      logger.error('Failed to prepare upload data', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Export face metadata to local files (for testing/backup)
   */
  ipcMain.handle('core:gcp:export-metadata', async () => {
    const logger = getService('logger');
    const configService = getService('configService');

    try {
      const uploadPath = configService.get('storage.uploadPath');
      const outputDir = path.join(path.dirname(uploadPath), 'gcp-export');
      logger.info('Exporting face metadata to files...', { outputDir });

      const result = await gcpDataPrep.exportFaceMetadataToFile(outputDir);

      return {
        success: true,
        outputDir,
        filesCreated: result.filesCreated
      };
    } catch (error) {
      logger.error('Failed to export metadata', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Mark items for sync
   */
  ipcMain.handle('core:gcp:mark-for-sync', async (event, { imageIds, faceIds }) => {
    const logger = getService('logger');

    try {
      logger.info('Marking items for sync...', {
        imageCount: imageIds?.length || 0,
        faceCount: faceIds?.length || 0
      });

      const result = await gcpDataPrep.markItemsForSync(imageIds, faceIds);

      return {
        success: true,
        ...result
      };
    } catch (error) {
      logger.error('Failed to mark items for sync', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  const logger = getService('logger');
  logger.info('✓ GCP IPC handlers registered');
}

module.exports = { registerGCPHandlers };
