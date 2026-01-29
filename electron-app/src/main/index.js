/**
 * Main Electron Entry Point - Simplified
 * Simple local image gallery with upload functionality
 */

const { app, BrowserWindow, protocol } = require('electron');
const path = require('path');
const fs = require('fs');
const { getConfigService } = require('./storage/config');
const { setupLogger } = require('./utils/logger');
const { initializeDatabase } = require('./database/schema');
const { registerIPCHandlers } = require('./ipc/handlers');

// Keep a global reference to prevent garbage collection
let mainWindow = null;
let configService = null;
let logger = null;

/**
 * Register custom protocol for serving local images
 * This allows the renderer to load images using app://uploads/filename.jpg
 */
function registerCustomProtocol() {
  protocol.registerFileProtocol('app', (request, callback) => {
    try {
      // Extract the file path from the URL
      // Format: app://uploads/2026-01-29_image.jpg
      const url = request.url.replace('app://', '');

      // Security: Only allow access to uploads directory
      if (!url.startsWith('uploads/')) {
        logger.warn('Blocked access to non-uploads path', { url });
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      // Get the upload path from config
      const uploadPath = configService.get('storage.uploadPath');

      // Extract filename and decode URL encoding
      const filename = decodeURIComponent(url.replace('uploads/', ''));

      // Build the full file path
      const filePath = path.join(uploadPath, filename);

      // Security: Normalize and verify the path is within uploads directory
      const normalizedPath = path.normalize(filePath);
      const normalizedUploadPath = path.normalize(uploadPath);

      if (!normalizedPath.startsWith(normalizedUploadPath)) {
        logger.warn('Blocked directory traversal attempt', { url, filePath });
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        logger.warn('File not found', { filePath: normalizedPath });
        callback({ error: -6 }); // FILE_NOT_FOUND
        return;
      }

      // Serve the file
      callback({ path: normalizedPath });
    } catch (error) {
      logger.error('Error serving file via custom protocol', { error: error.message, url: request.url });
      callback({ error: -2 }); // FAILED
    }
  });

  logger.info('✓ Custom protocol registered: app://');
}

/**
 * Create the main application window
 */
function createWindow() {
  const config = configService.getAll();

  mainWindow = new BrowserWindow({
    width: config.ui.windowWidth || 1200,
    height: config.ui.windowHeight || 800,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js'),
      sandbox: false
    },
    show: false,
    backgroundColor: '#ffffff'
  });

  // Load the renderer HTML
  if (configService.isDevelopment()) {
    // Development: Load from webpack dev server
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    // Production: Load from built files
    const htmlPath = path.join(__dirname, '../../dist/renderer/index.html');
    mainWindow.loadFile(htmlPath);
  }

  // Show window when ready
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    logger.info('Main window shown');
  });

  // Handle window close
  mainWindow.on('closed', () => {
    mainWindow = null;
    logger.info('Main window closed');
  });

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    require('electron').shell.openExternal(url);
    return { action: 'deny' };
  });

  logger.info('Main window created');
}

/**
 * Initialize the application
 */
async function initializeApp() {
  try {
    console.log('Starting Image Gallery Electron App...');

    // 1. Load configuration
    configService = getConfigService();
    configService.load();
    console.log('✓ Configuration loaded');

    // 2. Setup logger
    logger = setupLogger(configService);
    logger.info('=== Image Gallery Starting ===');
    logger.info(`Environment: ${configService.getEnvironment()}`);

    // 3. Ensure storage directories exist
    const uploadPath = configService.get('storage.uploadPath');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    logger.info('✓ Storage directories verified');

    // 4. Register custom protocol for serving images
    registerCustomProtocol();

    // 5. Initialize database
    initializeDatabase(configService, logger);
    logger.info('✓ Database initialized');

    // 6. Register IPC handlers
    registerIPCHandlers(configService, logger);
    logger.info('✓ IPC handlers registered');

    // 7. Create main window
    createWindow();

    logger.info('=== Application Initialized Successfully ===');
  } catch (error) {
    console.error('Failed to initialize application:', error);

    if (logger) {
      logger.error('Application initialization failed', { error: error.message, stack: error.stack });
    }

    // Show error dialog to user
    const { dialog } = require('electron');
    dialog.showErrorBox(
      'Initialization Error',
      `Failed to start the application:\n\n${error.message}\n\nPlease check the logs for more details.`
    );

    app.quit();
  }
}

/**
 * App Lifecycle Events
 */
app.whenReady().then(initializeApp);

// Quit when all windows are closed (except on macOS)
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

// On macOS, re-create window when dock icon is clicked
app.on('activate', () => {
  if (mainWindow === null) {
    createWindow();
  }
});

// Cleanup on app quit
app.on('before-quit', () => {
  if (logger) {
    logger.info('Application shutting down');
  }

  const { closeDatabase } = require('./database/schema');
  closeDatabase();
});
