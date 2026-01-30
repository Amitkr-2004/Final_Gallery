/**
 * Face Detection Service
 * Handles face detection, recognition, and embedding generation
 */

const faceapi = require('@vladmandic/face-api');
const canvas = require('canvas');
const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Setup canvas for face-api
const { Canvas, Image, ImageData } = canvas;
faceapi.env.monkeyPatch({ Canvas, Image, ImageData });

let modelsLoaded = false;
let logger = null;

/**
 * Initialize face detection models
 */
async function initializeFaceAPI(loggerInstance) {
  if (modelsLoaded) {
    return true;
  }

  logger = loggerInstance;

  try {
    const modelPath = path.join(__dirname, '../../models');

    // Create models directory if it doesn't exist
    await fs.mkdir(modelPath, { recursive: true });

    logger.info('Loading face detection models...');

    // Load models
    await Promise.all([
      faceapi.nets.ssdMobilenetv1.loadFromDisk(modelPath),
      faceapi.nets.faceLandmark68Net.loadFromDisk(modelPath),
      faceapi.nets.faceRecognitionNet.loadFromDisk(modelPath)
    ]);

    modelsLoaded = true;
    logger.info('✓ Face detection models loaded successfully');
    return true;
  } catch (error) {
    logger.error('Failed to load face detection models', { error: error.message });
    logger.info('Models should be placed in: electron-app/models/');
    logger.info('Download from: https://github.com/vladmandic/face-api/tree/master/model');
    return false;
  }
}

/**
 * Detect faces in an image
 * @param {string} imagePath - Path to image file
 * @returns {Promise<Array>} Array of detected faces with embeddings
 */
async function detectFaces(imagePath) {
  if (!modelsLoaded) {
    throw new Error('Face detection models not loaded');
  }

  try {
    // Load image
    const img = await canvas.loadImage(imagePath);

    // Detect faces with landmarks and descriptors
    const detections = await faceapi
      .detectAllFaces(img)
      .withFaceLandmarks()
      .withFaceDescriptors();

    if (!detections || detections.length === 0) {
      return [];
    }

    // Process each detection
    const faces = detections.map((detection, index) => {
      const box = detection.detection.box;
      const landmarks = detection.landmarks.positions;
      const descriptor = Array.from(detection.descriptor); // 128-dim embedding

      // Calculate face quality score
      const qualityScore = calculateQualityScore(detection, img.width, img.height);

      return {
        face_id: uuidv4(),
        bounding_box: {
          x: Math.round(box.x),
          y: Math.round(box.y),
          width: Math.round(box.width),
          height: Math.round(box.height)
        },
        embedding_vector: descriptor,
        confidence: detection.detection.score,
        landmarks: landmarks.map(p => ({ x: Math.round(p.x), y: Math.round(p.y) })),
        quality_score: qualityScore
      };
    });

    return faces;
  } catch (error) {
    logger.error('Face detection failed', { imagePath, error: error.message });
    throw error;
  }
}

/**
 * Calculate face quality score based on various factors
 */
function calculateQualityScore(detection, imgWidth, imgHeight) {
  const box = detection.detection.box;
  let score = detection.detection.score; // Base score from detection confidence

  // Face size factor (prefer larger faces)
  const faceArea = box.width * box.height;
  const imageArea = imgWidth * imgHeight;
  const sizeRatio = faceArea / imageArea;

  if (sizeRatio > 0.1) score += 0.1; // Large face
  if (sizeRatio < 0.02) score -= 0.2; // Very small face

  // Face position (prefer centered faces)
  const centerX = box.x + box.width / 2;
  const centerY = box.y + box.height / 2;
  const distFromCenter = Math.sqrt(
    Math.pow(centerX - imgWidth / 2, 2) +
    Math.pow(centerY - imgHeight / 2, 2)
  );
  const maxDist = Math.sqrt(Math.pow(imgWidth / 2, 2) + Math.pow(imgHeight / 2, 2));
  const centerScore = 1 - (distFromCenter / maxDist);
  score += centerScore * 0.1;

  return Math.min(Math.max(score, 0), 1); // Clamp between 0 and 1
}

/**
 * Calculate cosine similarity between two embedding vectors
 */
function cosineSimilarity(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let dotProduct = 0;
  let norm1 = 0;
  let norm2 = 0;

  for (let i = 0; i < vec1.length; i++) {
    dotProduct += vec1[i] * vec2[i];
    norm1 += vec1[i] * vec1[i];
    norm2 += vec2[i] * vec2[i];
  }

  norm1 = Math.sqrt(norm1);
  norm2 = Math.sqrt(norm2);

  if (norm1 === 0 || norm2 === 0) {
    return 0;
  }

  return dotProduct / (norm1 * norm2);
}

/**
 * Calculate Euclidean distance between two vectors
 */
function euclideanDistance(vec1, vec2) {
  if (vec1.length !== vec2.length) {
    throw new Error('Vectors must have same length');
  }

  let sum = 0;
  for (let i = 0; i < vec1.length; i++) {
    const diff = vec1[i] - vec2[i];
    sum += diff * diff;
  }

  return Math.sqrt(sum);
}

module.exports = {
  initializeFaceAPI,
  detectFaces,
  cosineSimilarity,
  euclideanDistance
};
