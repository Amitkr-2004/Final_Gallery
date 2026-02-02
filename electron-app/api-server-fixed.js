/**
 * Fixed Face Scanner API Server
 * - Stays running
 * - Better debugging
 * - Shows all matching images
 */

require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { Storage } = require('@google-cloud/storage');

const app = express();
const PORT = 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// File upload setup
const upload = multer({ dest: path.join(__dirname, 'temp-uploads/') });

// Global state
let faceScanner = null;
let bucket = null;
let collectionsCache = null;
let cacheTime = null;

// Simple logger
const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args)
};

/**
 * Initialize services
 */
async function initializeServices() {
  try {
    logger.info('Initializing services...');

    // Initialize face detection
    const faceapi = require('face-api.js');
    const canvas = require('canvas');
    const { Canvas, Image, ImageData } = canvas;
    faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

    // Use face-api's internal TensorFlow
    const tf = faceapi.tf;
    await tf.setBackend('cpu');
    await tf.ready();

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
      },

      cosineSimilarity: (embedding1, embedding2) => {
        let dotProduct = 0;
        let norm1 = 0;
        let norm2 = 0;
        for (let i = 0; i < 128; i++) {
          dotProduct += embedding1[i] * embedding2[i];
          norm1 += embedding1[i] * embedding1[i];
          norm2 += embedding2[i] * embedding2[i];
        }
        return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
      }
    };

    logger.info('✓ Face scanner initialized');

    // Initialize GCS
    try {
      const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS || './gcp-service-account.json';
      if (!fs.existsSync(credPath)) {
        logger.warn('⚠️  GCS credentials not found');
        logger.info('Server will still run but collection matching will be disabled');
      } else {
        const storage = new Storage({
          keyFilename: credPath,
          projectId: process.env.GCP_PROJECT_ID
        });

        const bucketName = process.env.GCS_BUCKET_NAME || 'erp-academic-stage';
        bucket = storage.bucket(bucketName);

        // Test connection
        await bucket.exists();
        logger.info('✓ GCS connected:', bucketName);
      }
    } catch (error) {
      logger.warn('⚠️  GCS initialization failed:', error.message);
      logger.info('Server will still run but collection matching will be disabled');
    }

    logger.info('✅ All services initialized\n');
  } catch (error) {
    logger.error('❌ Failed to initialize services:', error.message);
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
      logger.info('Using cached collections');
      return { success: true, collections: collectionsCache, cached: true };
    }

    logger.info('Loading collections from GCS...');
    const [files] = await bucket.getFiles({ prefix: 'collections/' });
    const jsonFiles = files.filter(f => f.name.endsWith('.json'));

    logger.info(`Found ${jsonFiles.length} collection files`);

    const collections = [];
    for (const file of jsonFiles) {
      try {
        const [contents] = await file.download();
        const collection = JSON.parse(contents.toString());
        collections.push(collection);
        logger.info(`Loaded collection ${collection.collection_id.substring(0,8)}... with ${collection.image_ids ? collection.image_ids.length : 0} images`);
      } catch (error) {
        logger.warn('Failed to load collection:', file.name, error.message);
      }
    }

    // Cache the results
    collectionsCache = collections;
    cacheTime = Date.now();

    logger.info(`✓ Loaded ${collections.length} collections from GCS`);
    return { success: true, collections };
  } catch (error) {
    logger.error('Failed to load collections:', error.message);
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
  const allScores = []; // Track all scores for debugging

  for (const collection of collectionsResult.collections) {
    let maxSimilarity = -Infinity;
    let bestMatch = null;

    for (const face of collection.faces) {
      if (!face.embedding_vector || face.embedding_vector.length !== 128) continue;

      // Use cosine similarity (same as face clustering)
      const similarity = faceScanner.cosineSimilarity(embedding, face.embedding_vector);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = {
          face_id: face.face_id,
          image_id: face.image_id,
          distance: 1 - similarity,  // For compatibility
          similarity: similarity,
          confidence: face.confidence,
          is_representative: face.is_representative
        };
      }
    }

    // Track scores for debugging
    if (bestMatch) {
      allScores.push({
        collection: collection.name,
        similarity: maxSimilarity
      });
    }

    // Check against threshold (using cosine similarity directly)
    if (bestMatch && maxSimilarity >= threshold) {
      matches.push({
        collection_id: collection.collection_id,
        collection_name: collection.name,
        total_faces: collection.total_faces,
        total_images: collection.total_images || (collection.image_ids ? collection.image_ids.length : 0),
        image_ids: collection.image_ids || [],
        match: {
          ...bestMatch,
          matched_at: new Date().toISOString()
        }
      });
    }
  }

  // Log all scores for debugging
  logger.info('All similarity scores:');
  allScores.sort((a, b) => b.similarity - a.similarity).forEach(s => {
    logger.info(`  ${s.collection}: ${(s.similarity * 100).toFixed(1)}%`);
  });

  // Sort by similarity (highest first)
  matches.sort((a, b) => b.match.similarity - a.match.similarity);

  logger.info(`Found ${matches.length} matching collections`);
  matches.forEach((match, i) => {
    logger.info(`  ${i+1}. Collection ${match.collection_id.substring(0,8)}... - ${match.total_images} images, ${match.total_faces} faces, similarity: ${(match.match.similarity * 100).toFixed(1)}%`);
  });

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
    name: 'Fixed Face Scanner API',
    version: '3.0.0',
    description: 'Face detection and collection matching via GCS (FIXED)',
    collections: collectionsCache ? collectionsCache.length : 0
  });
});

app.post('/api/scanner/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    logger.info('Processing uploaded image:', req.file.originalname);

    const result = await faceScanner.scanFace(req.file.path);

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      logger.warn('Failed to delete temp file:', err.message);
    }

    res.json(result);
  } catch (error) {
    logger.error('Upload error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/scanner/match', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'No image uploaded' });
    }

    logger.info('\n=== NEW MATCH REQUEST ===');
    logger.info('Image:', req.file.originalname);

    // Scan the face
    const scanResult = await faceScanner.scanFace(req.file.path);

    // Clean up temp file
    try {
      fs.unlinkSync(req.file.path);
    } catch (err) {
      logger.warn('Failed to delete temp file:', err.message);
    }

    if (!scanResult.success) {
      logger.warn('Face detection failed:', scanResult.error);
      return res.json(scanResult);
    }

    logger.info('Face detected with confidence:', (scanResult.face.confidence * 100).toFixed(1) + '%');

    // Search collections
    const threshold = parseFloat(req.body.threshold) || 0.6;
    const limit = parseInt(req.body.limit) || 10;

    const matchResult = await searchCollections(scanResult.face.embedding, threshold, limit);

    if (!matchResult.success) {
      return res.json(matchResult);
    }

    const response = {
      success: true,
      scanned_face: {
        confidence: scanResult.face.confidence,
        boundingBox: scanResult.face.boundingBox
      },
      matches: matchResult.matches,
      stats: matchResult.stats
    };

    logger.info('=== MATCH COMPLETE ===\n');

    res.json(response);
  } catch (error) {
    logger.error('Match error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.get('/api/collections', async (req, res) => {
  try {
    const result = await loadCollectionsFromGCS();

    if (!result.success) {
      return res.status(500).json(result);
    }

    const collections = result.collections.map(c => ({
      collection_id: c.collection_id,
      name: c.name,
      total_faces: c.total_faces,
      total_images: c.total_images || (c.image_ids ? c.image_ids.length : 0),
      image_count: c.image_ids ? c.image_ids.length : 0,
      image_ids: c.image_ids || []
    }));

    res.json({
      success: true,
      collections,
      cached: result.cached || false
    });
  } catch (error) {
    logger.error('Collections error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

app.post('/api/collections/refresh', async (req, res) => {
  try {
    logger.info('Refreshing collections cache...');
    collectionsCache = null;
    cacheTime = null;

    const result = await loadCollectionsFromGCS();
    res.json({
      success: result.success,
      message: result.success ? 'Collections cache refreshed' : 'Failed to refresh',
      count: result.collections ? result.collections.length : 0
    });
  } catch (error) {
    logger.error('Refresh error:', error.message);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Serve camera scanner HTML
app.get('/camera-scanner.html', (req, res) => {
  const htmlPath = path.join(__dirname, '..', 'camera-scanner.html');
  if (fs.existsSync(htmlPath)) {
    res.sendFile(htmlPath);
  } else {
    res.status(404).json({ success: false, error: 'Camera scanner not found' });
  }
});

// Serve image by image_id
app.get('/api/images/:image_id', async (req, res) => {
  try {
    const { image_id } = req.params;

    // Search for the image in GCS (it's stored under images/collection_id/image_id.jpeg)
    const [files] = await bucket.getFiles({
      prefix: 'images/',
      maxResults: 1000
    });

    // Find the file that matches the image_id
    const imageFile = files.find(f => {
      const fileName = f.name.split('/').pop();
      return fileName === `${image_id}.jpeg` || fileName === `${image_id}.jpg`;
    });

    if (!imageFile) {
      logger.warn('Image not found in GCS:', image_id);
      return res.status(404).json({ success: false, error: 'Image not found' });
    }

    // Stream from GCS
    res.setHeader('Content-Type', 'image/jpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

    imageFile.createReadStream()
      .on('error', (err) => {
        logger.error('Stream error for image', image_id, ':', err.message);
        if (!res.headersSent) {
          res.status(500).json({ success: false, error: 'Failed to stream image' });
        }
      })
      .pipe(res);

  } catch (error) {
    logger.error('Image serve error:', error.message);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: error.message });
    }
  }
});

// Error handling
app.use((err, req, res, next) => {
  logger.error('Unhandled error:', err.message);
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

    const server = app.listen(PORT, () => {
      console.log(`
╔════════════════════════════════════════════════════════════╗
║                                                            ║
║   🚀 FIXED Face Scanner API Server Running                ║
║                                                            ║
║   URL: http://localhost:${PORT}                              ║
║                                                            ║
║   📚 Available Endpoints:                                 ║
║                                                            ║
║   GET  /health                    - Health check          ║
║   GET  /api/info                  - API information       ║
║   GET  /api/collections           - List collections      ║
║   POST /api/collections/refresh   - Refresh cache         ║
║   POST /api/scanner/upload        - Upload and scan       ║
║   POST /api/scanner/match         - Scan & match ⭐       ║
║                                                            ║
║   ⭐ Shows ALL matching images!                           ║
║                                                            ║
║   Keep this window open for testing!                      ║
║                                                            ║
╚════════════════════════════════════════════════════════════╝
      `);
    });

    // Keep server alive
    server.on('error', (error) => {
      logger.error('Server error:', error.message);
    });

    // Prevent process exit
    setInterval(() => {
      // Keep alive
    }, 60000);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

process.on('SIGINT', () => {
  console.log('\n\nShutting down server...');
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nShutting down server...');
  process.exit(0);
});

startServer().catch(error => {
  logger.error('Startup error:', error);
  process.exit(1);
});
