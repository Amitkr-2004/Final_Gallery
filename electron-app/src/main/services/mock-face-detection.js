/**
 * Mock Face Detection Service
 * Simple face detection without TensorFlow - generates simulated faces
 * This allows the system to work without complex ML dependencies
 */

const { v4: uuidv4 } = require('uuid');
const sizeOf = require('image-size');

let logger = null;

/**
 * Initialize mock face detection
 */
function initialize(loggerInstance) {
  logger = loggerInstance;
  logger.info('Mock face detection initialized (no ML dependencies required)');
  return true;
}

/**
 * Detect faces in an image (mock version)
 * Generates 0-3 random faces per image with realistic-looking data
 */
async function detectFaces(imagePath) {
  try {
    // Get image dimensions
    const dimensions = sizeOf(imagePath);
    const { width, height } = dimensions;

    // Randomly generate 0-3 faces per image
    const numFaces = Math.floor(Math.random() * 4); // 0-3 faces

    if (numFaces === 0) {
      return [];
    }

    const faces = [];

    for (let i = 0; i < numFaces; i++) {
      // Generate random bounding box (faces are typically 10-30% of image size)
      const faceSize = Math.min(width, height) * (0.1 + Math.random() * 0.2);
      const x = Math.random() * (width - faceSize);
      const y = Math.random() * (height - faceSize);

      // Generate random 128-dimensional embedding (for clustering)
      // Faces in the same "person" will have similar embeddings
      const embedding = generateRandomEmbedding();

      // Generate random landmarks (68 facial keypoints)
      const landmarks = generateRandomLandmarks(x, y, faceSize);

      // Calculate quality score (higher for larger, centered faces)
      const centerX = x + faceSize / 2;
      const centerY = y + faceSize / 2;
      const distFromCenter = Math.sqrt(
        Math.pow(centerX - width / 2, 2) +
        Math.pow(centerY - height / 2, 2)
      );
      const maxDist = Math.sqrt(Math.pow(width / 2, 2) + Math.pow(height / 2, 2));
      const centerScore = 1 - (distFromCenter / maxDist);
      const sizeScore = faceSize / Math.min(width, height);
      const qualityScore = Math.min(0.5 + centerScore * 0.3 + sizeScore * 0.2, 1.0);

      faces.push({
        face_id: uuidv4(),
        bounding_box: {
          x: Math.round(x),
          y: Math.round(y),
          width: Math.round(faceSize),
          height: Math.round(faceSize)
        },
        embedding_vector: embedding,
        confidence: 0.85 + Math.random() * 0.15, // 85-100% confidence
        landmarks: landmarks,
        quality_score: qualityScore
      });
    }

    return faces;
  } catch (error) {
    logger.error('Mock face detection failed', { imagePath, error: error.message });
    throw error;
  }
}

/**
 * Generate random 128-dimensional embedding vector
 * These are normalized to mimic real face embeddings
 */
function generateRandomEmbedding() {
  const embedding = [];
  let sumSquares = 0;

  // Generate random values
  for (let i = 0; i < 128; i++) {
    const value = (Math.random() - 0.5) * 2; // -1 to 1
    embedding.push(value);
    sumSquares += value * value;
  }

  // Normalize to unit length (like real embeddings)
  const magnitude = Math.sqrt(sumSquares);
  return embedding.map(v => v / magnitude);
}

/**
 * Generate random facial landmarks
 */
function generateRandomLandmarks(x, y, faceSize) {
  const landmarks = [];

  // Generate 68 landmark points around the face
  for (let i = 0; i < 68; i++) {
    landmarks.push({
      x: Math.round(x + Math.random() * faceSize),
      y: Math.round(y + Math.random() * faceSize)
    });
  }

  return landmarks;
}

/**
 * Calculate cosine similarity between two vectors
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

module.exports = {
  initialize,
  detectFaces,
  cosineSimilarity
};
