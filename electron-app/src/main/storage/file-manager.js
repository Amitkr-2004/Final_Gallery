/**
 * File Manager
 * Handles local file system operations, directory management, and disk space monitoring
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');

/**
 * Ensure all required directories exist
 * @param {object} configService - Configuration service instance
 */
async function ensureDirectories(configService) {
  const config = configService.getAll();
  const directories = [
    config.storage.basePath,
    config.storage.downloadPath,
    config.storage.processedPath,
    config.storage.databasePath,
    config.storage.logsPath,
    config.storage.configPath
  ];

  // Add temp path if configured
  if (config.storage.tempPath) {
    directories.push(config.storage.tempPath);
  }

  for (const dir of directories) {
    await ensureDirectory(dir);
  }
}

/**
 * Ensure a single directory exists
 * @param {string} dirPath - Directory path
 */
async function ensureDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    if (error.code !== 'EEXIST') {
      throw new Error(`Failed to create directory ${dirPath}: ${error.message}`);
    }
  }
}

/**
 * Get disk space information
 * @param {string} path - Path to check
 * @returns {Promise<object>} Disk space info
 */
async function getDiskSpace(path) {
  // Note: This is a simplified version. For production, use 'check-disk-space' npm package
  // For now, we'll return a placeholder
  return {
    free: 100 * 1024 * 1024 * 1024, // 100 GB
    size: 500 * 1024 * 1024 * 1024  // 500 GB
  };
}

/**
 * Check if there's enough disk space
 * @param {string} path - Path to check
 * @param {number} requiredBytes - Required bytes
 * @returns {Promise<boolean>} True if enough space
 */
async function hasEnoughDiskSpace(path, requiredBytes) {
  const space = await getDiskSpace(path);
  return space.free >= requiredBytes;
}

/**
 * Calculate MD5 hash of a file
 * @param {string} filePath - File path
 * @returns {Promise<string>} MD5 hash
 */
async function calculateFileHash(filePath) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash('md5');
    const stream = fsSync.createReadStream(filePath);

    stream.on('data', (data) => hash.update(data));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });
}

/**
 * Get file size
 * @param {string} filePath - File path
 * @returns {Promise<number>} File size in bytes
 */
async function getFileSize(filePath) {
  const stats = await fs.stat(filePath);
  return stats.size;
}

/**
 * Check if file exists
 * @param {string} filePath - File path
 * @returns {Promise<boolean>} True if exists
 */
async function fileExists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete file
 * @param {string} filePath - File path
 */
async function deleteFile(filePath) {
  try {
    await fs.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') {
      throw error;
    }
  }
}

/**
 * Move file
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 */
async function moveFile(sourcePath, destPath) {
  await ensureDirectory(path.dirname(destPath));
  await fs.rename(sourcePath, destPath);
}

/**
 * Copy file
 * @param {string} sourcePath - Source file path
 * @param {string} destPath - Destination file path
 */
async function copyFile(sourcePath, destPath) {
  await ensureDirectory(path.dirname(destPath));
  await fs.copyFile(sourcePath, destPath);
}

/**
 * Get files in directory
 * @param {string} dirPath - Directory path
 * @param {object} options - Options (recursive, pattern)
 * @returns {Promise<string[]>} Array of file paths
 */
async function getFilesInDirectory(dirPath, options = {}) {
  const { recursive = false, pattern = null } = options;
  const files = [];

  async function scan(currentPath) {
    const entries = await fs.readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);

      if (entry.isDirectory()) {
        if (recursive) {
          await scan(fullPath);
        }
      } else {
        if (pattern) {
          if (entry.name.match(pattern)) {
            files.push(fullPath);
          }
        } else {
          files.push(fullPath);
        }
      }
    }
  }

  await scan(dirPath);
  return files;
}

/**
 * Clean up old files
 * @param {string} dirPath - Directory path
 * @param {number} daysOld - Delete files older than this many days
 * @returns {Promise<number>} Number of files deleted
 */
async function cleanupOldFiles(dirPath, daysOld) {
  const files = await getFilesInDirectory(dirPath, { recursive: true });
  const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
  let deletedCount = 0;

  for (const file of files) {
    const stats = await fs.stat(file);
    if (stats.mtimeMs < cutoffTime) {
      await deleteFile(file);
      deletedCount++;
    }
  }

  return deletedCount;
}

/**
 * Get directory size
 * @param {string} dirPath - Directory path
 * @returns {Promise<number>} Total size in bytes
 */
async function getDirectorySize(dirPath) {
  const files = await getFilesInDirectory(dirPath, { recursive: true });
  let totalSize = 0;

  for (const file of files) {
    const stats = await fs.stat(file);
    totalSize += stats.size;
  }

  return totalSize;
}

/**
 * Format bytes to human-readable format
 * @param {number} bytes - Bytes
 * @param {number} decimals - Decimal places
 * @returns {string} Formatted string
 */
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];

  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

/**
 * Create hierarchical folder structure for images
 * @param {string} basePath - Base download path
 * @param {string} eventId - Event ID
 * @param {string} userId - User ID
 * @param {string} date - Date (YYYY-MM-DD)
 * @returns {Promise<string>} Full directory path
 */
async function createImageFolderStructure(basePath, eventId, userId, date) {
  const folderPath = path.join(basePath, eventId, userId, date);
  await ensureDirectory(folderPath);
  return folderPath;
}

module.exports = {
  ensureDirectories,
  ensureDirectory,
  getDiskSpace,
  hasEnoughDiskSpace,
  calculateFileHash,
  getFileSize,
  fileExists,
  deleteFile,
  moveFile,
  copyFile,
  getFilesInDirectory,
  cleanupOldFiles,
  getDirectorySize,
  formatBytes,
  createImageFolderStructure
};
