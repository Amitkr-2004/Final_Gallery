/**
 * Database Schema - Simplified
 * Single table for tracking uploaded files
 */

const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

let dbInstance = null;

/**
 * Initialize database
 * @param {object} configService - Configuration service
 * @param {object} logger - Logger instance
 * @returns {Database} Database instance
 */
function initializeDatabase(configService, logger) {
  const dbDir = path.join(configService.get('storage.appDataPath'), 'database');

  // Ensure database directory exists
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const dbPath = path.join(dbDir, 'app.db');
  dbInstance = new Database(dbPath);

  // Enable WAL mode for better performance
  dbInstance.pragma('journal_mode = WAL');
  dbInstance.pragma('busy_timeout = 5000');

  logger.info('Database opened', { path: dbPath });

  // Create tables
  createTables(logger);

  return dbInstance;
}

/**
 * Create database tables
 */
function createTables(logger) {
  const db = getDatabase();

  // Simple table for tracking uploaded files
  db.exec(`
    CREATE TABLE IF NOT EXISTS uploaded_files (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      filename TEXT NOT NULL,
      filepath TEXT NOT NULL,
      upload_date TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      file_hash TEXT,
      UNIQUE(filepath)
    );
  `);

  // Migration: Add file_hash column if it doesn't exist
  try {
    const tableInfo = db.pragma('table_info(uploaded_files)');
    const hasFileHash = tableInfo.some(col => col.name === 'file_hash');

    if (!hasFileHash) {
      db.exec('ALTER TABLE uploaded_files ADD COLUMN file_hash TEXT');
      logger.info('Added file_hash column to uploaded_files table');
    }
  } catch (error) {
    logger.warn('Error checking/adding file_hash column', { error: error.message });
  }

  // Create indexes
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_upload_date ON uploaded_files(upload_date);
    CREATE INDEX IF NOT EXISTS idx_filename ON uploaded_files(filename);
    CREATE INDEX IF NOT EXISTS idx_file_hash ON uploaded_files(file_hash);
  `);

  logger.info('Database tables created');
}

/**
 * Get database instance
 * @returns {Database} Database instance
 */
function getDatabase() {
  if (!dbInstance) {
    throw new Error('Database not initialized');
  }
  return dbInstance;
}

/**
 * Close database
 */
function closeDatabase() {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
  }
}

/**
 * Get database statistics
 * @returns {object} Database stats
 */
function getStats() {
  const db = getDatabase();

  const totalFiles = db.prepare('SELECT COUNT(*) as count FROM uploaded_files').get().count;
  const totalSize = db.prepare('SELECT SUM(file_size) as total FROM uploaded_files').get().total || 0;

  const dbSize = fs.statSync(dbInstance.name).size;

  return {
    totalFiles,
    totalSizeBytes: totalSize,
    databaseSizeBytes: dbSize
  };
}

module.exports = {
  initializeDatabase,
  getDatabase,
  closeDatabase,
  getStats
};
