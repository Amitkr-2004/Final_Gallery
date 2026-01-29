/**
 * Configuration IPC Handlers
 * Handles: core:config:*
 */

function registerConfigHandlers(ipcMain, getService) {
  /**
   * Get configuration value
   * Channel: core:config:get
   */
  ipcMain.handle('core:config:get', async (event, key) => {
    const configService = getService('configService');
    return configService.get(key);
  });

  /**
   * Get all configuration
   * Channel: core:config:get-all
   */
  ipcMain.handle('core:config:get-all', async () => {
    const configService = getService('configService');
    return configService.getAll();
  });

  /**
   * Set configuration value (runtime only)
   * Channel: core:config:set
   */
  ipcMain.handle('core:config:set', async (event, key, value) => {
    const configService = getService('configService');
    configService.set(key, value);
    return { success: true };
  });

  /**
   * Get environment
   * Channel: core:config:get-environment
   */
  ipcMain.handle('core:config:get-environment', async () => {
    const configService = getService('configService');
    return configService.getEnvironment();
  });

  /**
   * Check if development
   * Channel: core:config:is-development
   */
  ipcMain.handle('core:config:is-development', async () => {
    const configService = getService('configService');
    return configService.isDevelopment();
  });
}

module.exports = {
  registerConfigHandlers
};
