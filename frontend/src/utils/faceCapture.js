/**
 * Face capture utilities for accessing camera and capturing face images.
 * Uses browser's getUserMedia API.
 */

/**
 * Check if browser supports camera access
 * @returns {boolean} True if getUserMedia is supported
 */
export const isCameraSupported = () => {
  return !!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia);
};

/**
 * Request camera access and start video stream
 * @returns {Promise<MediaStream>} Video stream
 * @throws {Error} If camera access denied or not available
 */
export const startCamera = async () => {
  if (!isCameraSupported()) {
    throw new Error('Camera is not supported in this browser');
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280 },
        height: { ideal: 720 },
        facingMode: 'user' // Front camera
      },
      audio: false
    });
    return stream;
  } catch (error) {
    console.error('[YourCollection] Camera access failed:', error);

    // Provide user-friendly error messages
    if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
      throw new Error('Camera access denied. Please allow camera permissions.');
    } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
      throw new Error('No camera found on this device.');
    } else if (error.name === 'NotReadableError' || error.name === 'TrackStartError') {
      throw new Error('Camera is already in use by another application.');
    } else {
      throw new Error(`Camera error: ${error.message}`);
    }
  }
};

/**
 * Stop video stream and release camera
 * @param {MediaStream} stream - Video stream to stop
 */
export const stopCamera = (stream) => {
  if (stream) {
    stream.getTracks().forEach(track => track.stop());
  }
};

/**
 * Capture image from video element
 * @param {HTMLVideoElement} videoElement - Video element displaying camera feed
 * @param {string} format - Image format ('image/jpeg' or 'image/png')
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Captured image as blob
 */
export const captureImageFromVideo = async (videoElement, format = 'image/jpeg', quality = 0.95) => {
  if (!videoElement) {
    throw new Error('Video element not found');
  }

  if (!videoElement.videoWidth || !videoElement.videoHeight) {
    throw new Error('Video element not ready - dimensions are 0');
  }

  if (videoElement.readyState < 2) {
    throw new Error('Video element not ready - waiting for metadata');
  }

  // Create canvas with video dimensions
  const canvas = document.createElement('canvas');
  canvas.width = videoElement.videoWidth;
  canvas.height = videoElement.videoHeight;

  // Draw current video frame to canvas
  const context = canvas.getContext('2d');
  context.drawImage(videoElement, 0, 0, canvas.width, canvas.height);

  // Convert canvas to blob
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error('Failed to capture image'));
        }
      },
      format,
      quality
    );
  });
};

/**
 * Convert blob to base64 string
 * @param {Blob} blob - Image blob
 * @returns {Promise<string>} Base64 encoded image
 */
export const blobToBase64 = (blob) => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
};

/**
 * Validate image file
 * @param {File} file - Image file to validate
 * @returns {Object} { valid: boolean, error: string }
 */
export const validateImageFile = (file) => {
  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB in bytes
  if (file.size > maxSize) {
    return {
      valid: false,
      error: 'Image size exceeds 10MB. Please use a smaller image.'
    };
  }

  // Check file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    return {
      valid: false,
      error: 'Invalid image format. Please use JPG, PNG, or WEBP.'
    };
  }

  return { valid: true, error: null };
};

/**
 * Compress image if needed
 * @param {File} file - Image file to compress
 * @param {number} maxWidth - Max width in pixels
 * @param {number} maxHeight - Max height in pixels
 * @param {number} quality - JPEG quality (0-1)
 * @returns {Promise<Blob>} Compressed image blob
 */
export const compressImage = async (file, maxWidth = 1280, maxHeight = 720, quality = 0.9) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    img.onload = () => {
      let { width, height } = img;

      // Calculate new dimensions while maintaining aspect ratio
      if (width > maxWidth || height > maxHeight) {
        const ratio = Math.min(maxWidth / width, maxHeight / height);
        width = Math.floor(width * ratio);
        height = Math.floor(height * ratio);
      }

      canvas.width = width;
      canvas.height = height;

      // Draw and compress
      ctx.drawImage(img, 0, 0, width, height);

      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(blob);
          } else {
            reject(new Error('Image compression failed'));
          }
        },
        'image/jpeg',
        quality
      );
    };

    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });
};
