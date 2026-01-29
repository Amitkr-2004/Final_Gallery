/**
 * Sync Manager
 * Orchestrates synchronization between GCS, local storage, and processing
 * Manages the complete sync workflow
 */

const { EventEmitter } = require('events');
const { createChildLogger } = require('../utils/logger');
const { createDownloadManager } = require('../gcp/downloader');
const {
  createSyncStatus,
  updateSyncStatus,
  getLatestSyncStatus
} = require('../database/queries');

class SyncManager extends EventEmitter {
  constructor(configService, logger) {
    super();

    this.config = configService.getAll();
    this.logger = logger || createChildLogger({ module: 'SyncManager' });

    // Download manager
    this.downloadManager = createDownloadManager(configService, logger);

    // State
    this.currentSyncId = null;
    this.isInitialized = false;

    // Setup event forwarding
    this.setupEventForwarding();
  }

  /**
   * Initialize sync manager
   */
  async initialize() {
    if (this.isInitialized) {
      return;
    }

    try {
      await this.downloadManager.initialize();

      this.isInitialized = true;
      this.logger.info('Sync manager initialized');
    } catch (error) {
      this.logger.error('Failed to initialize sync manager', { error: error.message });
      throw error;
    }
  }

  /**
   * Setup event forwarding from download manager
   */
  setupEventForwarding() {
    // Forward download events
    this.downloadManager.on('sync:started', (data) => this.emit('sync:started', data));
    this.downloadManager.on('sync:listing-files', () => this.emit('sync:listing-files'));
    this.downloadManager.on('sync:requesting-urls', (data) => this.emit('sync:requesting-urls', data));
    this.downloadManager.on('sync:downloading', (data) => this.emit('sync:downloading', data));
    this.downloadManager.on('sync:completed', (data) => this.emit('sync:completed', data));
    this.downloadManager.on('sync:failed', (data) => this.emit('sync:failed', data));
    this.downloadManager.on('sync:paused', (data) => this.emit('sync:paused', data));
    this.downloadManager.on('sync:resumed', (data) => this.emit('sync:resumed', data));
    this.downloadManager.on('sync:cancelled', (data) => this.emit('sync:cancelled', data));

    this.downloadManager.on('download:progress', (data) => this.emit('download:progress', data));
    this.downloadManager.on('download:completed', (data) => this.emit('download:completed', data));
    this.downloadManager.on('download:failed', (data) => this.emit('download:failed', data));
  }

  /**
   * ========================================
   * SYNC OPERATIONS
   * ========================================
   */

  /**
   * Start full sync
   * @param {object} options - Sync options
   * @returns {Promise<object>} Sync result
   */
  async startFullSync(options = {}) {
    this.ensureInitialized();

    try {
      // Create sync status record
      this.currentSyncId = createSyncStatus('full', 0);

      this.logger.info('Starting full sync', options);

      // Start download sync
      const result = await this.downloadManager.startSync(options);

      // Update sync status
      updateSyncStatus(this.currentSyncId, {
        status: 'completed',
        completed_items: result.downloadedFiles,
        failed_items: result.failedFiles,
        metadata: result
      });

      this.currentSyncId = null;

      return result;

    } catch (error) {
      // Update sync status
      if (this.currentSyncId) {
        updateSyncStatus(this.currentSyncId, {
          status: 'failed',
          error_message: error.message
        });
      }

      this.currentSyncId = null;
      throw error;
    }
  }

  /**
   * Start download-only sync
   * @param {object} options - Sync options
   * @returns {Promise<object>} Sync result
   */
  async startDownloadSync(options = {}) {
    this.ensureInitialized();

    try {
      this.currentSyncId = createSyncStatus('download', 0);

      const result = await this.downloadManager.startSync(options);

      updateSyncStatus(this.currentSyncId, {
        status: 'completed',
        completed_items: result.downloadedFiles,
        failed_items: result.failedFiles,
        metadata: result
      });

      this.currentSyncId = null;

      return result;

    } catch (error) {
      if (this.currentSyncId) {
        updateSyncStatus(this.currentSyncId, {
          status: 'failed',
          error_message: error.message
        });
      }

      this.currentSyncId = null;
      throw error;
    }
  }

  /**
   * Pause current sync
   */
  pauseSync() {
    this.ensureInitialized();

    this.downloadManager.pauseSync();

    if (this.currentSyncId) {
      updateSyncStatus(this.currentSyncId, {
        status: 'paused'
      });
    }
  }

  /**
   * Resume paused sync
   */
  resumeSync() {
    this.ensureInitialized();

    this.downloadManager.resumeSync();

    if (this.currentSyncId) {
      updateSyncStatus(this.currentSyncId, {
        status: 'running'
      });
    }
  }

  /**
   * Cancel current sync
   */
  async cancelSync() {
    this.ensureInitialized();

    await this.downloadManager.cancelSync();

    if (this.currentSyncId) {
      updateSyncStatus(this.currentSyncId, {
        status: 'cancelled'
      });
      this.currentSyncId = null;
    }
  }

  /**
   * ========================================
   * SCHEDULED SYNC
   * ========================================
   */

  /**
   * Start auto-sync (scheduled)
   */
  startAutoSync() {
    if (!this.config.sync.autoSyncEnabled) {
      this.logger.warn('Auto-sync is disabled in configuration');
      return;
    }

    const intervalMs = this.config.sync.syncIntervalMinutes * 60 * 1000;

    this.autoSyncInterval = setInterval(async () => {
      try {
        this.logger.info('Running scheduled sync');
        await this.startFullSync();
      } catch (error) {
        this.logger.error('Scheduled sync failed', { error: error.message });
      }
    }, intervalMs);

    // Run initial sync if configured
    if (this.config.sync.syncOnStartup) {
      setTimeout(() => {
        this.startFullSync().catch(error => {
          this.logger.error('Initial sync failed', { error: error.message });
        });
      }, 5000); // 5 second delay
    }

    this.logger.info('Auto-sync started', { intervalMinutes: this.config.sync.syncIntervalMinutes });
  }

  /**
   * Stop auto-sync
   */
  stopAutoSync() {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
      this.autoSyncInterval = null;
      this.logger.info('Auto-sync stopped');
    }
  }

  /**
   * ========================================
   * STATUS & STATISTICS
   * ========================================
   */

  /**
   * Get current sync status
   * @returns {object} Status
   */
  getStatus() {
    return {
      isInitialized: this.isInitialized,
      currentSyncId: this.currentSyncId,
      downloadStatus: this.downloadManager.getStatus(),
      lastSync: this.getLastSyncInfo()
    };
  }

  /**
   * Get last sync information
   * @returns {object|null} Last sync info
   */
  getLastSyncInfo() {
    try {
      const lastDownloadSync = getLatestSyncStatus('download');
      const lastFullSync = getLatestSyncStatus('full');

      // Return most recent
      if (!lastDownloadSync && !lastFullSync) {
        return null;
      }

      if (!lastDownloadSync) return lastFullSync;
      if (!lastFullSync) return lastDownloadSync;

      return lastDownloadSync.started_at > lastFullSync.started_at
        ? lastDownloadSync
        : lastFullSync;

    } catch (error) {
      this.logger.error('Failed to get last sync info', { error: error.message });
      return null;
    }
  }

  /**
   * Get sync statistics
   * @returns {object} Statistics
   */
  getStatistics() {
    return {
      download: this.downloadManager.getStats(),
      lastSync: this.getLastSyncInfo()
    };
  }

  /**
   * ========================================
   * UTILITIES
   * ========================================
   */

  /**
   * Ensure sync manager is initialized
   */
  ensureInitialized() {
    if (!this.isInitialized) {
      throw new Error('Sync manager not initialized. Call initialize() first.');
    }
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup() {
    this.stopAutoSync();

    if (this.downloadManager) {
      await this.downloadManager.cleanup();
      await this.downloadManager.disconnect();
    }

    this.logger.info('Sync manager cleaned up');
  }
}

/**
 * Create sync manager instance
 * @param {object} configService - Configuration service
 * @param {object} logger - Logger instance
 * @returns {SyncManager} Sync manager
 */
function createSyncManager(configService, logger) {
  return new SyncManager(configService, logger);
}

module.exports = {
  SyncManager,
  createSyncManager
};
