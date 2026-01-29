/**
 * Storage Monitor
 * Monitors disk space, runs scheduled cleanup, and maintains storage health
 */

const { EventEmitter } = require('events');
const { createChildLogger } = require('../utils/logger');
const { createFileManager } = require('./enhanced-file-manager');

class StorageMonitor extends EventEmitter {
  constructor(configService, logger) {
    super();

    this.config = configService.getAll();
    this.logger = logger || createChildLogger({ module: 'StorageMonitor' });

    // File manager
    this.fileManager = createFileManager(configService, logger);

    // Monitoring state
    this.isMonitoring = false;
    this.monitorInterval = null;
    this.cleanupInterval = null;

    // Forward file manager events
    this.setupEventForwarding();
  }

  /**
   * Setup event forwarding from file manager
   */
  setupEventForwarding() {
    this.fileManager.on('disk-space:low', (data) => {
      this.emit('disk-space:low', data);
      this.handleLowDiskSpace(data);
    });

    this.fileManager.on('cleanup:completed', (data) => {
      this.emit('cleanup:completed', data);
    });

    this.fileManager.on('deduplication:completed', (data) => {
      this.emit('deduplication:completed', data);
    });
  }

  /**
   * ========================================
   * MONITORING LIFECYCLE
   * ========================================
   */

  /**
   * Start monitoring
   * @param {object} options - Monitoring options
   */
  startMonitoring(options = {}) {
    if (this.isMonitoring) {
      this.logger.warn('Storage monitor already running');
      return;
    }

    const {
      diskSpaceCheckIntervalMinutes = 5,
      cleanupIntervalHours = 24
    } = options;

    this.isMonitoring = true;

    // Disk space monitoring
    this.monitorInterval = setInterval(async () => {
      try {
        await this.checkDiskSpace();
      } catch (error) {
        this.logger.error('Disk space check failed', { error: error.message });
      }
    }, diskSpaceCheckIntervalMinutes * 60 * 1000);

    // Scheduled cleanup
    this.cleanupInterval = setInterval(async () => {
      try {
        await this.runScheduledCleanup();
      } catch (error) {
        this.logger.error('Scheduled cleanup failed', { error: error.message });
      }
    }, cleanupIntervalHours * 60 * 60 * 1000);

    // Run initial checks
    setTimeout(() => {
      this.checkDiskSpace().catch(err => {
        this.logger.error('Initial disk space check failed', { error: err.message });
      });
    }, 5000);

    this.logger.info('Storage monitor started', {
      diskSpaceCheckIntervalMinutes,
      cleanupIntervalHours
    });

    this.emit('monitor:started');
  }

  /**
   * Stop monitoring
   */
  stopMonitoring() {
    if (!this.isMonitoring) {
      return;
    }

    if (this.monitorInterval) {
      clearInterval(this.monitorInterval);
      this.monitorInterval = null;
    }

    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }

    this.isMonitoring = false;

    this.logger.info('Storage monitor stopped');
    this.emit('monitor:stopped');
  }

  /**
   * ========================================
   * MONITORING TASKS
   * ========================================
   */

  /**
   * Check disk space
   */
  async checkDiskSpace() {
    const diskSpace = await this.fileManager.monitorDiskSpace();

    this.emit('disk-space:checked', diskSpace);

    return diskSpace;
  }

  /**
   * Run scheduled cleanup
   */
  async runScheduledCleanup() {
    this.logger.info('Running scheduled cleanup...');

    const results = await this.fileManager.runScheduledCleanup();

    this.emit('cleanup:scheduled', results);

    return results;
  }

  /**
   * Handle low disk space
   * @param {object} data - Disk space data
   */
  async handleLowDiskSpace(data) {
    this.logger.warn('Low disk space detected, running emergency cleanup', data);

    try {
      // Run aggressive cleanup
      const results = await this.fileManager.runScheduledCleanup();

      // If still low, try deduplication
      const diskSpace = await this.checkDiskSpace();
      const thresholdBytes = this.config.performance.diskSpaceThresholdGB * 1024 * 1024 * 1024;

      if (diskSpace.free < thresholdBytes) {
        this.logger.info('Running deduplication to free space');

        await this.fileManager.deduplicateFiles(
          this.config.storage.downloadPath,
          { keepStrategy: 'first' }
        );
      }

      this.emit('emergency-cleanup:completed', results);

    } catch (error) {
      this.logger.error('Emergency cleanup failed', { error: error.message });
    }
  }

  /**
   * ========================================
   * MANUAL OPERATIONS
   * ========================================
   */

  /**
   * Run manual cleanup
   * @returns {Promise<object>} Cleanup result
   */
  async runManualCleanup() {
    return await this.fileManager.runScheduledCleanup();
  }

  /**
   * Find and remove duplicates
   * @param {object} options - Options
   * @returns {Promise<object>} Deduplication result
   */
  async deduplicateStorage(options = {}) {
    return await this.fileManager.deduplicateFiles(
      this.config.storage.downloadPath,
      options
    );
  }

  /**
   * Get storage statistics
   * @returns {Promise<object>} Storage stats
   */
  async getStorageStatistics() {
    return await this.fileManager.getStorageStatistics();
  }

  /**
   * Delete all thumbnails
   * @returns {Promise<number>} Number deleted
   */
  async deleteAllThumbnails() {
    return await this.fileManager.deleteAllThumbnails();
  }

  /**
   * Empty trash
   * @returns {Promise<number>} Number deleted
   */
  async emptyTrash() {
    return await this.fileManager.emptyTrash();
  }

  /**
   * ========================================
   * HEALTH CHECK
   * ========================================
   */

  /**
   * Run comprehensive health check
   * @returns {Promise<object>} Health status
   */
  async runHealthCheck() {
    this.logger.info('Running storage health check...');

    const stats = await this.getStorageStatistics();
    const diskSpace = await this.checkDiskSpace();

    const thresholdBytes = this.config.performance.diskSpaceThresholdGB * 1024 * 1024 * 1024;

    const health = {
      healthy: diskSpace.free > thresholdBytes,
      diskSpace,
      storage: stats,
      warnings: []
    };

    // Check for warnings
    if (diskSpace.free < thresholdBytes) {
      health.warnings.push({
        type: 'low-disk-space',
        message: `Disk space below threshold (${this.config.performance.diskSpaceThresholdGB} GB)`,
        severity: 'high'
      });
    }

    if (diskSpace.percentUsed > 90) {
      health.warnings.push({
        type: 'disk-nearly-full',
        message: 'Disk is more than 90% full',
        severity: 'critical'
      });
    }

    if (stats.downloadSize > (50 * 1024 * 1024 * 1024)) {
      health.warnings.push({
        type: 'large-download-folder',
        message: 'Download folder exceeds 50 GB',
        severity: 'medium'
      });
    }

    this.logger.info('Health check completed', {
      healthy: health.healthy,
      warnings: health.warnings.length
    });

    this.emit('health-check:completed', health);

    return health;
  }

  /**
   * ========================================
   * UTILITIES
   * ========================================
   */

  /**
   * Get monitoring status
   * @returns {object} Status
   */
  getStatus() {
    return {
      isMonitoring: this.isMonitoring,
      hasMonitorInterval: this.monitorInterval !== null,
      hasCleanupInterval: this.cleanupInterval !== null
    };
  }

  /**
   * Get file manager instance
   * @returns {FileManager} File manager
   */
  getFileManager() {
    return this.fileManager;
  }
}

/**
 * Create storage monitor instance
 * @param {object} configService - Configuration service
 * @param {object} logger - Logger instance
 * @returns {StorageMonitor} Storage monitor
 */
function createStorageMonitor(configService, logger) {
  return new StorageMonitor(configService, logger);
}

module.exports = {
  StorageMonitor,
  createStorageMonitor
};
