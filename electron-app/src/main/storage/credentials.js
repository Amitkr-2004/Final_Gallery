/**
 * Secure Credential Storage
 * Uses electron-store with encryption and OS keychain (keytar) for maximum security
 *
 * SECURITY MODEL:
 * - Backend API key encrypted and stored in OS keychain
 * - Signed URLs cached with expiration tracking
 * - All credentials encrypted at rest
 * - Never exposed to renderer process
 */

const Store = require('electron-store');
const keytar = require('keytar');
const crypto = require('crypto');

// Service name for OS keychain
const SERVICE_NAME = 'image-processor-electron';
const API_KEY_ACCOUNT = 'backend-api-key';
const ENCRYPTION_KEY_ACCOUNT = 'store-encryption-key';

// Encrypted store for non-keychain data
let encryptedStore = null;

/**
 * Initialize credential storage
 * @param {object} configService - Configuration service
 * @returns {Promise<void>}
 */
async function initializeCredentialStorage(configService) {
  const config = configService.getAll();

  // Get or create encryption key for electron-store
  let encryptionKey = await keytar.getPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT);

  if (!encryptionKey) {
    // Generate new encryption key
    encryptionKey = crypto.randomBytes(32).toString('hex');
    await keytar.setPassword(SERVICE_NAME, ENCRYPTION_KEY_ACCOUNT, encryptionKey);
  }

  // Initialize encrypted store
  encryptedStore = new Store({
    name: 'credentials',
    cwd: config.storage.configPath,
    encryptionKey: encryptionKey,
    clearInvalidConfig: false // Don't clear on decryption error
  });

  console.log('✓ Credential storage initialized');
}

/**
 * ========================================
 * BACKEND API KEY MANAGEMENT
 * ========================================
 */

/**
 * Set backend API key (stored in OS keychain)
 * @param {string} apiKey - Backend API key
 * @returns {Promise<void>}
 */
async function setBackendApiKey(apiKey) {
  if (!apiKey || typeof apiKey !== 'string') {
    throw new Error('Invalid API key');
  }

  await keytar.setPassword(SERVICE_NAME, API_KEY_ACCOUNT, apiKey);
}

/**
 * Get backend API key from OS keychain
 * @returns {Promise<string|null>} API key or null if not set
 */
async function getBackendApiKey() {
  return await keytar.getPassword(SERVICE_NAME, API_KEY_ACCOUNT);
}

/**
 * Delete backend API key
 * @returns {Promise<boolean>} True if deleted
 */
async function deleteBackendApiKey() {
  return await keytar.deletePassword(SERVICE_NAME, API_KEY_ACCOUNT);
}

/**
 * Check if backend API key is configured
 * @returns {Promise<boolean>} True if API key exists
 */
async function hasBackendApiKey() {
  const apiKey = await getBackendApiKey();
  return apiKey !== null && apiKey !== '';
}

/**
 * ========================================
 * SIGNED URL CACHE MANAGEMENT
 * ========================================
 */

/**
 * Cache signed URL with expiration
 * @param {string} gcsPath - GCS file path
 * @param {string} signedUrl - Signed URL
 * @param {number} expiresAt - Expiration timestamp (seconds)
 */
function cacheSignedUrl(gcsPath, signedUrl, expiresAt) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const cache = encryptedStore.get('signedUrlCache', {});

  cache[gcsPath] = {
    url: signedUrl,
    expiresAt: expiresAt,
    cachedAt: Math.floor(Date.now() / 1000)
  };

  encryptedStore.set('signedUrlCache', cache);
}

/**
 * Get cached signed URL if still valid
 * @param {string} gcsPath - GCS file path
 * @returns {string|null} Signed URL or null if expired/not found
 */
function getCachedSignedUrl(gcsPath) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const cache = encryptedStore.get('signedUrlCache', {});
  const entry = cache[gcsPath];

  if (!entry) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  // Check if expired (with 5 minute buffer for safety)
  const bufferSeconds = 5 * 60;
  if (now >= (entry.expiresAt - bufferSeconds)) {
    // Expired, remove from cache
    delete cache[gcsPath];
    encryptedStore.set('signedUrlCache', cache);
    return null;
  }

  return entry.url;
}

/**
 * Cache multiple signed URLs
 * @param {Array} signedUrls - Array of { gcsPath, signedUrl, expiresAt }
 */
function cacheMultipleSignedUrls(signedUrls) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const cache = encryptedStore.get('signedUrlCache', {});
  const now = Math.floor(Date.now() / 1000);

  for (const { gcsPath, signedUrl, expiresAt } of signedUrls) {
    cache[gcsPath] = {
      url: signedUrl,
      expiresAt: expiresAt,
      cachedAt: now
    };
  }

  encryptedStore.set('signedUrlCache', cache);
}

/**
 * Clear expired signed URLs from cache
 * @returns {number} Number of expired URLs removed
 */
function clearExpiredSignedUrls() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const cache = encryptedStore.get('signedUrlCache', {});
  const now = Math.floor(Date.now() / 1000);
  let removedCount = 0;

  for (const [gcsPath, entry] of Object.entries(cache)) {
    if (now >= entry.expiresAt) {
      delete cache[gcsPath];
      removedCount++;
    }
  }

  if (removedCount > 0) {
    encryptedStore.set('signedUrlCache', cache);
  }

  return removedCount;
}

/**
 * Clear all signed URLs from cache
 */
function clearAllSignedUrls() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  encryptedStore.set('signedUrlCache', {});
}

/**
 * Get signed URL cache statistics
 * @returns {object} Cache stats
 */
function getSignedUrlCacheStats() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const cache = encryptedStore.get('signedUrlCache', {});
  const now = Math.floor(Date.now() / 1000);

  let totalCached = 0;
  let validCount = 0;
  let expiredCount = 0;

  for (const entry of Object.values(cache)) {
    totalCached++;
    if (now >= entry.expiresAt) {
      expiredCount++;
    } else {
      validCount++;
    }
  }

  return {
    totalCached,
    validCount,
    expiredCount
  };
}

/**
 * ========================================
 * SESSION TOKEN MANAGEMENT (Optional)
 * ========================================
 */

/**
 * Set session token (for backend authentication)
 * @param {string} token - Session token
 * @param {number} expiresAt - Expiration timestamp (seconds)
 */
function setSessionToken(token, expiresAt) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  encryptedStore.set('sessionToken', {
    token: token,
    expiresAt: expiresAt,
    createdAt: Math.floor(Date.now() / 1000)
  });
}

/**
 * Get session token if still valid
 * @returns {string|null} Session token or null if expired/not found
 */
function getSessionToken() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const session = encryptedStore.get('sessionToken');

  if (!session) {
    return null;
  }

  const now = Math.floor(Date.now() / 1000);

  if (now >= session.expiresAt) {
    // Expired, remove
    encryptedStore.delete('sessionToken');
    return null;
  }

  return session.token;
}

/**
 * Clear session token
 */
function clearSessionToken() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  encryptedStore.delete('sessionToken');
}

/**
 * ========================================
 * USER PREFERENCES (Non-sensitive)
 * ========================================
 */

/**
 * Set user preference
 * @param {string} key - Preference key
 * @param {any} value - Preference value
 */
function setPreference(key, value) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const prefs = encryptedStore.get('preferences', {});
  prefs[key] = value;
  encryptedStore.set('preferences', prefs);
}

/**
 * Get user preference
 * @param {string} key - Preference key
 * @param {any} defaultValue - Default value if not found
 * @returns {any} Preference value
 */
function getPreference(key, defaultValue = null) {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  const prefs = encryptedStore.get('preferences', {});
  return prefs[key] !== undefined ? prefs[key] : defaultValue;
}

/**
 * ========================================
 * SECURITY & CLEANUP
 * ========================================
 */

/**
 * Clear all credentials and cache
 * Use with caution - this is a full reset
 * @returns {Promise<void>}
 */
async function clearAllCredentials() {
  // Clear keychain
  await deleteBackendApiKey();

  // Clear encrypted store
  if (encryptedStore) {
    encryptedStore.clear();
  }
}

/**
 * Validate credential storage integrity
 * @returns {boolean} True if storage is valid
 */
function validateStorage() {
  if (!encryptedStore) {
    return false;
  }

  try {
    // Try to access the store
    encryptedStore.get('test');
    return true;
  } catch (error) {
    console.error('Credential storage validation failed:', error);
    return false;
  }
}

/**
 * Get storage statistics (for debugging)
 * @returns {object} Storage stats
 */
function getStorageStats() {
  if (!encryptedStore) {
    throw new Error('Credential storage not initialized');
  }

  return {
    storePath: encryptedStore.path,
    size: encryptedStore.size,
    signedUrlCache: getSignedUrlCacheStats()
  };
}

module.exports = {
  // Initialization
  initializeCredentialStorage,

  // Backend API Key
  setBackendApiKey,
  getBackendApiKey,
  deleteBackendApiKey,
  hasBackendApiKey,

  // Signed URL Cache
  cacheSignedUrl,
  getCachedSignedUrl,
  cacheMultipleSignedUrls,
  clearExpiredSignedUrls,
  clearAllSignedUrls,
  getSignedUrlCacheStats,

  // Session Token
  setSessionToken,
  getSessionToken,
  clearSessionToken,

  // Preferences
  setPreference,
  getPreference,

  // Security & Cleanup
  clearAllCredentials,
  validateStorage,
  getStorageStats
};
