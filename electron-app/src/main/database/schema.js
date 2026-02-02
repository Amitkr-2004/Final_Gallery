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

  // Main uploaded files table
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

  // Images table for face detection
  db.exec(`
    CREATE TABLE IF NOT EXISTS images (
      image_id TEXT PRIMARY KEY,
      image_path TEXT NOT NULL UNIQUE,
      original_filename TEXT NOT NULL,
      file_hash TEXT,
      upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
      file_size INTEGER,
      width INTEGER,
      height INTEGER,
      total_faces_detected INTEGER DEFAULT 0,
      processing_status TEXT DEFAULT 'pending',
      processing_error TEXT,
      processed_at DATETIME,
      sync_status TEXT DEFAULT 'pending',
      gcs_path TEXT,
      synced_at DATETIME
    );
  `);

  // Faces table
  db.exec(`
    CREATE TABLE IF NOT EXISTS faces (
      face_id TEXT PRIMARY KEY,
      image_id TEXT NOT NULL,
      bounding_box TEXT NOT NULL,
      embedding_vector TEXT NOT NULL,
      confidence REAL,
      landmarks TEXT,
      quality_score REAL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      sync_status TEXT DEFAULT 'pending',
      metadata_gcs_path TEXT,
      synced_at DATETIME,
      FOREIGN KEY (image_id) REFERENCES images(image_id) ON DELETE CASCADE
    );
  `);

  // Face collections (persons/identities)
  db.exec(`
    CREATE TABLE IF NOT EXISTS face_collections (
      collection_id TEXT PRIMARY KEY,
      name TEXT,
      representative_face_id TEXT,
      total_faces INTEGER DEFAULT 0,
      total_images INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (representative_face_id) REFERENCES faces(face_id) ON DELETE SET NULL
    );
  `);

  // Face collection members (junction table)
  db.exec(`
    CREATE TABLE IF NOT EXISTS face_collection_members (
      collection_id TEXT NOT NULL,
      face_id TEXT NOT NULL,
      similarity_score REAL,
      is_representative INTEGER DEFAULT 0,
      added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY (collection_id, face_id),
      FOREIGN KEY (collection_id) REFERENCES face_collections(collection_id) ON DELETE CASCADE,
      FOREIGN KEY (face_id) REFERENCES faces(face_id) ON DELETE CASCADE
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

  // Migration: Fix images table schema if it has wrong structure
  try {
    const imagesTableInfo = db.pragma('table_info(images)');
    if (imagesTableInfo.length > 0) {
      // Check if table has the old schema (id INTEGER PRIMARY KEY instead of image_id TEXT PRIMARY KEY)
      const columnNames = imagesTableInfo.map(col => col.name);
      const hasImageId = columnNames.includes('image_id');
      const hasIdPrimaryKey = imagesTableInfo.some(col => col.name === 'id' && col.pk === 1);

      if (!hasImageId && hasIdPrimaryKey) {
        logger.info('Detected old images table schema, migrating to new schema...');

        // Check if table is empty
        const rowCount = db.prepare('SELECT COUNT(*) as count FROM images').get().count;

        if (rowCount === 0) {
          // Table is empty, safe to drop and recreate
          logger.info('Images table is empty, recreating with correct schema');

          // Drop related tables too since they depend on images
          db.exec('DROP TABLE IF EXISTS face_collection_members');
          db.exec('DROP TABLE IF EXISTS faces');
          db.exec('DROP TABLE IF EXISTS face_collections');
          db.exec('DROP TABLE IF EXISTS images');

          logger.info('Old face detection tables dropped');

          // Recreate with correct schema
          db.exec(`
            CREATE TABLE images (
              image_id TEXT PRIMARY KEY,
              image_path TEXT NOT NULL UNIQUE,
              original_filename TEXT NOT NULL,
              file_hash TEXT,
              upload_time DATETIME DEFAULT CURRENT_TIMESTAMP,
              file_size INTEGER,
              width INTEGER,
              height INTEGER,
              total_faces_detected INTEGER DEFAULT 0,
              processing_status TEXT DEFAULT 'pending',
              processing_error TEXT,
              processed_at DATETIME,
              sync_status TEXT DEFAULT 'pending',
              gcs_path TEXT,
              synced_at DATETIME
            );
          `);

          db.exec(`
            CREATE TABLE faces (
              face_id TEXT PRIMARY KEY,
              image_id TEXT NOT NULL,
              bounding_box TEXT NOT NULL,
              embedding_vector TEXT NOT NULL,
              confidence REAL,
              landmarks TEXT,
              quality_score REAL,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              sync_status TEXT DEFAULT 'pending',
              metadata_gcs_path TEXT,
              synced_at DATETIME,
              FOREIGN KEY (image_id) REFERENCES images(image_id) ON DELETE CASCADE
            );
          `);

          db.exec(`
            CREATE TABLE face_collections (
              collection_id TEXT PRIMARY KEY,
              name TEXT,
              representative_face_id TEXT,
              total_faces INTEGER DEFAULT 0,
              total_images INTEGER DEFAULT 0,
              created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              FOREIGN KEY (representative_face_id) REFERENCES faces(face_id) ON DELETE SET NULL
            );
          `);

          db.exec(`
            CREATE TABLE face_collection_members (
              collection_id TEXT NOT NULL,
              face_id TEXT NOT NULL,
              similarity_score REAL,
              is_representative INTEGER DEFAULT 0,
              added_at DATETIME DEFAULT CURRENT_TIMESTAMP,
              PRIMARY KEY (collection_id, face_id),
              FOREIGN KEY (collection_id) REFERENCES face_collections(collection_id) ON DELETE CASCADE,
              FOREIGN KEY (face_id) REFERENCES faces(face_id) ON DELETE CASCADE
            );
          `);

          logger.info('Face detection tables recreated with correct schema');
        } else {
          // Table has data, need to migrate
          logger.info(`Images table has ${rowCount} rows, migrating data...`);
          db.exec('ALTER TABLE images RENAME TO images_old');
          logger.info('Renamed images to images_old');
        }

        // Recreate images table with correct schema (will happen below in normal table creation)
      }
    }
  } catch (error) {
    logger.warn('Error migrating images table schema', { error: error.message, stack: error.stack });
  }

  // Migration: Add GCP sync tracking columns to images table
  try {
    const imagesTableInfo = db.pragma('table_info(images)');
    const columnNames = imagesTableInfo.map(col => col.name);

    const syncColumns = [
      { name: 'sync_status', type: 'TEXT DEFAULT \'pending\'' },
      { name: 'gcs_path', type: 'TEXT' },
      { name: 'synced_at', type: 'DATETIME' }
    ];

    for (const col of syncColumns) {
      if (!columnNames.includes(col.name)) {
        db.exec(`ALTER TABLE images ADD COLUMN ${col.name} ${col.type}`);
        logger.info(`Added ${col.name} column to images table`);
      }
    }
  } catch (error) {
    logger.warn('Error adding sync columns to images table', { error: error.message });
  }

  // Migration: Add GCP sync tracking columns to faces table
  try {
    const facesTableInfo = db.pragma('table_info(faces)');
    const columnNames = facesTableInfo.map(col => col.name);

    const syncColumns = [
      { name: 'sync_status', type: 'TEXT DEFAULT \'pending\'' },
      { name: 'metadata_gcs_path', type: 'TEXT' },
      { name: 'synced_at', type: 'DATETIME' }
    ];

    for (const col of syncColumns) {
      if (!columnNames.includes(col.name)) {
        db.exec(`ALTER TABLE faces ADD COLUMN ${col.name} ${col.type}`);
        logger.info(`Added ${col.name} column to faces table`);
      }
    }
  } catch (error) {
    logger.warn('Error adding sync columns to faces table', { error: error.message });
  }

  // Create indexes for uploaded_files
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_upload_date ON uploaded_files(upload_date);
    CREATE INDEX IF NOT EXISTS idx_filename ON uploaded_files(filename);
    CREATE INDEX IF NOT EXISTS idx_file_hash ON uploaded_files(file_hash);
  `);

  // Create indexes for images
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_images_upload_time ON images(upload_time);
    CREATE INDEX IF NOT EXISTS idx_images_processing_status ON images(processing_status);
    CREATE INDEX IF NOT EXISTS idx_images_file_hash ON images(file_hash);
    CREATE INDEX IF NOT EXISTS idx_images_sync_status ON images(sync_status);
  `);

  // Create indexes for faces
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_faces_image_id ON faces(image_id);
    CREATE INDEX IF NOT EXISTS idx_faces_created_at ON faces(created_at);
    CREATE INDEX IF NOT EXISTS idx_faces_sync_status ON faces(sync_status);
  `);

  // Create indexes for face_collections
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_collections_created_at ON face_collections(created_at);
    CREATE INDEX IF NOT EXISTS idx_collections_name ON face_collections(name);
  `);

  // Create indexes for face_collection_members
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_members_collection_id ON face_collection_members(collection_id);
    CREATE INDEX IF NOT EXISTS idx_members_face_id ON face_collection_members(face_id);
    CREATE INDEX IF NOT EXISTS idx_members_similarity ON face_collection_members(similarity_score);
  `);

  logger.info('Database tables created');

  // Log all tables for verification
  const tables = db.prepare(`
    SELECT name FROM sqlite_master WHERE type='table' ORDER BY name
  `).all();
  logger.info('📊 Database tables:', {
    tables: tables.map(t => t.name),
    count: tables.length
  });
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
