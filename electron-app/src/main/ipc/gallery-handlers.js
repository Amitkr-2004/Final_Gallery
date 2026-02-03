/**
 * Gallery IPC Handlers
 * Handles: core:gallery:* (get files, get recent, get stats, delete)
 */

const { getDatabase } = require('../database/schema');
const fs = require('fs').promises;
const path = require('path');

// Django API URL for syncing deletions (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
const DJANGO_API_URL = 'http://127.0.0.1:8000';

/**
 * Call Django API to delete a photo (syncs deletion to GCS via Django)
 */
async function syncDeleteToDjango(imageHash, logger) {
  try {
    // First, find the photo in Django by hash
    const response = await fetch(`${DJANGO_API_URL}/api/photos/`);
    if (!response.ok) {
      logger.warn('Could not fetch photos from Django for sync delete');
      return { success: false, error: 'Django API not available' };
    }

    const photos = await response.json();
    const djangoPhoto = photos.find(p => p.image_hash === imageHash);

    if (!djangoPhoto) {
      logger.info('Photo not found in Django (may not have been uploaded there)', { imageHash });
      return { success: true, message: 'Photo not in Django' };
    }

    // Delete from Django (which will also delete from GCS)
    const deleteResponse = await fetch(`${DJANGO_API_URL}/api/photos/${djangoPhoto.id}/`, {
      method: 'DELETE'
    });

    if (deleteResponse.ok) {
      const result = await deleteResponse.json();
      logger.info('Photo deleted from Django and GCS', { photoId: djangoPhoto.id, result });
      return { success: true, result };
    } else {
      const error = await deleteResponse.text();
      logger.warn('Failed to delete from Django', { photoId: djangoPhoto.id, error });
      return { success: false, error };
    }
  } catch (error) {
    logger.warn('Could not sync delete to Django (server may be offline)', { error: error.message });
    return { success: false, error: error.message };
  }
}

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

    // Get gcsUpload service safely (may not be initialized)
    let gcsUpload = null;
    try {
      gcsUpload = getService('gcsUpload');
    } catch (e) {
      logger.warn('GCS Upload service not available', { error: e.message });
    }

    try {
      // Get file info from database
      const file = db.prepare(`
        SELECT id, filename, filepath, file_hash
        FROM uploaded_files
        WHERE id = ?
      `).get(fileId);

      if (!file) {
        return {
          success: false,
          error: 'File not found in database'
        };
      }

      // Find corresponding image in images table (by filepath)
      const image = db.prepare(`
        SELECT image_id, gcs_path
        FROM images
        WHERE image_path = ?
      `).get(file.filepath);

      // SYNC DELETE TO DJANGO (this will delete from Django's DB and GCS)
      // Django is the single source of truth for GCS operations
      if (file.file_hash) {
        const djangoResult = await syncDeleteToDjango(file.file_hash, logger);
        logger.info('Django sync result', djangoResult);
      }

      // Also delete from Electron's own GCS connection as fallback
      if (image && image.gcs_path && gcsUpload && gcsUpload.isReady()) {
        try {
          // Delete image from GCS
          const gcsPath = image.gcs_path.replace(`gs://${process.env.GCS_BUCKET_NAME}/`, '');
          await gcsUpload.deleteImageFromGCS(gcsPath);
          logger.info('Image deleted from GCS (Electron)', { gcsPath });
        } catch (error) {
          logger.warn('Failed to delete image from GCS via Electron', {
            gcsPath: image.gcs_path,
            error: error.message
          });
        }
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

      // Delete from images table (will CASCADE delete faces)
      if (image) {
        db.prepare('DELETE FROM images WHERE image_id = ?').run(image.image_id);
        logger.info('Image deleted from database', { imageId: image.image_id });
      }

      // Delete from uploaded_files table
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
      // Get all files from database (including file_hash for Django sync)
      const files = db.prepare('SELECT filepath, file_hash FROM uploaded_files').all();

      let deletedCount = 0;
      let failedCount = 0;
      let djangoSynced = 0;

      // Delete all files and sync to Django
      for (const file of files) {
        // Sync delete to Django (which will delete from GCS)
        if (file.file_hash) {
          try {
            const djangoResult = await syncDeleteToDjango(file.file_hash, logger);
            if (djangoResult.success) {
              djangoSynced++;
            }
          } catch (error) {
            logger.warn('Failed to sync delete to Django', { error: error.message });
          }
        }

        // Delete from filesystem
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

      // Clear database tables
      db.prepare('DELETE FROM uploaded_files').run();
      db.prepare('DELETE FROM images').run();
      db.prepare('DELETE FROM faces').run();
      db.prepare('DELETE FROM face_collection_members').run();
      db.prepare('DELETE FROM face_collections').run();
      logger.info('Gallery cleared', { deletedCount, failedCount, djangoSynced, totalFiles: files.length });

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
