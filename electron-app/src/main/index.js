/**
 * Main Electron Entry Point - Simplified
 * Simple local image gallery with upload functionality
 */

// Load environment variables from .env file
require('dotenv').config();

const { app, BrowserWindow, protocol, Tray, Menu, nativeImage, net } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const { getConfigService } = require('./storage/config');
const { setupLogger } = require('./utils/logger');
const { initializeDatabase, getDatabase } = require('./database/schema');
const { registerIPCHandlers } = require('./ipc/handlers');

// Register custom protocol as privileged BEFORE app is ready
// This is required for Electron 25+ to allow file:// like access
protocol.registerSchemesAsPrivileged([
  {
    scheme: 'app',
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      stream: true,
      bypassCSP: false
    }
  }
]);

// Keep a global reference to prevent garbage collection
let mainWindow = null;
let tray = null;
let configService = null;
let logger = null;

/**
 * Register custom protocol for serving local images
 * This allows the renderer to load images using app://uploads/filename.jpg
 * Uses the modern protocol.handle API (Electron 25+)
 */
function registerCustomProtocol() {
  protocol.handle('app', async (request) => {
    try {
      // Extract the file path from the URL
      // Format: app://uploads/2026-01-29_image.jpg
      const url = new URL(request.url);
      const pathname = url.hostname + url.pathname;

      // Debug logging
      logger.info('📷 Protocol request', { requestUrl: request.url, hostname: url.hostname, pathname: url.pathname, combined: pathname });

      // Security: Only allow access to uploads directory
      if (!pathname.startsWith('uploads')) {
        logger.warn('Blocked access to non-uploads path', { pathname });
        return new Response('Not Found', { status: 404 });
      }

      // Get the upload path from config
      const uploadPath = configService.get('storage.uploadPath');

      // Extract filename and decode URL encoding
      // pathname is like "uploads/filename.jpg" or just the filename after "uploads/"
      const filename = decodeURIComponent(pathname.replace(/^uploads\/?/, ''));

      // Build the full file path
      const filePath = path.join(uploadPath, filename);

      // Security: Normalize and verify the path is within uploads directory
      const normalizedPath = path.normalize(filePath);
      const normalizedUploadPath = path.normalize(uploadPath);

      if (!normalizedPath.startsWith(normalizedUploadPath)) {
        logger.warn('Blocked directory traversal attempt', { pathname, filePath });
        return new Response('Forbidden', { status: 403 });
      }

      // Check if file exists
      if (!fs.existsSync(normalizedPath)) {
        logger.warn('File not found', { filePath: normalizedPath });
        return new Response('Not Found', { status: 404 });
      }

      // Use net.fetch with file:// URL to serve the file (recommended approach in Electron 25+)
      const fileUrl = pathToFileURL(normalizedPath).href;
      logger.info('✅ Serving file via net.fetch', { filePath: normalizedPath, fileUrl });

      return net.fetch(fileUrl);
    } catch (error) {
      logger.error('Error serving file via custom protocol', { error: error.message, url: request.url });
      return new Response('Internal Server Error', { status: 500 });
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

  // Minimize to tray instead of closing
  mainWindow.on('close', (event) => {
    if (!app.isQuitting) {
      event.preventDefault();
      mainWindow.hide();

      // Update tray menu
      if (tray) {
        updateTrayMenu();
      }

      logger.info('Main window minimized to tray');
      return false;
    }
  });

  // Handle window closed
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
 * Create system tray icon
 */
function createTray() {
  // Create a simple 16x16 icon - using a basic approach that works on all platforms
  // Create buffer for a 16x16 RGBA image
  const size = 16;
  const buffer = Buffer.alloc(size * size * 4);

  // Fill with green color (RGBA)
  for (let i = 0; i < size * size; i++) {
    const offset = i * 4;
    // Draw a green square
    buffer[offset] = 76;      // R
    buffer[offset + 1] = 175; // G
    buffer[offset + 2] = 80;  // B
    buffer[offset + 3] = 255; // A (full opacity)
  }

  const icon = nativeImage.createFromBuffer(buffer, {
    width: size,
    height: size
  });

  tray = new Tray(icon);
  tray.setToolTip('Image Gallery - Online');

  updateTrayMenu();

  // Click to show/hide window
  tray.on('click', () => {
    if (mainWindow) {
      if (mainWindow.isVisible()) {
        mainWindow.hide();
      } else {
        mainWindow.show();
        mainWindow.focus();
      }
    }
  });

  logger.info('System tray created');
}

/**
 * Update tray context menu
 */
function updateTrayMenu() {
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Image Gallery',
      enabled: false
    },
    {
      type: 'separator'
    },
    {
      label: mainWindow && mainWindow.isVisible() ? 'Hide Window' : 'Show Window',
      click: () => {
        if (mainWindow) {
          if (mainWindow.isVisible()) {
            mainWindow.hide();
          } else {
            mainWindow.show();
            mainWindow.focus();
          }
          updateTrayMenu();
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Upload Files',
      click: async () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/upload');
        }
      }
    },
    {
      label: 'View Gallery',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/gallery');
        }
      }
    },
    {
      label: 'Dashboard',
      click: () => {
        if (mainWindow) {
          mainWindow.show();
          mainWindow.focus();
          mainWindow.webContents.send('navigate-to', '/dashboard');
        }
      }
    },
    {
      type: 'separator'
    },
    {
      label: 'Quit',
      click: () => {
        app.isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
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
    const db = initializeDatabase(configService, logger);
    logger.info('✓ Database initialized');

    // 6. Initialize face detection services (REAL ML models - face-api.js)
    try {
      const { initialize: initializeFaceDetection } = require('./services/face-detection');
      const { initialize: initializeFaceClustering } = require('./services/face-clustering');
      const { initialize: initializeFaceProcessing } = require('./services/face-processing');
      const { initialize: initializeGCPDataPrep } = require('./services/gcp-data-preparation');

      // Initialize real face detection with ML models
      const faceDetectionLoaded = await initializeFaceDetection(logger);

      if (faceDetectionLoaded) {
        logger.info('✓ Real face detection initialized with ML models');
      } else {
        logger.warn('Face detection models not loaded - run: node scripts/download-face-models.js');
      }

      initializeFaceClustering(db, logger);
      initializeFaceProcessing(db, logger);
      initializeGCPDataPrep(db, logger, configService);
      logger.info('✓ Face detection services initialized');
    } catch (error) {
      logger.error('Face detection initialization failed', { error: error.message });
      logger.info('Face detection will be disabled');
    }

    // 6b. Initialize GCS upload service (optional - only if credentials are configured)
    try {
      const { initialize: initializeGCSUpload } = require('./services/gcs-upload');
      const result = await initializeGCSUpload(db, logger);

      if (result.success) {
        logger.info('✓ GCS upload service initialized');
      } else {
        logger.info('GCS upload service disabled (no credentials configured)');
      }
    } catch (error) {
      logger.warn('GCS upload initialization skipped', { error: error.message });
      logger.info('GCS upload will be disabled - configure gcp-service-account.json to enable');
    }

    // 6c. Initialize face scanner service
    try {
      const { initialize: initializeFaceScanner } = require('./services/face-scanner');
      initializeFaceScanner(logger);
      logger.info('✓ Face scanner service initialized');
    } catch (error) {
      logger.warn('Face scanner initialization skipped', { error: error.message });
      logger.info('Face scanner will be disabled');
    }

    // 7. Register IPC handlers
    registerIPCHandlers(configService, logger);
    logger.info('✓ IPC handlers registered');

    // 8. Auto-process pending images on startup
    setTimeout(async () => {
      try {
        const faceProcessing = require('./services/face-processing');
        const gcsUpload = require('./services/gcs-upload');

        const pendingImages = db.prepare(`
          SELECT COUNT(*) as count FROM images
          WHERE processing_status = 'pending' OR processing_status IS NULL
        `).get();

        if (pendingImages && pendingImages.count > 0) {
          logger.info('🔄 Auto-processing pending images...', { count: pendingImages.count });

          const result = await faceProcessing.batchProcessImages();
          logger.info('✓ Auto-processing complete', result);

          // Wait for processing to complete before syncing
          await new Promise(resolve => setTimeout(resolve, 2000));
        } else {
          logger.info('No pending images to process');
        }

        // Always check for unsynced images and sync them
        if (gcsUpload.isReady()) {
          const unsyncedImages = db.prepare(`
            SELECT COUNT(*) as count FROM images
            WHERE processing_status = 'completed' AND (sync_status IS NULL OR sync_status = 'pending' OR sync_status = 'uploading')
          `).get();

          if (unsyncedImages && unsyncedImages.count > 0) {
            logger.info('🔄 Auto-syncing unsynced images to GCS...', { count: unsyncedImages.count });

            const batchSyncResult = await gcsUpload.batchSync();
            logger.info('✓ Images auto-synced', batchSyncResult.stats);

            // Also sync collections
            const syncResult = await gcsUpload.syncAllCollections();
            logger.info('✓ Collections auto-synced', syncResult.stats);
          } else {
            logger.info('All images already synced to GCS');
          }
        } else {
          logger.info('GCS not ready, skipping auto-sync');
        }
      } catch (error) {
        logger.error('Auto-processing/sync failed', { error: error.message, stack: error.stack });
      }
    }, 5000); // Wait 5 seconds after startup

    // 8. Create main window
    createWindow();

    // 9. Create system tray
    createTray();

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
