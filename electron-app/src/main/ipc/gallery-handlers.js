/**
 * Gallery IPC Handlers
 * Handles: core:gallery:* (get files, get recent, get stats, delete)
 */

const { getDatabase } = require('../database/schema');
const fs = require('fs').promises;
const path = require('path');

function registerGalleryHandlers(ipcMain, getService) {
  /**
   * Get all uploaded files
   * Channel: core:gallery:get-all-files
   */
  ipcMain.handle('core:gallery:get-all-files', async (event, options = {}) => {
    const db = getDatabase();

    try {
      const { limit = 1000, offset = 0, sortBy = 'upload_date', sortOrder = 'DESC' } = options;

      const query = `
        SELECT id, filename, filepath, upload_date, file_size
        FROM uploaded_files
        ORDER BY ${sortBy} ${sortOrder}
        LIMIT ? OFFSET ?
      `;

      const files = db.prepare(query).all(limit, offset);

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get recent files (last N days)
   * Channel: core:gallery:get-recent-files
   */
  ipcMain.handle('core:gallery:get-recent-files', async (event, days = 7) => {
    const db = getDatabase();

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - days);
      const cutoffISO = cutoffDate.toISOString();

      const files = db.prepare(`
        SELECT id, filename, filepath, upload_date, file_size
        FROM uploaded_files
        WHERE upload_date >= ?
        ORDER BY upload_date DESC
      `).all(cutoffISO);

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get gallery stats
   * Channel: core:gallery:get-stats
   */
  ipcMain.handle('core:gallery:get-stats', async () => {
    const db = getDatabase();

    try {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as totalFiles,
          SUM(file_size) as totalSize
        FROM uploaded_files
      `).get();

      // Get today's uploads
      const today = new Date().toISOString().split('T')[0]; // YYYY-MM-DD
      const todayStats = db.prepare(`
        SELECT COUNT(*) as count
        FROM uploaded_files
        WHERE upload_date >= ?
      `).get(`${today}T00:00:00`);

      return {
        success: true,
        stats: {
          totalFiles: stats.totalFiles || 0,
          totalSize: stats.totalSize || 0,
          todayUploads: todayStats.count || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Search files by filename
   * Channel: core:gallery:search-files
   */
  ipcMain.handle('core:gallery:search-files', async (event, searchTerm) => {
    const db = getDatabase();

    try {
      const files = db.prepare(`
        SELECT id, filename, filepath, upload_date, file_size
        FROM uploaded_files
        WHERE filename LIKE ?
        ORDER BY upload_date DESC
        LIMIT 100
      `).all(`%${searchTerm}%`);

      return {
        success: true,
        files
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Delete a single file
   * Channel: core:gallery:delete-file
   */
  ipcMain.handle('core:gallery:delete-file', async (event, fileId) => {
    const db = getDatabase();
    const logger = getService('logger');

    try {
      // Get file info from database
      const file = db.prepare(`
        SELECT id, filename, filepath
        FROM uploaded_files
        WHERE id = ?
      `).get(fileId);

      if (!file) {
        return {
          success: false,
          error: 'File not found in database'
        };
      }

      // Delete file from filesystem
      try {
        await fs.unlink(file.filepath);
        logger.info('File deleted from filesystem', { filepath: file.filepath });
      } catch (error) {
        logger.warn('Failed to delete file from filesystem (may already be deleted)', {
          filepath: file.filepath,
          error: error.message
        });
      }

      // Delete from database
      db.prepare('DELETE FROM uploaded_files WHERE id = ?').run(fileId);
      logger.info('File deleted from database', { fileId, filename: file.filename });

      return {
        success: true,
        message: 'File deleted successfully'
      };
    } catch (error) {
      logger.error('Failed to delete file', { fileId, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Clear entire gallery (delete all files)
   * Channel: core:gallery:clear-all
   */
  ipcMain.handle('core:gallery:clear-all', async () => {
    const db = getDatabase();
    const logger = getService('logger');
    const configService = getService('configService');

    try {
      // Get all files from database
      const files = db.prepare('SELECT filepath FROM uploaded_files').all();

      let deletedCount = 0;
      let failedCount = 0;

      // Delete all files from filesystem
      for (const file of files) {
        try {
          await fs.unlink(file.filepath);
          deletedCount++;
        } catch (error) {
          failedCount++;
          logger.warn('Failed to delete file from filesystem', {
            filepath: file.filepath,
            error: error.message
          });
        }
      }

      // Clear database
      db.prepare('DELETE FROM uploaded_files').run();
      logger.info('Gallery cleared', { deletedCount, failedCount, totalFiles: files.length });

      return {
        success: true,
        deletedCount,
        failedCount,
        message: `Cleared ${deletedCount} files successfully`
      };
    } catch (error) {
      logger.error('Failed to clear gallery', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = {
  registerGalleryHandlers
};
