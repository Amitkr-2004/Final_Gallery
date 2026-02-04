/**
 * Upload IPC Handlers - Simplified
 * Handles: core:upload:* (select files, select folder, upload to local)
 * Now syncs uploads to Django backend for GCS sync
 * Includes image compression for optimized storage
 */

const { dialog } = require('electron');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');
const crypto = require('crypto');
const { getDatabase } = require('../database/schema');
const faceProcessing = require('../services/face-processing');
const imageCompression = require('../services/image-compression');
const FormData = require('form-data');

// Django API URL for syncing uploads (use 127.0.0.1 instead of localhost to avoid IPv6 issues)
const DJANGO_API_URL = 'http://127.0.0.1:8000';

/**
 * Sync uploaded image to Django backend (for GCS sync and face recognition)
 */
async function syncUploadToDjango(filePath, logger) {
  try {
    const filename = path.basename(filePath);

    // Create form data with file stream
    const formData = new FormData();
    formData.append('image', fssync.createReadStream(filePath), {
      filename: filename,
      contentType: getContentType(path.extname(filename))
    });

    // Use form-data's submit method which handles everything correctly
    return new Promise((resolve, reject) => {
      formData.submit('http://127.0.0.1:8000/api/upload/', (err, res) => {
        if (err) {
          logger.warn('Could not sync to Django (server may be offline)', { error: err.message });
          resolve({ success: false, error: err.message });
          return;
        }

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const result = JSON.parse(data);
            if (res.statusCode >= 200 && res.statusCode < 300) {
              logger.info('Image synced to Django', { photoId: result.photo_id, facesDetected: result.faces_detected });
              resolve({ success: true, result });
            } else {
              logger.warn('Django returned error', { statusCode: res.statusCode, result });
              resolve({ success: false, error: result.error || data });
            }
          } catch (e) {
            resolve({ success: false, error: data });
          }
        });

        res.on('error', (error) => {
          logger.warn('Response error from Django', { error: error.message });
          resolve({ success: false, error: error.message });
        });
      });
    });
  } catch (error) {
    logger.warn('Could not sync to Django', { error: error.message });
    return { success: false, error: error.message };
  }
}

/**
 * Get content type from file extension
 */
function getContentType(ext) {
  const types = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.bmp': 'image/bmp'
  };
  return types[ext.toLowerCase()] || 'image/jpeg';
}

/**
 * Calculate SHA256 hash of a file (matches Django's hash algorithm)
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('sha256');
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

// Track upload cancellation state
let uploadCancelled = false;

function registerUploadHandlers(ipcMain, getService) {
  // Initialize compression service
  const logger = getService('logger');
  const configService = getService('configService');
  imageCompression.initialize(logger, configService);

  /**
   * Cancel ongoing upload
   * Channel: core:upload:cancel
   */
  ipcMain.handle('core:upload:cancel', async () => {
    uploadCancelled = true;
    return { success: true, message: 'Upload cancellation requested' };
  });
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
        cancelled: 0,
        files: [],
        errors: [],
        duplicates: []
      };

      // Reset cancellation flag at start of upload
      uploadCancelled = false;

      // Process each file
      for (let i = 0; i < filePaths.length; i++) {
        // Check if upload was cancelled
        if (uploadCancelled) {
          results.cancelled = filePaths.length - i;
          logger.info('Upload cancelled by user', {
            processed: i,
            remaining: results.cancelled,
            success: results.success,
            failed: results.failed
          });

          // Send cancellation progress update
          event.sender.send('upload:progress', {
            current: i,
            total: filePaths.length,
            success: results.success,
            failed: results.failed,
            skipped: results.skipped,
            cancelled: results.cancelled,
            status: 'cancelled'
          });
          break;
        }

        const sourcePath = filePaths[i];
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

            // Send progress update for skipped file
            event.sender.send('upload:progress', {
              current: i + 1,
              total: filePaths.length,
              success: results.success,
              failed: results.failed,
              skipped: results.skipped,
              currentFile: filename,
              status: 'skipped'
            });
            continue;
          }

          // Create unique filename with date and timestamp prefix
          const now = new Date();
          const date = now.toISOString().split('T')[0]; // YYYY-MM-DD
          const timestamp = now.getTime(); // Unix timestamp for uniqueness
          const uniqueFilename = `${date}_${timestamp}_${filename}`;
          const destPath = path.join(uploadDir, uniqueFilename);

          // Copy file to upload directory (temporary, will be moved to originals)
          await fs.copyFile(sourcePath, destPath);

          // Process image with compression (creates original, compressed, thumbnail)
          let compressionResult = null;
          try {
            compressionResult = await imageCompression.processUploadWithCompression(
              destPath,
              filename,
              uniqueFilename
            );

            if (compressionResult.success) {
              logger.info('Image compression complete', {
                filename,
                originalSize: compressionResult.sizes.original,
                compressedSize: compressionResult.sizes.compressed,
                compressionRatio: (compressionResult.compressionRatio * 100).toFixed(1) + '%'
              });
            } else {
              logger.warn('Compression failed, using original', {
                filename,
                error: compressionResult.error
              });
            }
          } catch (compressError) {
            logger.warn('Compression service error', {
              filename,
              error: compressError.message
            });
          }

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
              hash: fileHash,
              compression: compressionResult ? {
                originalPath: compressionResult.paths?.original,
                compressedPath: compressionResult.paths?.compressed,
                thumbnailPath: compressionResult.paths?.thumbnail,
                compressionRatio: compressionResult.compressionRatio
              } : null
            });

            logger.info('File uploaded', { filename, destPath, hash: fileHash });

            // Trigger local face detection using compressed image for better performance
            try {
              const imageForProcessing = compressionResult?.compressedForFaceProcessing || destPath;
              await faceProcessing.processImage(imageForProcessing, filename, fileHash, stat.size);

              // Update images table with compression paths if face processing succeeded
              if (compressionResult?.success) {
                try {
                  // Find the image_id that was just created by face processing
                  const imageRecord = db.prepare(`
                    SELECT image_id FROM images WHERE file_hash = ? ORDER BY upload_time DESC LIMIT 1
                  `).get(fileHash);

                  if (imageRecord) {
                    db.prepare(`
                      UPDATE images SET
                        original_path = ?,
                        compressed_path = ?,
                        thumbnail_path = ?,
                        original_size = ?,
                        compressed_size = ?,
                        compression_ratio = ?
                      WHERE image_id = ?
                    `).run(
                      compressionResult.paths.original,
                      compressionResult.paths.compressed,
                      compressionResult.paths.thumbnail,
                      compressionResult.sizes.original,
                      compressionResult.sizes.compressed,
                      compressionResult.compressionRatio,
                      imageRecord.image_id
                    );
                    logger.info('Updated image record with compression paths', {
                      imageId: imageRecord.image_id,
                      originalPath: compressionResult.paths.original
                    });
                  }
                } catch (dbError) {
                  logger.warn('Failed to update compression paths in images table', {
                    error: dbError.message
                  });
                }
              }
            } catch (faceError) {
              logger.warn('Face processing failed for image', {
                filename,
                error: faceError.message
              });
              // Don't fail the upload if face detection fails
            }

            // Send progress update for successful upload
            event.sender.send('upload:progress', {
              current: i + 1,
              total: filePaths.length,
              success: results.success,
              failed: results.failed,
              skipped: results.skipped,
              currentFile: filename,
              status: 'success'
            });

            // SYNC TO DJANGO BACKEND (for GCS upload and InsightFace detection)
            // Django is the single source of truth for GCS operations
            try {
              const djangoResult = await syncUploadToDjango(destPath, logger);
              if (djangoResult.success) {
                logger.info('Image synced to Django and GCS', {
                  filename,
                  djangoPhotoId: djangoResult.result?.photo_id
                });
              }
            } catch (djangoError) {
              logger.warn('Django sync failed (non-blocking)', {
                filename,
                error: djangoError.message
              });
              // Don't fail the upload if Django sync fails
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

          // Send progress update for failed upload
          event.sender.send('upload:progress', {
            current: i + 1,
            total: filePaths.length,
            success: results.success,
            failed: results.failed,
            skipped: results.skipped,
            currentFile: path.basename(sourcePath),
            status: 'failed'
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
