/**
 * Enhanced File Manager
 * Comprehensive file system management with thumbnails, cache, cleanup, and deduplication
 */

const fs = require('fs').promises;
const fsSync = require('fs');
const path = require('path');
const crypto = require('crypto');
const sharp = require('sharp');
const { EventEmitter } = require('events');
const { createChildLogger } = require('../utils/logger');
const {
  calculateFileHash,
  getFileSize,
  fileExists,
  deleteFile,
  formatBytes,
  ensureDirectory
} = require('./file-manager');

class FileManager extends EventEmitter {
  constructor(configService, logger) {
    super();

    this.config = configService.getAll();
    this.logger = logger || createChildLogger({ module: 'FileManager' });

    // Cache tracking
    this.thumbnailCache = new Map(); // filePath -> thumbnailPath
    this.fileHashCache = new Map(); // filePath -> md5Hash

    // Deduplication tracking
    this.hashToFiles = new Map(); // md5Hash -> [filePaths]
  }

  /**
   * ========================================
   * FOLDER ORGANIZATION
   * ========================================
   */

  /**
   * Create hierarchical folder structure for images
   * @param {string} basePath - Base path
   * @param {string} eventId - Event ID
   * @param {string} userId - User ID
   * @param {string} date - Date (YYYY-MM-DD)
   * @returns {Promise<string>} Full folder path
   */
  async createImageFolderStructure(basePath, eventId, userId, date) {
    const folderPath = path.join(basePath, eventId, userId, date);
    await ensureDirectory(folderPath);
    return folderPath;
  }

  /**
   * Organize file into proper folder structure
   * @param {string} sourcePath - Source file path
   * @param {object} metadata - File metadata
   * @returns {Promise<string>} New file path
   */
  async organizeFile(sourcePath, metadata) {
    const { eventId, userId, date, filename } = metadata;

    // Create folder structure
    const folderPath = await this.createImageFolderStructure(
      this.config.storage.downloadPath,
      eventId || 'unknown',
      userId || 'unknown',
      date || this.getCurrentDate()
    );

    // Destination path
    const destPath = path.join(folderPath, filename);

    // Move file
    await fs.rename(sourcePath, destPath);

    this.logger.debug('File organized', { sourcePath, destPath });

    return destPath;
  }

  /**
   * Get current date in YYYY-MM-DD format
   * @returns {string} Date
   */
  getCurrentDate() {
    const now = new Date();
    return now.toISOString().split('T')[0];
  }

  /**
   * List all files in event folder
   * @param {string} eventId - Event ID
   * @returns {Promise<Array>} Files
   */
  async listEventFiles(eventId) {
    const eventPath = path.join(this.config.storage.downloadPath, eventId);

    if (!await fileExists(eventPath)) {
      return [];
    }

    return await this.getFilesRecursively(eventPath);
  }

  /**
   * Get files recursively in directory
   * @param {string} dirPath - Directory path
   * @param {object} options - Options
   * @returns {Promise<Array>} Files
   */
  async getFilesRecursively(dirPath, options = {}) {
    const { pattern = null, extensions = null } = options;
    const files = [];

    async function scan(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await scan(fullPath);
        } else {
          // Apply filters
          if (pattern && !entry.name.match(pattern)) {
            continue;
          }

          if (extensions && !extensions.includes(path.extname(entry.name).toLowerCase())) {
            continue;
          }

          files.push(fullPath);
        }
      }
    }

    await scan(dirPath);
    return files;
  }

  /**
   * ========================================
   * THUMBNAIL GENERATION
   * ========================================
   */

  /**
   * Generate thumbnail for image
   * @param {string} imagePath - Source image path
   * @param {object} options - Thumbnail options
   * @returns {Promise<string>} Thumbnail path
   */
  async generateThumbnail(imagePath, options = {}) {
    const {
      width = this.config.processing.thumbnailWidth || 200,
      height = this.config.processing.thumbnailHeight || 200,
      quality = this.config.processing.thumbnailQuality || 80,
      format = 'jpeg'
    } = options;

    try {
      // Check cache first
      const cacheKey = `${imagePath}-${width}x${height}`;
      if (this.thumbnailCache.has(cacheKey)) {
        const cachedPath = this.thumbnailCache.get(cacheKey);
        if (await fileExists(cachedPath)) {
          return cachedPath;
        }
      }

      // Generate thumbnail path
      const thumbnailDir = path.join(this.config.storage.processedPath, 'thumbnails');
      await ensureDirectory(thumbnailDir);

      const filename = path.basename(imagePath, path.extname(imagePath));
      const thumbnailPath = path.join(thumbnailDir, `${filename}_${width}x${height}.${format}`);

      // Check if thumbnail already exists
      if (await fileExists(thumbnailPath)) {
        this.thumbnailCache.set(cacheKey, thumbnailPath);
        return thumbnailPath;
      }

      // Generate thumbnail using sharp
      await sharp(imagePath)
        .resize(width, height, {
          fit: 'cover',
          position: 'center'
        })
        [format]({ quality })
        .toFile(thumbnailPath);

      // Cache thumbnail path
      this.thumbnailCache.set(cacheKey, thumbnailPath);

      this.logger.debug('Thumbnail generated', { imagePath, thumbnailPath });
      this.emit('thumbnail:generated', { imagePath, thumbnailPath });

      return thumbnailPath;

    } catch (error) {
      this.logger.error('Failed to generate thumbnail', {
        imagePath,
        error: error.message
      });
      throw error;
    }
  }

  /**
   * Generate thumbnails for multiple images
   * @param {Array<string>} imagePaths - Image paths
   * @param {object} options - Thumbnail options
   * @returns {Promise<Map>} Map of imagePath -> thumbnailPath
   */
  async generateThumbnailsBatch(imagePaths, options = {}) {
    const thumbnails = new Map();
    const errors = [];

    for (const imagePath of imagePaths) {
      try {
        const thumbnailPath = await this.generateThumbnail(imagePath, options);
        thumbnails.set(imagePath, thumbnailPath);
      } catch (error) {
        errors.push({ imagePath, error: error.message });
      }
    }

    if (errors.length > 0) {
      this.logger.warn('Some thumbnails failed to generate', { count: errors.length });
    }

    return thumbnails;
  }

  /**
   * Delete thumbnail
   * @param {string} imagePath - Image path
   * @param {object} options - Options
   */
  async deleteThumbnail(imagePath, options = {}) {
    const {
      width = this.config.processing.thumbnailWidth || 200,
      height = this.config.processing.thumbnailHeight || 200
    } = options;

    const cacheKey = `${imagePath}-${width}x${height}`;
    const thumbnailPath = this.thumbnailCache.get(cacheKey);

    if (thumbnailPath) {
      await deleteFile(thumbnailPath);
      this.thumbnailCache.delete(cacheKey);
      this.logger.debug('Thumbnail deleted', { thumbnailPath });
    }
  }

  /**
   * ========================================
   * DISK SPACE MONITORING
   * ========================================
   */

  /**
   * Get disk space information
   * @param {string} dirPath - Directory path
   * @returns {Promise<object>} Disk space info
   */
  async getDiskSpace(dirPath) {
    try {
      // Use check-disk-space library for accurate info
      const checkDiskSpace = require('check-disk-space').default;
      const diskSpace = await checkDiskSpace(dirPath);

      return {
        free: diskSpace.free,
        size: diskSpace.size,
        used: diskSpace.size - diskSpace.free,
        percentUsed: ((diskSpace.size - diskSpace.free) / diskSpace.size) * 100
      };
    } catch (error) {
      // Fallback: Use statfs or estimate
      this.logger.warn('check-disk-space not available, using fallback', {
        error: error.message
      });

      // Fallback values (placeholder)
      return {
        free: 100 * 1024 * 1024 * 1024, // 100 GB
        size: 500 * 1024 * 1024 * 1024, // 500 GB
        used: 400 * 1024 * 1024 * 1024, // 400 GB
        percentUsed: 80
      };
    }
  }

  /**
   * Check if enough disk space available
   * @param {string} dirPath - Directory path
   * @param {number} requiredBytes - Required bytes
   * @returns {Promise<boolean>} True if enough space
   */
  async hasEnoughDiskSpace(dirPath, requiredBytes) {
    const diskSpace = await this.getDiskSpace(dirPath);
    const threshold = this.config.performance.diskSpaceThresholdGB * 1024 * 1024 * 1024;

    return diskSpace.free >= (requiredBytes + threshold);
  }

  /**
   * Get directory size
   * @param {string} dirPath - Directory path
   * @returns {Promise<number>} Total size in bytes
   */
  async getDirectorySize(dirPath) {
    let totalSize = 0;

    async function calculateSize(currentPath) {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(currentPath, entry.name);

        if (entry.isDirectory()) {
          await calculateSize(fullPath);
        } else {
          const stats = await fs.stat(fullPath);
          totalSize += stats.size;
        }
      }
    }

    if (await fileExists(dirPath)) {
      await calculateSize(dirPath);
    }

    return totalSize;
  }

  /**
   * Monitor disk space and emit warnings
   */
  async monitorDiskSpace() {
    const downloadPath = this.config.storage.downloadPath;
    const diskSpace = await this.getDiskSpace(downloadPath);
    const thresholdGB = this.config.performance.diskSpaceThresholdGB;

    if (diskSpace.free < (thresholdGB * 1024 * 1024 * 1024)) {
      this.logger.warn('Low disk space', {
        free: formatBytes(diskSpace.free),
        threshold: `${thresholdGB} GB`
      });

      this.emit('disk-space:low', {
        free: diskSpace.free,
        threshold: thresholdGB * 1024 * 1024 * 1024
      });
    }

    return diskSpace;
  }

  /**
   * ========================================
   * CACHE MANAGEMENT
   * ========================================
   */

  /**
   * Clear thumbnail cache
   */
  clearThumbnailCache() {
    this.thumbnailCache.clear();
    this.logger.info('Thumbnail cache cleared');
  }

  /**
   * Clear file hash cache
   */
  clearFileHashCache() {
    this.fileHashCache.clear();
    this.logger.info('File hash cache cleared');
  }

  /**
   * Get cached file hash
   * @param {string} filePath - File path
   * @returns {Promise<string|null>} Cached hash or null
   */
  async getCachedFileHash(filePath) {
    if (this.fileHashCache.has(filePath)) {
      // Verify file hasn't changed
      const stats = await fs.stat(filePath);
      const cached = this.fileHashCache.get(filePath);

      if (stats.mtime.getTime() === cached.mtime) {
        return cached.hash;
      }
    }

    return null;
  }

  /**
   * Cache file hash
   * @param {string} filePath - File path
   * @param {string} hash - MD5 hash
   */
  async cacheFileHash(filePath, hash) {
    const stats = await fs.stat(filePath);

    this.fileHashCache.set(filePath, {
      hash,
      mtime: stats.mtime.getTime()
    });
  }

  /**
   * Delete all thumbnails
   * @returns {Promise<number>} Number of thumbnails deleted
   */
  async deleteAllThumbnails() {
    const thumbnailDir = path.join(this.config.storage.processedPath, 'thumbnails');

    if (!await fileExists(thumbnailDir)) {
      return 0;
    }

    const files = await this.getFilesRecursively(thumbnailDir);

    for (const file of files) {
      await deleteFile(file);
    }

    this.clearThumbnailCache();

    this.logger.info('All thumbnails deleted', { count: files.length });

    return files.length;
  }

  /**
   * ========================================
   * CLEANUP POLICIES
   * ========================================
   */

  /**
   * Clean up old files
   * @param {string} dirPath - Directory path
   * @param {number} daysOld - Delete files older than this
   * @returns {Promise<object>} Cleanup result
   */
  async cleanupOldFiles(dirPath, daysOld) {
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    let deletedCount = 0;
    let freedBytes = 0;

    const files = await this.getFilesRecursively(dirPath);

    for (const file of files) {
      try {
        const stats = await fs.stat(file);

        if (stats.mtimeMs < cutoffTime) {
          const size = stats.size;
          await deleteFile(file);
          deletedCount++;
          freedBytes += size;

          this.logger.debug('Old file deleted', { file, age: daysOld });
        }
      } catch (error) {
        this.logger.error('Failed to delete old file', {
          file,
          error: error.message
        });
      }
    }

    this.logger.info('Cleanup completed', {
      deletedCount,
      freedBytes: formatBytes(freedBytes)
    });

    this.emit('cleanup:completed', { deletedCount, freedBytes });

    return { deletedCount, freedBytes };
  }

  /**
   * Clean up temporary files
   * @returns {Promise<number>} Number of files deleted
   */
  async cleanupTempFiles() {
    const tempPath = this.config.storage.tempPath;

    if (!tempPath || !await fileExists(tempPath)) {
      return 0;
    }

    const files = await this.getFilesRecursively(tempPath);
    let deletedCount = 0;

    for (const file of files) {
      // Delete .tmp files and files older than 24 hours
      if (file.endsWith('.tmp')) {
        await deleteFile(file);
        deletedCount++;
      } else {
        const stats = await fs.stat(file);
        const ageHours = (Date.now() - stats.mtimeMs) / (1000 * 60 * 60);

        if (ageHours > 24) {
          await deleteFile(file);
          deletedCount++;
        }
      }
    }

    this.logger.info('Temp files cleaned up', { deletedCount });

    return deletedCount;
  }

  /**
   * Run scheduled cleanup
   * @returns {Promise<object>} Cleanup result
   */
  async runScheduledCleanup() {
    this.logger.info('Running scheduled cleanup...');

    const results = {
      oldFilesDeleted: 0,
      tempFilesDeleted: 0,
      thumbnailsDeleted: 0,
      totalFreedBytes: 0
    };

    // Clean up old files
    if (this.config.performance.cleanupOldFilesAfterDays > 0) {
      const oldFilesResult = await this.cleanupOldFiles(
        this.config.storage.downloadPath,
        this.config.performance.cleanupOldFilesAfterDays
      );

      results.oldFilesDeleted = oldFilesResult.deletedCount;
      results.totalFreedBytes += oldFilesResult.freedBytes;
    }

    // Clean up temp files
    results.tempFilesDeleted = await this.cleanupTempFiles();

    // Clean up old thumbnails (30 days)
    const thumbnailDir = path.join(this.config.storage.processedPath, 'thumbnails');
    if (await fileExists(thumbnailDir)) {
      const thumbnailResult = await this.cleanupOldFiles(thumbnailDir, 30);
      results.thumbnailsDeleted = thumbnailResult.deletedCount;
      results.totalFreedBytes += thumbnailResult.freedBytes;
    }

    this.logger.info('Scheduled cleanup completed', results);
    this.emit('cleanup:scheduled', results);

    return results;
  }

  /**
   * ========================================
   * FILE DEDUPLICATION
   * ========================================
   */

  /**
   * Find duplicate files
   * @param {string} dirPath - Directory path
   * @returns {Promise<Map>} Map of hash -> [filePaths]
   */
  async findDuplicateFiles(dirPath) {
    const files = await this.getFilesRecursively(dirPath);
    const hashToFiles = new Map();

    for (const file of files) {
      try {
        // Check cache first
        let hash = await this.getCachedFileHash(file);

        if (!hash) {
          hash = await calculateFileHash(file);
          await this.cacheFileHash(file, hash);
        }

        if (!hashToFiles.has(hash)) {
          hashToFiles.set(hash, []);
        }

        hashToFiles.get(hash).push(file);
      } catch (error) {
        this.logger.error('Failed to hash file', {
          file,
          error: error.message
        });
      }
    }

    // Filter to only duplicates (hash with > 1 file)
    const duplicates = new Map();
    for (const [hash, filePaths] of hashToFiles.entries()) {
      if (filePaths.length > 1) {
        duplicates.set(hash, filePaths);
      }
    }

    this.logger.info('Duplicate scan completed', {
      totalFiles: files.length,
      uniqueHashes: hashToFiles.size,
      duplicateGroups: duplicates.size
    });

    return duplicates;
  }

  /**
   * Remove duplicate files (keep first, delete rest)
   * @param {string} dirPath - Directory path
   * @param {object} options - Options
   * @returns {Promise<object>} Deduplication result
   */
  async deduplicateFiles(dirPath, options = {}) {
    const { keepStrategy = 'first' } = options;

    const duplicates = await this.findDuplicateFiles(dirPath);
    let deletedCount = 0;
    let freedBytes = 0;

    for (const [hash, filePaths] of duplicates.entries()) {
      // Determine which file to keep
      let keepIndex = 0;

      if (keepStrategy === 'newest') {
        // Keep newest file
        let newestTime = 0;
        for (let i = 0; i < filePaths.length; i++) {
          const stats = await fs.stat(filePaths[i]);
          if (stats.mtimeMs > newestTime) {
            newestTime = stats.mtimeMs;
            keepIndex = i;
          }
        }
      } else if (keepStrategy === 'oldest') {
        // Keep oldest file
        let oldestTime = Infinity;
        for (let i = 0; i < filePaths.length; i++) {
          const stats = await fs.stat(filePaths[i]);
          if (stats.mtimeMs < oldestTime) {
            oldestTime = stats.mtimeMs;
            keepIndex = i;
          }
        }
      }

      // Delete duplicates
      for (let i = 0; i < filePaths.length; i++) {
        if (i !== keepIndex) {
          const file = filePaths[i];
          const size = await getFileSize(file);

          await deleteFile(file);
          deletedCount++;
          freedBytes += size;

          this.logger.debug('Duplicate file deleted', { file, hash });
        }
      }
    }

    this.logger.info('Deduplication completed', {
      deletedCount,
      freedBytes: formatBytes(freedBytes)
    });

    this.emit('deduplication:completed', { deletedCount, freedBytes });

    return { deletedCount, freedBytes };
  }

  /**
   * ========================================
   * FILE OPERATIONS
   * ========================================
   */

  /**
   * Move file to trash (recoverable delete)
   * @param {string} filePath - File path
   */
  async moveToTrash(filePath) {
    const trashDir = path.join(this.config.storage.basePath, '.trash');
    await ensureDirectory(trashDir);

    const filename = path.basename(filePath);
    const timestamp = Date.now();
    const trashPath = path.join(trashDir, `${timestamp}-${filename}`);

    await fs.rename(filePath, trashPath);

    this.logger.info('File moved to trash', { filePath, trashPath });
    this.emit('file:trashed', { filePath, trashPath });

    return trashPath;
  }

  /**
   * Empty trash
   * @returns {Promise<number>} Number of files deleted
   */
  async emptyTrash() {
    const trashDir = path.join(this.config.storage.basePath, '.trash');

    if (!await fileExists(trashDir)) {
      return 0;
    }

    const files = await this.getFilesRecursively(trashDir);

    for (const file of files) {
      await deleteFile(file);
    }

    this.logger.info('Trash emptied', { count: files.length });

    return files.length;
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage stats
   */
  async getStorageStatistics() {
    const downloadSize = await this.getDirectorySize(this.config.storage.downloadPath);
    const processedSize = await this.getDirectorySize(this.config.storage.processedPath);
    const diskSpace = await this.getDiskSpace(this.config.storage.basePath);

    return {
      downloadSize,
      processedSize,
      totalUsed: downloadSize + processedSize,
      diskSpace,
      formatted: {
        downloadSize: formatBytes(downloadSize),
        processedSize: formatBytes(processedSize),
        totalUsed: formatBytes(downloadSize + processedSize),
        diskFree: formatBytes(diskSpace.free),
        diskSize: formatBytes(diskSpace.size)
      }
    };
  }
}

/**
 * Create file manager instance
 * @param {object} configService - Configuration service
 * @param {object} logger - Logger instance
 * @returns {FileManager} File manager
 */
function createFileManager(configService, logger) {
  return new FileManager(configService, logger);
}

module.exports = {
  FileManager,
  createFileManager
};
