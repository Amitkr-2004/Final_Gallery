/**
 * System IPC Handlers
 * Handles: core:system:*
 */

const { app, dialog, shell, Notification } = require('electron');
const path = require('path');
const fs = require('fs').promises;

function registerSystemHandlers(ipcMain, getService) {
  /**
   * Get app version
   * Channel: core:system:get-version
   */
  ipcMain.handle('core:system:get-version', async () => {
    const configService = getService('configService');
    return configService.get('app.version', app.getVersion());
  });

  /**
   * Get app name
   * Channel: core:system:get-app-name
   */
  ipcMain.handle('core:system:get-app-name', async () => {
    const configService = getService('configService');
    return configService.get('app.name', app.getName());
  });

  /**
   * Get system info
   * Channel: core:system:get-info
   */
  ipcMain.handle('core:system:get-info', async () => {
    const os = require('os');

    return {
      platform: process.platform,
      arch: process.arch,
      version: process.version,
      nodeVersion: process.versions.node,
      electronVersion: process.versions.electron,
      chromeVersion: process.versions.chrome,
      totalMemory: os.totalmem(),
      freeMemory: os.freemem(),
      cpus: os.cpus().length,
      hostname: os.hostname(),
      uptime: os.uptime()
    };
  });

  /**
   * Get paths
   * Channel: core:system:get-paths
   */
  ipcMain.handle('core:system:get-paths', async () => {
    const configService = getService('configService');
    const config = configService.getAll();

    return {
      userData: app.getPath('userData'),
      downloads: app.getPath('downloads'),
      documents: app.getPath('documents'),
      appData: app.getPath('appData'),
      temp: app.getPath('temp'),
      logs: config.storage.logsPath,
      database: config.storage.databasePath,
      configuredDownloads: config.storage.downloadPath,
      configuredProcessed: config.storage.processedPath
    };
  });

  /**
   * Open folder in file explorer
   * Channel: core:system:open-folder
   */
  ipcMain.handle('core:system:open-folder', async (event, folderPath) => {
    try {
      await shell.openPath(folderPath);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Open external URL
   * Channel: core:system:open-url
   */
  ipcMain.handle('core:system:open-url', async (event, url) => {
    try {
      await shell.openExternal(url);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  });

  /**
   * Select folder dialog
   * Channel: core:system:select-folder
   */
  ipcMain.handle('core:system:select-folder', async () => {
    const mainWindow = getService('mainWindow');

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Select file dialog
   * Channel: core:system:select-file
   */
  ipcMain.handle('core:system:select-file', async (event, options = {}) => {
    const mainWindow = getService('mainWindow');

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openFile'],
      filters: options.filters || []
    });

    if (result.canceled) {
      return null;
    }

    return result.filePaths[0];
  });

  /**
   * Save file dialog
   * Channel: core:system:save-file
   */
  ipcMain.handle('core:system:save-file', async (event, options = {}) => {
    const mainWindow = getService('mainWindow');

    const result = await dialog.showSaveDialog(mainWindow, {
      defaultPath: options.defaultPath || '',
      filters: options.filters || []
    });

    if (result.canceled) {
      return null;
    }

    return result.filePath;
  });

  /**
   * Show message box
   * Channel: core:system:show-message
   */
  ipcMain.handle('core:system:show-message', async (event, options) => {
    const mainWindow = getService('mainWindow');

    return await dialog.showMessageBox(mainWindow, {
      type: options.type || 'info',
      title: options.title || 'Message',
      message: options.message,
      buttons: options.buttons || ['OK'],
      defaultId: options.defaultId || 0
    });
  });

  /**
   * Show error box
   * Channel: core:system:show-error
   */
  ipcMain.handle('core:system:show-error', async (event, title, content) => {
    dialog.showErrorBox(title, content);
    return { success: true };
  });

  /**
   * Show notification
   * Channel: core:system:show-notification
   */
  ipcMain.handle('core:system:show-notification', async (event, options) => {
    if (!Notification.isSupported()) {
      return { success: false, message: 'Notifications not supported' };
    }

    const notification = new Notification({
      title: options.title,
      body: options.body,
      icon: options.icon
    });

    notification.show();

    return { success: true };
  });

  /**
   * Get logs (recent)
   * Channel: core:system:get-logs
   */
  ipcMain.handle('core:system:get-logs', async (event, limit = 100) => {
    const configService = getService('configService');
    const logsPath = configService.get('storage.logsPath');

    try {
      // Get most recent log file
      const files = await fs.readdir(logsPath);
      const logFiles = files.filter(f => f.startsWith('app-') && f.endsWith('.log'));

      if (logFiles.length === 0) {
        return [];
      }

      // Sort by date (newest first)
      logFiles.sort().reverse();
      const latestLog = path.join(logsPath, logFiles[0]);

      // Read last N lines
      const content = await fs.readFile(latestLog, 'utf-8');
      const lines = content.split('\n').filter(l => l.trim());

      // Return last N lines
      return lines.slice(-limit);

    } catch (error) {
      const logger = getService('logger');
      logger.error('Failed to read logs', { error: error.message });
      return [];
    }
  });

  /**
   * Clear logs
   * Channel: core:system:clear-logs
   */
  ipcMain.handle('core:system:clear-logs', async () => {
    const configService = getService('configService');
    const logger = getService('logger');
    const logsPath = configService.get('storage.logsPath');

    try {
      const files = await fs.readdir(logsPath);
      const logFiles = files.filter(f => f.endsWith('.log'));

      for (const file of logFiles) {
        await fs.unlink(path.join(logsPath, file));
      }

      logger.info('Logs cleared');

      return { success: true, count: logFiles.length };
    } catch (error) {
      logger.error('Failed to clear logs', { error: error.message });
      return { success: false, error: error.message };
    }
  });

  /**
   * Restart app
   * Channel: core:system:restart
   */
  ipcMain.handle('core:system:restart', async () => {
    app.relaunch();
    app.quit();
  });

  /**
   * Quit app
   * Channel: core:system:quit
   */
  ipcMain.handle('core:system:quit', async () => {
    app.quit();
  });
}

module.exports = {
  registerSystemHandlers
};
