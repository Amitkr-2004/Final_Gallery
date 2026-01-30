/**
 * Upload IPC Handlers - Simplified
 * Handles: core:upload:* (select files, select folder, upload to local)
 */

const { dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const crypto = require('crypto');
const { getDatabase } = require('../database/schema');
const faceProcessing = require('../services/face-processing');

/**
 * Calculate MD5 hash of a file
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fssync.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Get all image files from a directory recursively
 */
async function getAllImageFiles(dirPath, allowedExtensions) {
  const files = [];

  async function scan(currentPath) {
    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase();
          if (allowedExtensions.includes(ext)) {
            files.push(fullPath);
          }
        }
      }
    } catch (error) {
      // Skip directories we can't read
      console.error(`Error reading directory ${currentPath}:`, error.message);
    }
  }

  await scan(dirPath);
  return files;
}

function registerUploadHandlers(ipcMain, getService) {
  /**
   * Select files for upload
   * Channel: core:upload:select-files
   */
  ipcMain.handle('core:upload:select-files', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Images to Upload',
      buttonLabel: 'Select',
      filters: [
        { name: 'Images', extensions: ['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp'] },
        { name: 'All Files', extensions: ['*'] }
      ],
      properties: ['openFile', 'multiSelections']
    });

    if (result.canceled) {
      return { success: false, canceled: true, files: [] };
    }

    return {
      success: true,
      canceled: false,
      files: result.filePaths
    };
  });

  /**
   * Select folder for upload
   * Channel: core:upload:select-folder
   */
  ipcMain.handle('core:upload:select-folder', async (event) => {
    const result = await dialog.showOpenDialog({
      title: 'Select Folder to Upload',
      buttonLabel: 'Select Folder',
      properties: ['openDirectory']
    });

    if (result.canceled) {
      return { success: false, canceled: true, files: [] };
    }

    // Get all image files from the selected folder
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp'];
    const folderPath = result.filePaths[0];
    const files = await getAllImageFiles(folderPath, allowedExtensions);

    return {
      success: true,
      canceled: false,
      folder: folderPath,
      files
    };
  });

  /**
   * Upload files (copy to local directory + save to DB)
   * Channel: core:upload:upload-files
   */
  ipcMain.handle('core:upload:upload-files', async (event, filePaths) => {
    const logger = getService('logger');
    const configService = getService('configService');
    const db = getDatabase();

    try {
      // Get upload directory
      const uploadDir = configService.get('storage.uploadPath');

      // Ensure upload directory exists
      if (!fssync.existsSync(uploadDir)) {
        await fs.mkdir(uploadDir, { recursive: true });
      }

      const results = {
        success: 0,
        failed: 0,
        skipped: 0,
        files: [],
        errors: [],
        duplicates: []
      };

      // Process each file
      for (const sourcePath of filePaths) {
        try {
          // Get file info
          const stat = await fs.stat(sourcePath);
          const filename = path.basename(sourcePath);
          const ext = path.extname(filename);

          // Calculate file hash
          const fileHash = await calculateFileHash(sourcePath);

          // Check if file with same hash already exists
          const existing = db.prepare(`
            SELECT id, filename, filepath FROM uploaded_files WHERE file_hash = ?
          `).get(fileHash);

          if (existing) {
            // Duplicate detected - skip upload
            results.skipped++;
            results.duplicates.push({
              filename,
              reason: 'Duplicate image already exists',
              existingFile: existing.filename
            });
            logger.info('Duplicate file skipped', { filename, hash: fileHash, existingFile: existing.filename });
            continue;
          }

          // Create unique filename with date and timestamp prefix
          const now = new Date();
          const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
          const timestamp = now.getTime(); // Unix timestamp for uniqueness
          const uniqueFilename = `${date}_${timestamp}_${filename}`;
          const destPath = path.join(uploadDir, uniqueFilename);

          // Copy file to upload directory
          await fs.copyFile(sourcePath, destPath);

          // Save to database with hash
          const stmt = db.prepare(`
            INSERT INTO uploaded_files (filename, filepath, upload_date, file_size, file_hash)
            VALUES (?, ?, ?, ?, ?)
          `);

          const info = stmt.run(
            filename,
            destPath,
            new Date().toISOString(),
            stat.size,
            fileHash
          );

          if (info.changes > 0) {
            results.success++;
            results.files.push({
              filename: uniqueFilename,
              filepath: destPath,
              size: stat.size,
              hash: fileHash
            });

            logger.info('File uploaded', { filename, destPath, hash: fileHash });

            // Trigger face detection (async, non-blocking)
            try {
              await faceProcessing.processImage(destPath, filename, fileHash, stat.size);
            } catch (faceError) {
              logger.warn('Face processing failed for image', {
                filename,
                error: faceError.message
              });
              // Don't fail the upload if face detection fails
            }
          }
        } catch (error) {
          results.failed++;
          results.errors.push({
            filename: path.basename(sourcePath),
            error: error.message
          });
          logger.error('Failed to upload file', {
            filename: path.basename(sourcePath),
            error: error.message
          });
        }
      }

      return {
        success: true,
        results
      };
    } catch (error) {
      logger.error('Upload failed', { error: error.message });
      return {
        success: false,
        error: error.message
      };
    }
  });

  /**
   * Get upload stats
   * Channel: core:upload:get-stats
   */
  ipcMain.handle('core:upload:get-stats', async () => {
    const db = getDatabase();

    try {
      const stats = db.prepare(`
        SELECT
          COUNT(*) as totalFiles,
          SUM(file_size) as totalSize
        FROM uploaded_files
      `).get();

      return {
        success: true,
        stats: {
          totalFiles: stats.totalFiles || 0,
          totalSize: stats.totalSize || 0
        }
      };
    } catch (error) {
      return {
        success: false,
        error: error.message
      };
    }
  });
}

module.exports = {
  registerUploadHandlers
};
