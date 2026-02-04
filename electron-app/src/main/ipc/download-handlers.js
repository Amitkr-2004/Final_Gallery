/**
 * Download IPC Handlers
 * Handles: core:download:* (download images, collections, select folder)
 * Provides original quality images for download
 */

const { dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const { getDatabase } = require('../database/schema');
const gcsUpload = require('../services/gcs-upload');

/**
 * Register download IPC handlers
 * @param {object} ipcMain - Electron IPC main
 * @param {function} getService - Service getter function
 */
function registerDownloadHandlers(ipcMain, getService) {
  const logger = getService('logger');

  /**
   * Select folder for downloads
   * Channel: core:download:select-folder
   */
  ipcMain.handle('core:download:select-folder', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Download Folder',
      buttonLabel: 'Select',
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true };
    }

    return {
      success: true,
      folder: result.filePaths[0]
    };
  });

  /**
   * Download a single image (original quality)
   * Channel: core:download:image
   * @param {object} options - { imageId, savePath? }
   */
  ipcMain.handle('core:download:image', async (event, options) => {
    const { imageId, savePath } = options;
    const db = getDatabase();

    try {
      // Get image from database
      const image = db.prepare(`
        SELECT image_id, original_filename, original_path, image_path,
               original_gcs_path, gcs_path
        FROM images
        WHERE image_id = ?
      `).get(imageId);

      if (!image) {
        return { success: false, error: 'Image not found' };
      }

      // Determine source path (prefer original, fallback to main image)
      let sourcePath = image.original_path || image.image_path;
      let useGCS = false;

      // Check if local file exists
      if (!fssync.existsSync(sourcePath)) {
        // Try to download from GCS
        if (image.original_gcs_path || image.gcs_path) {
          useGCS = true;
          logger.info('Local file not found, will download from GCS', {
            imageId,
            gcsPath: image.original_gcs_path || image.gcs_path
          });
        } else {
          return { success: false, error: 'Image file not found locally or in cloud' };
        }
      }

      // If no save path provided, open dialog
      let destFolder = savePath;
      if (!destFolder) {
        const result = await dialog.showOpenDialog({
          title: 'Select Download Location',
          buttonLabel: 'Download Here',
          properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }
        destFolder = result.filePaths[0];
      }

      // Determine filename
      const filename = image.original_filename || path.basename(sourcePath);
      const destPath = path.join(destFolder, filename);

      // Handle duplicate filenames
      let finalDestPath = destPath;
      let counter = 1;
      while (fssync.existsSync(finalDestPath)) {
        const ext = path.extname(filename);
        const name = path.basename(filename, ext);
        finalDestPath = path.join(destFolder, `${name} (${counter})${ext}`);
        counter++;
      }

      // Download from GCS if needed
      if (useGCS) {
        const gcsPath = image.original_gcs_path || image.gcs_path;
        const downloadResult = await gcsUpload.downloadOriginalFromGCS(gcsPath, finalDestPath);

        if (!downloadResult.success) {
          return { success: false, error: `Failed to download from cloud: ${downloadResult.error}` };
        }

        logger.info('Image downloaded from GCS', {
          imageId,
          destPath: finalDestPath
        });
      } else {
        // Copy local file
        await fs.copyFile(sourcePath, finalDestPath);

        logger.info('Image downloaded locally', {
          imageId,
          sourcePath,
          destPath: finalDestPath
        });
      }

      return {
        success: true,
        path: finalDestPath,
        filename: path.basename(finalDestPath)
      };
    } catch (error) {
      logger.error('Failed to download image', {
        imageId,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Download all images from a collection
   * Channel: core:download:collection
   * @param {object} options - { collectionId, savePath? }
   */
  ipcMain.handle('core:download:collection', async (event, options) => {
    const { collectionId, savePath } = options;
    const db = getDatabase();

    try {
      // Get collection info
      const collection = db.prepare(`
        SELECT collection_id, name, total_images
        FROM face_collections
        WHERE collection_id = ?
      `).get(collectionId);

      if (!collection) {
        return { success: false, error: 'Collection not found' };
      }

      // Get all unique images in this collection
      const images = db.prepare(`
        SELECT DISTINCT i.image_id, i.original_filename, i.original_path, i.image_path,
               i.original_gcs_path, i.gcs_path
        FROM face_collection_members fcm
        JOIN faces f ON fcm.face_id = f.face_id
        JOIN images i ON f.image_id = i.image_id
        WHERE fcm.collection_id = ?
      `).all(collectionId);

      if (images.length === 0) {
        return { success: false, error: 'No images found in collection' };
      }

      // If no save path provided, open dialog
      let destFolder = savePath;
      if (!destFolder) {
        const result = await dialog.showOpenDialog({
          title: 'Select Download Location for Collection',
          buttonLabel: 'Download Here',
          properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }
        destFolder = result.filePaths[0];
      }

      // Create collection subfolder
      const collectionName = collection.name || `Collection_${collectionId.slice(0, 8)}`;
      const safeName = collectionName.replace(/[<>:"/\\|?*]/g, '_');
      const collectionFolder = path.join(destFolder, safeName);

      if (!fssync.existsSync(collectionFolder)) {
        await fs.mkdir(collectionFolder, { recursive: true });
      }

      // Download each image
      const results = {
        total: images.length,
        success: 0,
        failed: 0,
        files: [],
        errors: []
      };

      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        try {
          // Send progress
          event.sender.send('download:progress', {
            current: i + 1,
            total: images.length,
            success: results.success,
            failed: results.failed,
            currentFile: image.original_filename
          });

          // Determine source
          let sourcePath = image.original_path || image.image_path;
          let useGCS = !fssync.existsSync(sourcePath);

          // Determine filename
          const filename = image.original_filename || path.basename(sourcePath);
          let destPath = path.join(collectionFolder, filename);

          // Handle duplicates
          let counter = 1;
          while (fssync.existsSync(destPath)) {
            const ext = path.extname(filename);
            const name = path.basename(filename, ext);
            destPath = path.join(collectionFolder, `${name} (${counter})${ext}`);
            counter++;
          }

          if (useGCS && (image.original_gcs_path || image.gcs_path)) {
            const gcsPath = image.original_gcs_path || image.gcs_path;
            const downloadResult = await gcsUpload.downloadOriginalFromGCS(gcsPath, destPath);

            if (!downloadResult.success) {
              throw new Error(downloadResult.error);
            }
          } else if (!useGCS) {
            await fs.copyFile(sourcePath, destPath);
          } else {
            throw new Error('Image not available locally or in cloud');
          }

          results.success++;
          results.files.push({
            imageId: image.image_id,
            filename: path.basename(destPath),
            path: destPath
          });
        } catch (error) {
          results.failed++;
          results.errors.push({
            imageId: image.image_id,
            filename: image.original_filename,
            error: error.message
          });
          logger.warn('Failed to download image in collection', {
            imageId: image.image_id,
            error: error.message
          });
        }
      }

      logger.info('Collection download complete', {
        collectionId,
        collectionName,
        total: results.total,
        success: results.success,
        failed: results.failed,
        folder: collectionFolder
      });

      return {
        success: true,
        results,
        folder: collectionFolder
      };
    } catch (error) {
      logger.error('Failed to download collection', {
        collectionId,
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Download multiple images by IDs
   * Channel: core:download:images
   * @param {object} options - { imageIds, savePath? }
   */
  ipcMain.handle('core:download:images', async (event, options) => {
    const { imageIds, savePath } = options;
    const db = getDatabase();

    try {
      if (!imageIds || imageIds.length === 0) {
        return { success: false, error: 'No images specified' };
      }

      // If no save path provided, open dialog
      let destFolder = savePath;
      if (!destFolder) {
        const result = await dialog.showOpenDialog({
          title: 'Select Download Location',
          buttonLabel: 'Download Here',
          properties: ['openDirectory', 'createDirectory']
        });

        if (result.canceled) {
          return { success: false, canceled: true };
        }
        destFolder = result.filePaths[0];
      }

      // Get all images
      const placeholders = imageIds.map(() => '?').join(',');
      const images = db.prepare(`
        SELECT image_id, original_filename, original_path, image_path,
               original_gcs_path, gcs_path
        FROM images
        WHERE image_id IN (${placeholders})
      `).all(...imageIds);

      // Download each image
      const results = {
        total: imageIds.length,
        found: images.length,
        success: 0,
        failed: 0,
        files: [],
        errors: []
      };

      for (let i = 0; i < images.length; i++) {
        const image = images[i];

        try {
          // Send progress
          event.sender.send('download:progress', {
            current: i + 1,
            total: images.length,
            success: results.success,
            failed: results.failed,
            currentFile: image.original_filename
          });

          let sourcePath = image.original_path || image.image_path;
          let useGCS = !fssync.existsSync(sourcePath);

          const filename = image.original_filename || path.basename(sourcePath);
          let destPath = path.join(destFolder, filename);

          // Handle duplicates
          let counter = 1;
          while (fssync.existsSync(destPath)) {
            const ext = path.extname(filename);
            const name = path.basename(filename, ext);
            destPath = path.join(destFolder, `${name} (${counter})${ext}`);
            counter++;
          }

          if (useGCS && (image.original_gcs_path || image.gcs_path)) {
            const gcsPath = image.original_gcs_path || image.gcs_path;
            const downloadResult = await gcsUpload.downloadOriginalFromGCS(gcsPath, destPath);

            if (!downloadResult.success) {
              throw new Error(downloadResult.error);
            }
          } else if (!useGCS) {
            await fs.copyFile(sourcePath, destPath);
          } else {
            throw new Error('Image not available');
          }

          results.success++;
          results.files.push({
            imageId: image.image_id,
            filename: path.basename(destPath),
            path: destPath
          });
        } catch (error) {
          results.failed++;
          results.errors.push({
            imageId: image.image_id,
            error: error.message
          });
        }
      }

      logger.info('Batch download complete', {
        total: results.total,
        success: results.success,
        failed: results.failed
      });

      return {
        success: true,
        results,
        folder: destFolder
      };
    } catch (error) {
      logger.error('Failed to download images', {
        error: error.message,
        stack: error.stack
      });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get image info for download preview
   * Channel: core:download:get-info
   */
  ipcMain.handle('core:download:get-info', async (event, imageId) => {
    const db = getDatabase();

    try {
      const image = db.prepare(`
        SELECT image_id, original_filename, original_size, file_size,
               original_path, compressed_path, thumbnail_path
        FROM images
        WHERE image_id = ?
      `).get(imageId);

      if (!image) {
        return { success: false, error: 'Image not found' };
      }

      // Check availability
      const available = {
        local: fssync.existsSync(image.original_path || image.image_path),
        gcs: false // Would need to check GCS
      };

      return {
        success: true,
        info: {
          imageId: image.image_id,
          filename: image.original_filename,
          originalSize: image.original_size || image.file_size,
          available
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });

  logger.info('Download handlers registered');
}

module.exports = {
  registerDownloadHandlers
};
