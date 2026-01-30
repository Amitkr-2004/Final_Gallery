/**
 * Batch Processor for Existing Images
 * Processes all images in uploaded_files table that haven't been processed yet
 */

const { getDatabase } = require('./src/main/database/schema');
const { processImage } = require('./src/main/services/face-processing');
const { initialize: initializeMockFaceDetection } = require('./src/main/services/mock-face-detection');
const { initialize: initializeFaceClustering } = require('./src/main/services/face-clustering');
const { initialize: initializeFaceProcessing } = require('./src/main/services/face-processing');
const path = require('path');
const fs = require('fs');

// Simple console logger
const logger = {
  info: (msg, data) => console.log(`[INFO] ${msg}`, data || ''),
  warn: (msg, data) => console.warn(`[WARN] ${msg}`, data || ''),
  error: (msg, data) => console.error(`[ERROR] ${msg}`, data || '')
};

async function processExistingImages() {
  try {
    console.log('\n🔄 Starting batch processing of existing images...\n');

    // Initialize services
    const configService = require('./src/main/storage/config').getConfigService();
    configService.load();

    const dbPath = path.join(configService.get('storage.appDataPath'), 'database', 'app.db');
    const Database = require('better-sqlite3');
    const db = new Database(dbPath);

    initializeMockFaceDetection(logger);
    initializeFaceClustering(db, logger);
    initializeFaceProcessing(db, logger);

    console.log('✅ Services initialized\n');

    // Get all files from uploaded_files that haven't been processed
    const uploadedFiles = db.prepare(`
      SELECT id, filename, filepath, file_hash, file_size
      FROM uploaded_files
      WHERE file_hash NOT IN (SELECT file_hash FROM images WHERE file_hash IS NOT NULL)
      ORDER BY id ASC
    `).all();

    console.log(`📊 Found ${uploadedFiles.length} images to process\n`);

    if (uploadedFiles.length === 0) {
      console.log('✅ All images already processed!\n');
      db.close();
      return;
    }

    let processed = 0;
    let failed = 0;

    for (const file of uploadedFiles) {
      try {
        // Check if file exists
        if (!fs.existsSync(file.filepath)) {
          console.log(`❌ File not found: ${file.filename}`);
          failed++;
          continue;
        }

        console.log(`Processing ${processed + 1}/${uploadedFiles.length}: ${file.filename}`);

        await processImage(
          file.filepath,
          file.filename,
          file.file_hash,
          file.file_size
        );

        processed++;
        console.log(`  ✅ Done\n`);

        // Small delay to avoid overwhelming the system
        await new Promise(resolve => setTimeout(resolve, 100));

      } catch (error) {
        console.log(`  ❌ Failed: ${error.message}\n`);
        failed++;
      }
    }

    console.log('\n📊 BATCH PROCESSING COMPLETE\n');
    console.log(`✅ Successfully processed: ${processed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📁 Total: ${uploadedFiles.length}\n`);

    // Show statistics
    const stats = db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM images) as total_images,
        (SELECT COUNT(*) FROM faces) as total_faces,
        (SELECT COUNT(*) FROM face_collections) as total_collections
    `).get();

    console.log('📈 DATABASE STATISTICS:\n');
    console.log(`  Images: ${stats.total_images}`);
    console.log(`  Faces: ${stats.total_faces}`);
    console.log(`  Collections: ${stats.total_collections}\n`);

    db.close();
  } catch (error) {
    console.error('\n❌ Batch processing failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run the batch processor
processExistingImages()
  .then(() => {
    console.log('✅ Batch processing completed successfully\n');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
