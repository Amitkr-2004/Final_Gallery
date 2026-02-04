/**
 * Image Compression Service
 * Handles image compression and thumbnail generation using sharp
 */

const sharp = require('sharp');
const path = require('path');
const fs = require('fs').promises;
const fssync = require('fs');

let logger = null;
let configService = null;

/**
 * Initialize the compression service
 * @param {object} loggerInstance - Logger instance
 * @param {object} configServiceInstance - Config service instance
 */
function initialize(loggerInstance, configServiceInstance) {
  logger = loggerInstance;
  configService = configServiceInstance;
  logger.info('Image compression service initialized');
}

/**
 * Ensure directories exist for image storage
 */
async function ensureDirectories() {
  const originalsPath = configService.get('storage.originalsPath');
  const compressedPath = configService.get('storage.compressedPath');
  const thumbnailsPath = configService.get('storage.thumbnailsPath');

  const dirs = [originalsPath, compressedPath, thumbnailsPath];

  for (const dir of dirs) {
    if (!fssync.existsSync(dir)) {
      await fs.mkdir(dir, { recursive: true });
      logger.info('Created directory', { dir });
    }
  }

  return { originalsPath, compressedPath, thumbnailsPath };
}

/**
 * Get image metadata (dimensions, format, size)
 * @param {string} sourcePath - Path to source image
 * @returns {Promise<object>} Image metadata
 */
async function getImageMetadata(sourcePath) {
  try {
    const metadata = await sharp(sourcePath).metadata();
    const stats = await fs.stat(sourcePath);

    return {
      width: metadata.width,
      height: metadata.height,
      format: metadata.format,
      size: stats.size,
      hasAlpha: metadata.hasAlpha
    };
  } catch (error) {
    logger.error('Failed to get image metadata', { sourcePath, error: error.message });
    throw error;
  }
}

/**
 * Compress image to web-optimized quality
 * @param {string} sourcePath - Path to source image
 * @param {string} destPath - Path to destination
 * @param {object} options - Compression options
 * @returns {Promise<object>} Compression result
 */
async function compressImage(sourcePath, destPath, options = {}) {
  const compressionConfig = configService.get('compression.compressed', {
    maxWidth: 1920,
    maxHeight: 1080,
    quality: 80,
    format: 'jpeg'
  });

  const maxWidth = options.maxWidth || compressionConfig.maxWidth;
  const maxHeight = options.maxHeight || compressionConfig.maxHeight;
  const quality = options.quality || compressionConfig.quality;

  try {
    const originalStats = await fs.stat(sourcePath);
    const originalSize = originalStats.size;

    // Get original metadata
    const metadata = await sharp(sourcePath).metadata();

    // Create sharp instance
    let sharpInstance = sharp(sourcePath);

    // Rotate based on EXIF orientation
    sharpInstance = sharpInstance.rotate();

    // Resize if larger than max dimensions (maintain aspect ratio)
    if (metadata.width > maxWidth || metadata.height > maxHeight) {
      sharpInstance = sharpInstance.resize(maxWidth, maxHeight, {
        fit: 'inside',
        withoutEnlargement: true
      });
    }

    // Convert to JPEG with quality settings
    sharpInstance = sharpInstance.jpeg({
      quality: quality,
      mozjpeg: true, // Use mozjpeg for better compression
      progressive: true
    });

    // Save to destination
    await sharpInstance.toFile(destPath);

    // Get compressed file stats
    const compressedStats = await fs.stat(destPath);
    const compressedSize = compressedStats.size;
    const compressionRatio = compressedSize / originalSize;

    logger.info('Image compressed', {
      sourcePath: path.basename(sourcePath),
      destPath: path.basename(destPath),
      originalSize,
      compressedSize,
      compressionRatio: (compressionRatio * 100).toFixed(1) + '%',
      savings: ((1 - compressionRatio) * 100).toFixed(1) + '% smaller'
    });

    return {
      success: true,
      destPath,
      originalSize,
      compressedSize,
      compressionRatio
    };
  } catch (error) {
    logger.error('Failed to compress image', {
      sourcePath,
      destPath,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Generate thumbnail for gallery grid
 * @param {string} sourcePath - Path to source image
 * @param {string} destPath - Path to destination
 * @param {object} options - Thumbnail options
 * @returns {Promise<object>} Thumbnail result
 */
async function generateThumbnail(sourcePath, destPath, options = {}) {
  const thumbnailConfig = configService.get('compression.thumbnail', {
    width: 300,
    height: 300,
    quality: 70,
    format: 'jpeg'
  });

  const width = options.width || thumbnailConfig.width;
  const height = options.height || thumbnailConfig.height;
  const quality = options.quality || thumbnailConfig.quality;

  try {
    // Create sharp instance
    let sharpInstance = sharp(sourcePath);

    // Rotate based on EXIF orientation
    sharpInstance = sharpInstance.rotate();

    // Resize to thumbnail (cover mode - fills the box, crops excess)
    sharpInstance = sharpInstance.resize(width, height, {
      fit: 'cover',
      position: 'centre'
    });

    // Convert to JPEG with quality settings
    sharpInstance = sharpInstance.jpeg({
      quality: quality,
      mozjpeg: true,
      progressive: true
    });

    // Save to destination
    await sharpInstance.toFile(destPath);

    // Get thumbnail stats
    const stats = await fs.stat(destPath);

    logger.info('Thumbnail generated', {
      sourcePath: path.basename(sourcePath),
      destPath: path.basename(destPath),
      size: stats.size,
      dimensions: `${width}x${height}`
    });

    return {
      success: true,
      destPath,
      size: stats.size,
      width,
      height
    };
  } catch (error) {
    logger.error('Failed to generate thumbnail', {
      sourcePath,
      destPath,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Process an uploaded image with compression
 * Creates original, compressed, and thumbnail versions
 * @param {string} sourcePath - Path to source image (already copied to uploads)
 * @param {string} filename - Original filename
 * @param {string} uniqueFilename - Unique filename with date prefix
 * @returns {Promise<object>} Processing result with all paths
 */
async function processUploadWithCompression(sourcePath, filename, uniqueFilename) {
  try {
    // Ensure directories exist
    const { originalsPath, compressedPath, thumbnailsPath } = await ensureDirectories();

    // Get base name without extension
    const baseName = path.parse(uniqueFilename).name;
    const ext = path.extname(uniqueFilename).toLowerCase();

    // Generate destination paths
    const originalDest = path.join(originalsPath, uniqueFilename);
    const compressedDest = path.join(compressedPath, `${baseName}.jpg`);
    const thumbnailDest = path.join(thumbnailsPath, `${baseName}_thumb.jpg`);

    // Get original file metadata
    const originalMetadata = await getImageMetadata(sourcePath);

    // 1. Copy original to originals folder
    await fs.copyFile(sourcePath, originalDest);
    logger.info('Original copied', {
      from: path.basename(sourcePath),
      to: path.basename(originalDest),
      size: originalMetadata.size
    });

    // 2. Create compressed version
    const compressResult = await compressImage(sourcePath, compressedDest);

    // 3. Create thumbnail
    const thumbnailResult = await generateThumbnail(sourcePath, thumbnailDest);

    // Calculate overall compression ratio
    const compressionRatio = compressResult.success
      ? compressResult.compressedSize / originalMetadata.size
      : 1;

    const result = {
      success: true,
      paths: {
        original: originalDest,
        compressed: compressResult.success ? compressedDest : null,
        thumbnail: thumbnailResult.success ? thumbnailDest : null
      },
      sizes: {
        original: originalMetadata.size,
        compressed: compressResult.success ? compressResult.compressedSize : null,
        thumbnail: thumbnailResult.success ? thumbnailResult.size : null
      },
      metadata: originalMetadata,
      compressionRatio,
      compressedForFaceProcessing: compressResult.success ? compressedDest : sourcePath
    };

    logger.info('Image processing complete', {
      filename,
      originalSize: originalMetadata.size,
      compressedSize: compressResult.success ? compressResult.compressedSize : null,
      thumbnailSize: thumbnailResult.success ? thumbnailResult.size : null,
      totalSavings: compressResult.success
        ? `${((1 - compressionRatio) * 100).toFixed(1)}%`
        : '0%'
    });

    return result;
  } catch (error) {
    logger.error('Failed to process upload with compression', {
      sourcePath,
      filename,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: error.message
    };
  }
}

/**
 * Delete all versions of an image
 * @param {object} paths - Object with original, compressed, thumbnail paths
 */
async function deleteAllVersions(paths) {
  const results = { deleted: [], errors: [] };

  for (const [type, filePath] of Object.entries(paths)) {
    if (filePath && fssync.existsSync(filePath)) {
      try {
        await fs.unlink(filePath);
        results.deleted.push({ type, path: filePath });
        logger.info(`Deleted ${type} image`, { path: filePath });
      } catch (error) {
        results.errors.push({ type, path: filePath, error: error.message });
        logger.error(`Failed to delete ${type} image`, { path: filePath, error: error.message });
      }
    }
  }

  return results;
}

module.exports = {
  initialize,
  ensureDirectories,
  getImageMetadata,
  compressImage,
  generateThumbnail,
  processUploadWithCompression,
  deleteAllVersions
};
