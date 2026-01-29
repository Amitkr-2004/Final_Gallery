/**
 * IPC Handlers - Simplified
 * Central registration for upload and gallery handlers only
 */

const { ipcMain } = require('electron');
const { registerUploadHandlers } = require('./upload-handlers');
const { registerGalleryHandlers } = require('./gallery-handlers');
const { registerConfigHandlers } = require('./config-handlers');
const { registerSystemHandlers } = require('./system-handlers');

// Service instances
let services = {
  configService: null,
  logger: null
};

/**
 * Initialize services
 * @param {object} serviceInstances - Service instances from main process
 */
function initializeServices(serviceInstances) {
  services = { ...services, ...serviceInstances };
}

/**
 * Get service instance
 * @param {string} serviceName - Service name
 * @returns {object} Service instance
 */
function getService(serviceName) {
  if (!services[serviceName]) {
    throw new Error(`Service not initialized: ${serviceName}`);
  }
  return services[serviceName];
}

/**
 * Register all IPC handlers
 * @param {object} configService - Configuration service
 * @param {object} logger - Logger instance
 */
function registerIPCHandlers(configService, logger) {
  logger.info('Registering IPC handlers...');

  // Initialize base services
  initializeServices({ configService, logger });

  // Register handler modules
  registerUploadHandlers(ipcMain, getService);
  registerGalleryHandlers(ipcMain, getService);
  registerConfigHandlers(ipcMain, getService);
  registerSystemHandlers(ipcMain, getService);

  logger.info('✓ All IPC handlers registered');
}

module.exports = {
  registerIPCHandlers,
  initializeServices,
  getService
};
