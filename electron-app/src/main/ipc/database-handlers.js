/**
 * Database IPC Handlers
 * Handles: core:database:*
 */

function registerDatabaseHandlers(ipcMain, getService) {
  const {
    getImageById,
    getImagesByStatus,
    getImagesReadyForDownload,
    getImagesReadyForProcessing,
    getFailedImages,
    getAllCollections,
    getCollectionById,
    createCollection,
    updateCollection,
    deleteCollection
  } = require('../database/queries');

  const { getStats, vacuum } = require('../database/schema');

  /**
   * Get database statistics
   * Channel: core:database:get-stats
   */
  ipcMain.handle('core:database:get-stats', async () => {
    return getStats();
  });

  /**
   * Vacuum database
   * Channel: core:database:vacuum
   */
  ipcMain.handle('core:database:vacuum', async () => {
    vacuum();
    return { success: true };
  });

  /**
   * Get image by ID
   * Channel: core:database:get-image
   */
  ipcMain.handle('core:database:get-image', async (event, id) => {
    return getImageById(id);
  });

  /**
   * Get images by status
   * Channel: core:database:get-images-by-status
   */
  ipcMain.handle('core:database:get-images-by-status', async (event, syncStatus, options = {}) => {
    return getImagesByStatus(syncStatus, options);
  });

  /**
   * Get images ready for download
   * Channel: core:database:get-ready-for-download
   */
  ipcMain.handle('core:database:get-ready-for-download', async (event, limit = 100) => {
    return getImagesReadyForDownload(limit);
  });

  /**
   * Get images ready for processing
   * Channel: core:database:get-ready-for-processing
   */
  ipcMain.handle('core:database:get-ready-for-processing', async (event, limit = 100) => {
    return getImagesReadyForProcessing(limit);
  });

  /**
   * Get failed images
   * Channel: core:database:get-failed-images
   */
  ipcMain.handle('core:database:get-failed-images', async () => {
    return getFailedImages();
  });

  /**
   * Get all collections
   * Channel: core:database:get-collections
   */
  ipcMain.handle('core:database:get-collections', async () => {
    return getAllCollections();
  });

  /**
   * Get collection by ID
   * Channel: core:database:get-collection
   */
  ipcMain.handle('core:database:get-collection', async (event, id) => {
    return getCollectionById(id);
  });

  /**
   * Create collection
   * Channel: core:database:create-collection
   */
  ipcMain.handle('core:database:create-collection', async (event, name, imageIds = []) => {
    const id = createCollection(name, imageIds);
    return { success: true, id };
  });

  /**
   * Update collection
   * Channel: core:database:update-collection
   */
  ipcMain.handle('core:database:update-collection', async (event, id, data) => {
    updateCollection(id, data);
    return { success: true };
  });

  /**
   * Delete collection
   * Channel: core:database:delete-collection
   */
  ipcMain.handle('core:database:delete-collection', async (event, id) => {
    deleteCollection(id);
    return { success: true };
  });

  /**
   * Execute custom query (read-only)
   * Channel: core:database:query
   */
  ipcMain.handle('core:database:query', async (event, sql, params = []) => {
    const { getDatabase } = require('../database/schema');
    const db = getDatabase();

    // Security: Only allow SELECT queries
    if (!sql.trim().toUpperCase().startsWith('SELECT')) {
      throw new Error('Only SELECT queries are allowed from renderer');
    }

    try {
      const results = db.prepare(sql).all(...params);
      return results;
    } catch (error) {
      const logger = getService('logger');
      logger.error('Custom query failed', { sql, error: error.message });
      throw error;
    }
  });
}

module.exports = {
  registerDatabaseHandlers
};
