/**
 * IPC Handlers for Face Scanner Operations
 */

const faceScanner = require('../services/face-scanner');
const fs = require('fs');
const path = require('path');
const os = require('os');

function registerFaceScannerHandlers(ipcMain, getService) {
  /**
   * Scan a face from an image file
   */
  ipcMain.handle('core:scanner:scan-face', async (event, imagePath) => {
    const logger = getService('logger');

    try {
      // Validate file exists
      if (!fs.existsSync(imagePath)) {
        return {
          success: false,
          error: 'Image file not found'
        };
      }

      logger.info('Scanning face', { imagePath });
      const result = await faceScanner.scanFace(imagePath);
      return result;
    } catch (error) {
      logger.error('Failed to scan face', { imagePath, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Search for matching collections using GCS
   */
  ipcMain.handle('core:scanner:search-collections', async (event, { embedding, threshold, limit }) => {
    const logger = getService('logger');

    try {
      logger.info('Searching collections', { threshold, limit });
      const result = await faceScanner.searchCollections(
        embedding,
        threshold || 0.6,
        limit || 10
      );
      return result;
    } catch (error) {
      logger.error('Failed to search collections', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Search for matching collections using local database (faster)
   */
  ipcMain.handle('core:scanner:search-collections-local', async (event, { embedding, threshold, limit }) => {
    const logger = getService('logger');

    try {
      logger.info('Searching collections locally', { threshold, limit });
      const result = await faceScanner.searchCollectionsLocal(
        embedding,
        threshold || 0.6,
        limit || 10
      );
      return result;
    } catch (error) {
      logger.error('Failed to search collections locally', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Complete workflow: Scan and match
   */
  ipcMain.handle('core:scanner:scan-and-match', async (event, { imagePath, options }) => {
    const logger = getService('logger');

    try {
      // Validate file exists
      if (!fs.existsSync(imagePath)) {
        return {
          success: false,
          error: 'Image file not found'
        };
      }

      logger.info('Starting scan and match', { imagePath, options });
      const result = await faceScanner.scanAndMatch(imagePath, options || {});
      return result;
    } catch (error) {
      logger.error('Failed to scan and match', { imagePath, error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Save uploaded/captured image temporarily for scanning
   */
  ipcMain.handle('core:scanner:save-temp-image', async (event, { dataUrl, filename }) => {
    const logger = getService('logger');

    try {
      // Create temp directory if not exists
      const tempDir = path.join(os.tmpdir(), 'face-scanner');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      // Generate filename
      const timestamp = Date.now();
      const finalFilename = filename || `scan_${timestamp}.jpg`;
      const tempPath = path.join(tempDir, finalFilename);

      // Convert data URL to buffer and save
      const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      fs.writeFileSync(tempPath, buffer);

      logger.info('Temp image saved', { path: tempPath });

      return {
        success: true,
        path: tempPath
      };
    } catch (error) {
      logger.error('Failed to save temp image', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Clean up temporary images
   */
  ipcMain.handle('core:scanner:cleanup-temp', async () => {
    const logger = getService('logger');

    try {
      const tempDir = path.join(os.tmpdir(), 'face-scanner');

      if (fs.existsSync(tempDir)) {
        const files = fs.readdirSync(tempDir);

        for (const file of files) {
          const filePath = path.join(tempDir, file);
          const stats = fs.statSync(filePath);

          // Delete files older than 1 hour
          const ageInHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);
          if (ageInHours > 1) {
            fs.unlinkSync(filePath);
          }
        }

        logger.info('Temp files cleaned up', { directory: tempDir });
      }

      return {
        success: true
      };
    } catch (error) {
      logger.error('Failed to cleanup temp files', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  const logger = getService('logger');
  logger.info('✓ Face Scanner IPC handlers registered');
}

module.exports = { registerFaceScannerHandlers };
