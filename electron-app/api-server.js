/**
 * HTTP API Wrapper for Face Scanner
 * Exposes scanner functionality as REST endpoints for testing with Postman
 *
 * Usage: node api-server.js
 * Server runs on: http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

const { initializeDatabase, getDatabase } = require('./src/main/database/schema');
const { setupLogger } = require('./src/main/utils/logger');
const { getConfigService } = require('./src/main/storage/config');

const app = express();
const PORT = 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer for file uploads
const upload = multer({
  dest: path.join(__dirname, 'temp-uploads'),
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

// Global services
let faceScanner = null;
let logger = null;
let db = null;

/**
 * Initialize all services
 */
async function initializeServices() {
  try {
    console.log('Initializing services...');

    // Load config
    const configService = getConfigService();
    configService.load();
    logger = setupLogger(configService);

    // Initialize database
    db = initializeDatabase(configService, logger);
    logger.info('✓ Database initialized');

    // Initialize face detection
    const { initialize: initializeFaceDetection } = require('./src/main/services/face-detection');
    await initializeFaceDetection(logger);
    logger.info('✓ Face detection initialized');

    // Initialize GCS Upload
    const { initialize: initializeGCSUpload } = require('./src/main/services/gcs-upload');
    await initializeGCSUpload(db, logger);
    logger.info('✓ GCS upload initialized');

    // Initialize face scanner
    faceScanner = require('./src/main/services/face-scanner');
    faceScanner.initialize(logger);
    logger.info('✓ Face scanner initialized');

    console.log('✅ All services initialized successfully\n');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error.message);
    throw error;
  }
}

/**
 * Routes
 */

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      faceScanner: !!faceScanner,
      database: !!db,
      logger: !!logger
    }
  });
});

// POST /api/scanner/scan - Scan a face from image path
app.post('/api/scanner/scan', async (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'imagePath is required'
      });
    }

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found'
      });
    }

    logger.info('API: Scanning face', { imagePath });
    const result = await faceScanner.scanFace(imagePath);

    res.json(result);
  } catch (error) {
    logger.error('API: Scan failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scanner/match - Scan and match against collections
app.post('/api/scanner/match', async (req, res) => {
  try {
    const { imagePath, threshold = 0.6, limit = 10, searchMode = 'local' } = req.body;

    if (!imagePath) {
      return res.status(400).json({
        success: false,
        error: 'imagePath is required'
      });
    }

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found'
      });
    }

    logger.info('API: Scan and match', { imagePath, threshold, limit, searchMode });
    const result = await faceScanner.scanAndMatch(imagePath, {
      threshold,
      limit,
      searchMode
    });

    res.json(result);
  } catch (error) {
    logger.error('API: Match failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scanner/upload - Upload image and scan
app.post('/api/scanner/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No image file uploaded'
      });
    }

    const { threshold = 0.6, limit = 10, searchMode = 'local' } = req.body;
    const imagePath = req.file.path;

    logger.info('API: Upload and scan', { filename: req.file.originalname });

    const result = await faceScanner.scanAndMatch(imagePath, {
      threshold: parseFloat(threshold),
      limit: parseInt(limit),
      searchMode
    });

    // Cleanup uploaded file
    fs.unlinkSync(imagePath);

    res.json(result);
  } catch (error) {
    logger.error('API: Upload scan failed', { error: error.message });

    // Cleanup on error
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }

    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scanner/search - Search with pre-computed embedding
app.post('/api/scanner/search', async (req, res) => {
  try {
    const { embedding, threshold = 0.6, limit = 10, searchMode = 'local' } = req.body;

    if (!embedding || !Array.isArray(embedding)) {
      return res.status(400).json({
        success: false,
        error: 'embedding array is required'
      });
    }

    if (embedding.length !== 128) {
      return res.status(400).json({
        success: false,
        error: 'embedding must be 128-dimensional array'
      });
    }

    logger.info('API: Search with embedding', { threshold, limit, searchMode });

    const result = searchMode === 'gcs'
      ? await faceScanner.searchCollections(embedding, threshold, limit)
      : await faceScanner.searchCollectionsLocal(embedding, threshold, limit);

    res.json(result);
  } catch (error) {
    logger.error('API: Search failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/collections - List all collections
app.get('/api/collections', async (req, res) => {
  try {
    const collections = db.prepare(`
      SELECT
        collection_id,
        name,
        total_faces,
        created_at,
        updated_at
      FROM face_collections
      ORDER BY total_faces DESC
    `).all();

    res.json({
      success: true,
      count: collections.length,
      collections
    });
  } catch (error) {
    logger.error('API: List collections failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/collections/:id - Get collection details
app.get('/api/collections/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const collection = db.prepare(`
      SELECT * FROM face_collections
      WHERE collection_id = ?
    `).get(id);

    if (!collection) {
      return res.status(404).json({
        success: false,
        error: 'Collection not found'
      });
    }

    const faces = db.prepare(`
      SELECT
        f.*,
        fcm.similarity_score,
        fcm.is_representative
      FROM face_collection_members fcm
      JOIN faces f ON fcm.face_id = f.face_id
      WHERE fcm.collection_id = ?
      ORDER BY fcm.is_representative DESC, fcm.similarity_score DESC
    `).all(id);

    res.json({
      success: true,
      collection: {
        ...collection,
        faces: faces.map(f => ({
          ...f,
          embedding_vector: undefined // Don't send large embeddings
        }))
      }
    });
  } catch (error) {
    logger.error('API: Get collection failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/images - List images
app.get('/api/images', async (req, res) => {
  try {
    const { limit = 10, offset = 0 } = req.query;

    const images = db.prepare(`
      SELECT
        image_id,
        file_name,
        file_path,
        processing_status,
        sync_status,
        created_at
      FROM images
      ORDER BY created_at DESC
      LIMIT ? OFFSET ?
    `).all(parseInt(limit), parseInt(offset));

    const total = db.prepare('SELECT COUNT(*) as count FROM images').get().count;

    res.json({
      success: true,
      total,
      limit: parseInt(limit),
      offset: parseInt(offset),
      images
    });
  } catch (error) {
    logger.error('API: List images failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/stats - Get database statistics
app.get('/api/stats', async (req, res) => {
  try {
    const stats = {
      images: {
        total: db.prepare('SELECT COUNT(*) as count FROM images').get().count,
        processed: db.prepare('SELECT COUNT(*) as count FROM images WHERE processing_status = "completed"').get().count,
        synced: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "completed"').get().count
      },
      faces: {
        total: db.prepare('SELECT COUNT(*) as count FROM faces').get().count
      },
      collections: {
        total: db.prepare('SELECT COUNT(*) as count FROM face_collections').get().count
      }
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    logger.error('API: Get stats failed', { error: error.message });
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error', { error: err.message, stack: err.stack });
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: err.message
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Endpoint not found',
    path: req.path
  });
});

/**
 * Start server
 */
async function startServer() {
  try {
    // Initialize services first
    await initializeServices();

    // Create temp-uploads directory
    const tempDir = path.join(__dirname, 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    // Start server
    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Face Scanner API Server Running                      ║
║                                                            ║
║   URL: http://localhost:${PORT}                              ║
║                                                            ║
║   📚 Available Endpoints:                                 ║
║                                                            ║
║   GET  /health                    - Health check          ║
║   GET  /api/stats                 - Database stats        ║
║   GET  /api/images                - List images           ║
║   GET  /api/collections           - List collections      ║
║   GET  /api/collections/:id       - Get collection        ║
║   POST /api/scanner/scan          - Scan face             ║
║   POST /api/scanner/match         - Scan and match        ║
║   POST /api/scanner/upload        - Upload and scan       ║
║   POST /api/scanner/search        - Search by embedding   ║
║                                                            ║
║   📖 Documentation: API_POSTMAN.md                        ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  process.exit(0);
});

// Start the server
startServer();
