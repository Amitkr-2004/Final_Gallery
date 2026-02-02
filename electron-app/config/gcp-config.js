/**
 * Google Cloud Platform Configuration
 *
 * Configuration for GCS (Google Cloud Storage) and Firestore
 */

const path = require('path');
const fs = require('fs');

/**
 * Get GCP configuration
 * Supports both service account JSON file and environment variables
 */
function getGCPConfig() {
  const config = {
    // GCS Bucket Configuration
    bucket: {
      name: process.env.GCS_BUCKET_NAME || 'face-gallery-storage',
      location: process.env.GCS_BUCKET_LOCATION || 'us-central1',
      storageClass: 'STANDARD'
    },

    // Firestore Configuration
    firestore: {
      projectId: process.env.GCP_PROJECT_ID || null,
      databaseId: process.env.FIRESTORE_DATABASE_ID || '(default)',
      collections: {
        embeddings: 'face_embeddings',
        metadata: 'face_metadata'
      }
    },

    // Authentication
    credentials: getCredentials(),

    // Upload Configuration
    upload: {
      timeout: 60000, // 60 seconds
      retryAttempts: 3,
      retryDelay: 1000, // 1 second
      chunkSize: 1024 * 1024 * 5, // 5MB chunks
      concurrent: 3 // Max concurrent uploads
    },

    // Storage Paths in GCS
    paths: {
      images: 'images/{collection_id}/{image_id}.jpg',
      metadata: 'metadata/faces/{face_id}.json',
      embeddings: 'embeddings/{face_id}.json'
    }
  };

  return config;
}

/**
 * Get GCP credentials from file or environment
 * Priority:
 * 1. GOOGLE_APPLICATION_CREDENTIALS env var (path to JSON file)
 * 2. GCP_SERVICE_ACCOUNT_JSON env var (JSON string)
 * 3. gcp-service-account.json in project root
 * 4. gcp-service-account.json in config directory
 */
function getCredentials() {
  // Option 1: GOOGLE_APPLICATION_CREDENTIALS env var (standard GCP way)
  if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
    const credPath = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    if (fs.existsSync(credPath)) {
      return {
        type: 'file',
        path: credPath
      };
    }
  }

  // Option 2: GCP_SERVICE_ACCOUNT_JSON env var (JSON string)
  if (process.env.GCP_SERVICE_ACCOUNT_JSON) {
    try {
      const credentials = JSON.parse(process.env.GCP_SERVICE_ACCOUNT_JSON);
      return {
        type: 'json',
        data: credentials
      };
    } catch (error) {
      console.warn('Failed to parse GCP_SERVICE_ACCOUNT_JSON:', error.message);
    }
  }

  // Option 3: gcp-service-account.json in project root
  const rootPath = path.join(__dirname, '..', 'gcp-service-account.json');
  if (fs.existsSync(rootPath)) {
    return {
      type: 'file',
      path: rootPath
    };
  }

  // Option 4: gcp-service-account.json in config directory
  const configPath = path.join(__dirname, 'gcp-service-account.json');
  if (fs.existsSync(configPath)) {
    return {
      type: 'file',
      path: configPath
    };
  }

  // No credentials found
  return {
    type: 'none',
    error: 'No GCP credentials found. Please set GOOGLE_APPLICATION_CREDENTIALS or place gcp-service-account.json in project root.'
  };
}

/**
 * Validate GCP configuration
 */
function validateConfig(config) {
  const errors = [];

  // Check bucket name
  if (!config.bucket.name) {
    errors.push('GCS bucket name is not configured');
  }

  // Check credentials
  if (config.credentials.type === 'none') {
    errors.push(config.credentials.error);
  }

  // Check Firestore project ID (required for Firestore)
  if (!config.firestore.projectId && config.credentials.type === 'json') {
    config.firestore.projectId = config.credentials.data.project_id;
  }

  return {
    valid: errors.length === 0,
    errors
  };
}

/**
 * Get credentials object for Google Cloud SDK
 */
function getCredentialsForSDK(config) {
  if (config.credentials.type === 'file') {
    return {
      keyFilename: config.credentials.path
    };
  } else if (config.credentials.type === 'json') {
    return {
      credentials: config.credentials.data,
      projectId: config.credentials.data.project_id
    };
  }
  return {};
}

module.exports = {
  getGCPConfig,
  validateConfig,
  getCredentialsForSDK
};
