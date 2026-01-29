/**
 * Configuration Service
 * Loads environment-specific configuration with fallback to defaults
 * Supports local.json for user-specific overrides (gitignored)
 */

const path = require('path');
const fs = require('fs');

class ConfigService {
  constructor() {
    this.config = null;
    this.environment = process.env.NODE_ENV || 'development';
    this.configDir = path.join(__dirname, '../../../config');
  }

  /**
   * Load configuration based on environment
   * Merge order: default.json -> env.json -> local.json
   */
  load() {
    try {
      // 1. Load default configuration
      const defaultConfig = this.loadConfigFile('default.json');

      // 2. Load environment-specific configuration
      const envFile = `${this.environment}.json`;
      const envConfig = this.loadConfigFile(envFile);

      // 3. Load local overrides (user-specific, gitignored)
      const localConfig = this.loadConfigFile('local.json', true);

      // Deep merge configurations
      this.config = this.deepMerge(
        defaultConfig,
        envConfig,
        localConfig
      );

      // Resolve relative paths to absolute paths
      this.resolvePaths();

      console.log(`✓ Configuration loaded for environment: ${this.environment}`);
      return this.config;
    } catch (error) {
      console.error('Failed to load configuration:', error);
      throw error;
    }
  }

  /**
   * Load a configuration file
   * @param {string} filename - Config file name
   * @param {boolean} optional - If true, don't throw error if file missing
   */
  loadConfigFile(filename, optional = false) {
    const filepath = path.join(this.configDir, filename);

    if (!fs.existsSync(filepath)) {
      if (optional) {
        return {};
      }
      throw new Error(`Configuration file not found: ${filepath}`);
    }

    try {
      const content = fs.readFileSync(filepath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      throw new Error(`Failed to parse ${filename}: ${error.message}`);
    }
  }

  /**
   * Deep merge multiple objects
   */
  deepMerge(...objects) {
    const isObject = obj => obj && typeof obj === 'object' && !Array.isArray(obj);

    return objects.reduce((merged, obj) => {
      Object.keys(obj).forEach(key => {
        const mergedVal = merged[key];
        const objVal = obj[key];

        if (isObject(mergedVal) && isObject(objVal)) {
          merged[key] = this.deepMerge(mergedVal, objVal);
        } else {
          merged[key] = objVal;
        }
      });

      return merged;
    }, {});
  }

  /**
   * Resolve relative paths to absolute paths
   */
  resolvePaths() {
    const appRoot = path.join(__dirname, '../../..');

    // Resolve storage paths
    if (this.config.storage) {
      Object.keys(this.config.storage).forEach(key => {
        if (key.endsWith('Path') && this.config.storage[key]) {
          const relativePath = this.config.storage[key];
          this.config.storage[key] = path.resolve(appRoot, relativePath);
        }
      });
    }
  }

  /**
   * Get configuration value by dot notation path
   * @param {string} keyPath - e.g., 'download.maxConcurrentDownloads'
   * @param {any} defaultValue - Default value if key not found
   */
  get(keyPath, defaultValue = undefined) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const keys = keyPath.split('.');
    let value = this.config;

    for (const key of keys) {
      if (value && typeof value === 'object' && key in value) {
        value = value[key];
      } else {
        return defaultValue;
      }
    }

    return value;
  }

  /**
   * Get entire configuration object
   */
  getAll() {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }
    return this.config;
  }

  /**
   * Update configuration value at runtime (in-memory only)
   * @param {string} keyPath - e.g., 'download.maxConcurrentDownloads'
   * @param {any} value - New value
   */
  set(keyPath, value) {
    if (!this.config) {
      throw new Error('Configuration not loaded. Call load() first.');
    }

    const keys = keyPath.split('.');
    let target = this.config;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in target) || typeof target[key] !== 'object') {
        target[key] = {};
      }
      target = target[key];
    }

    target[keys[keys.length - 1]] = value;
  }

  /**
   * Save user-specific configuration to local.json
   * @param {object} userConfig - User configuration overrides
   */
  saveLocalConfig(userConfig) {
    const localPath = path.join(this.configDir, 'local.json');

    try {
      fs.writeFileSync(
        localPath,
        JSON.stringify(userConfig, null, 2),
        'utf8'
      );
      console.log('✓ Local configuration saved');
      return true;
    } catch (error) {
      console.error('Failed to save local configuration:', error);
      return false;
    }
  }

  /**
   * Validate required configuration values
   */
  validate() {
    const required = [
      'gcp.bucketName',
      'gcp.projectId',
      'storage.basePath',
      'database.filename'
    ];

    const missing = [];

    for (const key of required) {
      const value = this.get(key);
      if (value === undefined || value === null || value === '') {
        missing.push(key);
      }
    }

    if (missing.length > 0) {
      throw new Error(`Missing required configuration: ${missing.join(', ')}`);
    }

    return true;
  }

  /**
   * Get environment name
   */
  getEnvironment() {
    return this.environment;
  }

  /**
   * Check if running in development
   */
  isDevelopment() {
    return this.environment === 'development';
  }

  /**
   * Check if running in production
   */
  isProduction() {
    return this.environment === 'production';
  }
}

// Singleton instance
let configServiceInstance = null;

/**
 * Get ConfigService singleton instance
 */
function getConfigService() {
  if (!configServiceInstance) {
    configServiceInstance = new ConfigService();
  }
  return configServiceInstance;
}

module.exports = {
  ConfigService,
  getConfigService
};
