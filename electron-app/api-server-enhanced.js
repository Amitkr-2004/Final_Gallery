/**
 * Enhanced HTTP API Server for Face Scanner with Collection Matching
 * Uses GCS for collection data to avoid database version issues
 *
 * Usage: node api-server-enhanced.js
 * Server runs on: http://localhost:3001
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const cors = require('cors');
const { Storage } = require('@google-cloud/storage');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Configure multer
const upload = multer({
  dest: path.join(__dirname, 'temp-uploads'),
  limits: { fileSize: 10 * 1024 * 1024 }
});

// Global services
let faceScanner = null;
let storage = null;
let bucket = null;
let collectionsCache = null;
let cacheTime = null;

const simpleLogger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    console.log('Initializing services...');

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

    console.log('✓ Face detection models loaded');

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
            return { success: false, error: 'No face detected in the image' };
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
          return { success: false, error: error.message };
        }
      },

      euclideanDistance: (embedding1, embedding2) => {
        let sum = 0;
        for (let i = 0; i < 128; i++) {
          const diff = embedding1[i] - embedding2[i];
          sum += diff * diff;
        }
        return Math.sqrt(sum);
      }
    };

    console.log('✓ Face scanner initialized');

    // Initialize GCS
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
      if (!credPath || !fs.existsSync(credPath)) {
        console.warn('⚠️  GCS credentials not found - collection matching will be disabled');
        return;
      }

      storage = new Storage({
        keyFilename: credPath,
        projectId: process.env.GCP_PROJECT_ID
      });

      const bucketName = process.env.GCS_BUCKET_NAME;
      bucket = storage.bucket(bucketName);

      // Test connection
      await bucket.exists();
      console.log('✓ GCS connected:', bucketName);

    } catch (error) {
      console.warn('⚠️  GCS initialization failed:', error.message);
    }

    console.log('✅ All services initialized\n');
  } catch (error) {
    console.error('❌ Failed to initialize services:', error.message);
    throw error;
  }
}

/**
 * Load all collections from GCS
 */
async function loadCollectionsFromGCS() {
  if (!bucket) {
    return { success: false, error: 'GCS not configured' };
  }

  try {
    // Use cache if fresh (< 5 minutes old)
    if (collectionsCache && cacheTime && (Date.now() - cacheTime < 5 * 60 * 1000)) {
      return { success: true, collections: collectionsCache, cached: true };
    }

    const [files] = await bucket.getFiles({ prefix: 'collections/' });
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    const collections = [];
    for (const file of jsonFiles) {
      try {
        const [contents] = await file.download();
        const collection = JSON.parse(contents.toString());
        collections.push(collection);
      } catch (error) {
        simpleLogger.warn('Failed to load collection:', file.name, error.message);
      }
    }

    // Cache the results
    collectionsCache = collections;
    cacheTime = Date.now();

    return { success: true, collections };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * Search collections for matching face
 */
async function searchCollections(embedding, threshold = 0.6, limit = 10) {
  const collectionsResult = await loadCollectionsFromGCS();

  if (!collectionsResult.success) {
    return collectionsResult;
  }

  const matches = [];

  for (const collection of collectionsResult.collections) {
    if (!collection.faces || collection.faces.length === 0) continue;

    let bestMatch = null;
    let minDistance = Infinity;

    for (const face of collection.faces) {
      if (!face.embedding_vector || face.embedding_vector.length !== 128) continue;

      const distance = faceScanner.euclideanDistance(embedding, face.embedding_vector);

      if (distance < minDistance) {
        minDistance = distance;
        bestMatch = {
          face_id: face.face_id,
          image_id: face.image_id,
          distance,
          similarity: 1 - distance,
          confidence: face.confidence,
          is_representative: face.is_representative
        };
      }
    }

    if (bestMatch && minDistance <= threshold) {
      matches.push({
        collection_id: collection.collection_id,
        collection_name: collection.name,
        total_faces: collection.total_faces,
        image_ids: collection.image_ids || [],
        match: {
          ...bestMatch,
          matched_at: new Date().toISOString()
        }
      });
    }
  }

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.match.similarity - a.match.similarity);

  return {
    success: true,
    matches: matches.slice(0, limit),
    stats: {
      total_collections_scanned: collectionsResult.collections.length,
      total_matches_found: matches.length,
      threshold_used: threshold,
      cached: collectionsResult.cached || false
    }
  };
}

/**
 * Routes
 */

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      faceScanner: !!faceScanner,
      gcs: !!bucket,
      collectionsLoaded: !!collectionsCache
    }
  });
});

app.get('/api/info', (req, res) => {
  res.json({
    name: 'Enhanced Face Scanner API',
    version: '2.0.0',
    description: 'Face detection and collection matching via GCS',
    features: ['Face detection', 'Embedding generation', 'Collection matching', 'GCS integration'],
    endpoints: {
      'GET /health': 'Health check',
      'GET /api/info': 'API information',
      'POST /api/scanner/scan': 'Scan face from image path',
      'POST /api/scanner/upload': 'Upload and scan image',
      'POST /api/scanner/match': 'Scan and match against collections',
      'POST /api/scanner/compare': 'Compare two embeddings',
      'GET /api/collections': 'List all collections from GCS',
      'POST /api/collections/refresh': 'Refresh collections cache'
    }
  });
});

app.post('/api/scanner/scan', async (req, res) => {
  try {
    const { imagePath } = req.body;

    if (!imagePath) {
      return res.status(400).json({ success: false, error: 'imagePath is required' });
    }

    if (!fs.existsSync(imagePath)) {
      return res.status(404).json({ success: false, error: 'Image file not found' });
    }

    const result = await faceScanner.scanFace(imagePath);
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scanner/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image file uploaded' });
    }

    const result = await faceScanner.scanFace(req.file.path);
    fs.unlinkSync(req.file.path);
    res.json(result);
  } catch (error) {
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scanner/match', upload.single('image'), async (req, res) => {
  let imagePath = null;

  try {
    // Handle file upload or path
    if (req.file) {
      imagePath = req.file.path;
    } else if (req.body.imagePath) {
      imagePath = req.body.imagePath;
      if (!fs.existsSync(imagePath)) {
        return res.status(404).json({ success: false, error: 'Image file not found' });
      }
    } else {
      return res.status(400).json({ success: false, error: 'No image provided' });
    }

    const threshold = parseFloat(req.body.threshold || 0.6);
    const limit = parseInt(req.body.limit || 10);

    // Scan face
    const scanResult = await faceScanner.scanFace(imagePath);

    if (!scanResult.success) {
      return res.json(scanResult);
    }

    // Search collections
    const searchResult = await searchCollections(scanResult.face.embedding, threshold, limit);

    res.json({
      success: true,
      scanned_face: {
        confidence: scanResult.face.confidence,
        boundingBox: scanResult.face.boundingBox
      },
      matches: searchResult.matches || [],
      stats: searchResult.stats || {}
    });

  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  } finally {
    if (req.file && imagePath && fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }
  }
});

app.post('/api/scanner/compare', async (req, res) => {
  try {
    const { embedding1, embedding2 } = req.body;

    if (!embedding1 || !embedding2) {
      return res.status(400).json({ success: false, error: 'Both embeddings required' });
    }

    if (!Array.isArray(embedding1) || !Array.isArray(embedding2)) {
      return res.status(400).json({ success: false, error: 'Embeddings must be arrays' });
    }

    if (embedding1.length !== 128 || embedding2.length !== 128) {
      return res.status(400).json({ success: false, error: 'Embeddings must be 128-dimensional' });
    }

    const distance = faceScanner.euclideanDistance(embedding1, embedding2);
    const similarity = 1 - distance;

    res.json({
      success: true,
      distance,
      similarity,
      match: distance < 0.6
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/collections', async (req, res) => {
  try {
    const result = await loadCollectionsFromGCS();

    if (!result.success) {
      return res.status(500).json(result);
    }

    const summary = result.collections.map(c => ({
      collection_id: c.collection_id,
      name: c.name,
      total_faces: c.total_faces,
      image_count: c.image_ids ? c.image_ids.length : 0,
      synced_at: c.synced_at
    }));

    res.json({
      success: true,
      count: summary.length,
      cached: result.cached || false,
      collections: summary
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/collections/refresh', async (req, res) => {
  try {
    collectionsCache = null;
    cacheTime = null;

    const result = await loadCollectionsFromGCS();
    res.json({
      success: result.success,
      message: result.success ? 'Collections cache refreshed' : 'Failed to refresh',
      count: result.collections ? result.collections.length : 0
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// Error handling
app.use((err, req, res, next) => {
  simpleLogger.error('Unhandled error:', err.message);
  res.status(500).json({ success: false, error: 'Internal server error', message: err.message });
});

app.use((req, res) => {
  res.status(404).json({ success: false, error: 'Endpoint not found', path: req.path });
});

/**
 * Start server
 */
async function startServer() {
  try {
    await initializeServices();

    const tempDir = path.join(__dirname, 'temp-uploads');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
    }

    app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 Enhanced Face Scanner API Server Running             ║
║                                                            ║
║   URL: http://localhost:${PORT}                              ║
║                                                            ║
║   📚 Available Endpoints:                                 ║
║                                                            ║
║   GET  /health                    - Health check          ║
║   GET  /api/info                  - API information       ║
║   GET  /api/collections           - List collections      ║
║   POST /api/collections/refresh   - Refresh cache         ║
║   POST /api/scanner/scan          - Scan from path        ║
║   POST /api/scanner/upload        - Upload and scan       ║
║   POST /api/scanner/match         - Scan & match ⭐       ║
║   POST /api/scanner/compare       - Compare embeddings    ║
║                                                            ║
║   ⭐ NEW: Collection matching via GCS!                    ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  process.exit(0);
});

startServer();
