/**
 * Simplified HTTP API Wrapper for Face Scanner
 * This version works with regular Node.js by avoiding database dependencies
 *
 * Usage: node api-server-simple.js
 * Server runs on: http://localhost:3000
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');

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

/**
 * Simple logger when winston is not available
 */
const simpleLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

/**
 * Initialize face detection services only (no database)
 */
async function initializeServices() {
  try {
    console.log('Initializing services...');
    logger = simpleLogger;

    // Initialize face detection
    const faceapi = require('face-api.js');
    const canvas = require('canvas');
    const { Canvas, Image, ImageData } = canvas;
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    const tf = require('@tensorflow/tfjs');
    await tf.ready();
    await tf.setBackend('cpu');

    const modelPath = path.join(__dirname, 'models/face-api');
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath);
    await faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath);
    await faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath);

    logger.info('✓ Face detection models loaded');

    // Initialize face scanner
    faceScanner = {
      scanFace: async (imagePath) => {
        try {
          const img = await canvas.loadImage(imagePath);
          const detection = await faceapi
            .detectSingleFace(img)
            .withFaceLandmarks()
            .withFaceDescriptor();

          if (!detection) {
            return {
              success: false,
              error: 'No face detected in the image'
            };
          }

          return {
            success: true,
            face: {
              embedding: Array.from(detection.descriptor),
              confidence: detection.detection.score,
              boundingBox: {
                x: detection.detection.box.x,
                y: detection.detection.box.y,
                width: detection.detection.box.width,
                height: detection.detection.box.height
              },
              landmarks: detection.landmarks.positions.map(p => ({ x: p.x, y: p.y }))
            }
          };
        } catch (error) {
          return {
            success: false,
            error: error.message
          };
        }
      },

      compareEmbeddings: (embedding1, embedding2) => {
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          const diff = embedding1[i] - embedding2[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      }
    };

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
      note: 'Simplified API - database features disabled'
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
        error: 'imagePath is required in request body'
      });
    }

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({
        success: false,
        error: 'Image file not found at path: ' + imagePath
      });
    }

    logger.info('Scanning face from:', imagePath);
    const result = await faceScanner.scanFace(imagePath);

    res.json(result);
  } catch (error) {
    logger.error('Scan failed:', error.message);
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

    const imagePath = req.file.path;
    logger.info('Scanning uploaded file:', req.file.originalname);

    const result = await faceScanner.scanFace(imagePath);

    // Cleanup uploaded file
    fs.unlinkSync(imagePath);

    res.json(result);
  } catch (error) {
    logger.error('Upload scan failed:', error.message);

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

// POST /api/scanner/compare - Compare two embeddings
app.post('/api/scanner/compare', async (req, res) => {
  try {
    const { embedding1, embedding2 } = req.body;

    if (!embedding1 || !embedding2) {
      return res.status(400).json({
        success: false,
        error: 'Both embedding1 and embedding2 are required'
      });
    }

    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      return res.status(400).json({
        success: false,
        error: 'Embeddings must be arrays'
      });
    }

    if (embedding1.length !== 128 || embedding2.length !== 128) {
      return res.status(400).json({
        success: false,
        error: 'Embeddings must be 128-dimensional'
      });
    }

    const distance = faceScanner.compareEmbeddings(embedding1, embedding2);
    const similarity = 1 - distance;

    res.json({
      success: true,
      distance,
      similarity,
      match: distance < 0.6 // Default threshold
    });
  } catch (error) {
    logger.error('Compare failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// POST /api/scanner/batch-scan - Scan multiple images
app.post('/api/scanner/batch-scan', async (req, res) => {
  try {
    const { imagePaths } = req.body;

    if (!imagePaths || !Array.isArray(imagePaths)) {
      return res.status(400).json({
        success: false,
        error: 'imagePaths array is required'
      });
    }

    const results = [];
    for (const imagePath of imagePaths) {
      if (fs.existsSync(imagePath)) {
        const result = await faceScanner.scanFace(imagePath);
        results.push({
          imagePath,
          ...result
        });
      } else {
        results.push({
          imagePath,
          success: false,
          error: 'File not found'
        });
      }
    }

    res.json({
      success: true,
      total: imagePaths.length,
      results
    });
  } catch (error) {
    logger.error('Batch scan failed:', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// GET /api/info - Get API information
app.get('/api/info', (req, res) => {
  res.json({
    name: 'Face Scanner API',
    version: '1.0.0',
    description: 'Simplified API for face detection and embedding generation',
    endpoints: {
      'GET /health': 'Health check',
      'GET /api/info': 'API information',
      'POST /api/scanner/scan': 'Scan face from image path',
      'POST /api/scanner/upload': 'Upload and scan image',
      'POST /api/scanner/compare': 'Compare two embeddings',
      'POST /api/scanner/batch-scan': 'Scan multiple images'
    },
    note: 'This is a simplified version. For full features including collection search, use the Electron app directly.'
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
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
    path: req.path,
    availableEndpoints: [
      'GET /health',
      'GET /api/info',
      'POST /api/scanner/scan',
      'POST /api/scanner/upload',
      'POST /api/scanner/compare',
      'POST /api/scanner/batch-scan'
    ]
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
║   GET  /api/info                  - API information       ║
║   POST /api/scanner/scan          - Scan from path        ║
║   POST /api/scanner/upload        - Upload and scan       ║
║   POST /api/scanner/compare       - Compare embeddings    ║
║   POST /api/scanner/batch-scan    - Scan multiple         ║
║                                                            ║
║   📖 Documentation: API_POSTMAN_SIMPLE.md                 ║
║                                                            ║
║   ⚠️  Note: Simplified version without database           ║
║      For collection search, use Electron app directly     ║
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
