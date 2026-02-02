/**
 * Upload All Images to GCS
 * Uploads all processed images and their face data to Google Cloud Storage
 */

require('dotenv').config();
const { initializeDatabase, getDatabase } = require('./src/main/database/schema');
const { setupLogger } = require('./src/main/utils/logger');
const { getConfigService } = require('./src/main/storage/config');

async function uploadAllToGCS() {
  try {
    console.log('\n=== Starting GCS Upload Process ===\n');

    // Initialize services
    const configService = getConfigService();
    configService.load();
    const logger = setupLogger(configService);
    const db = initializeDatabase(configService, logger);

    console.log('✓ Services initialized\n');

    // Check current status
    const stats = {
      total: db.prepare('SELECT COUNT(*) as count FROM images').get().count,
      processed: db.prepare('SELECT COUNT(*) as count FROM images WHERE processing_status = "completed"').get().count,
      pending: db.prepare('SELECT COUNT(*) as count FROM images WHERE processing_status = "completed" AND (sync_status = "pending" OR sync_status IS NULL)').get().count,
      synced: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "completed"').get().count,
      failed: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "failed"').get().count
    };

    console.log('📊 Current Status:');
    console.log(`   Total images: ${stats.total}`);
    console.log(`   Processed: ${stats.processed}`);
    console.log(`   Already synced: ${stats.synced}`);
    console.log(`   Pending upload: ${stats.pending}`);
    console.log(`   Failed: ${stats.failed}\n`);

    if (stats.pending === 0 && stats.failed === 0) {
      console.log('✅ All images are already uploaded to GCS!\n');
      return;
    }

    // Initialize GCS upload service
    const { initialize: initializeGCSUpload, batchSync } = require('./src/main/services/gcs-upload');
    const result = await initializeGCSUpload(db, logger);

    if (!result.success) {
      console.error('❌ Failed to initialize GCS service:', result.error);
      return;
    }

    console.log('✓ GCS service initialized\n');

    // Get all pending images
    const pendingImages = db.prepare(`
      SELECT image_id, file_name
      FROM images
      WHERE processing_status = 'completed'
      AND (sync_status = 'pending' OR sync_status IS NULL OR sync_status = 'failed')
      ORDER BY created_at DESC
    `).all();

    if (pendingImages.length === 0) {
      console.log('✅ No pending images to upload!\n');
      return;
    }

    console.log(`📤 Starting upload of ${pendingImages.length} images...\n`);

    // Upload in batches
    const imageIds = pendingImages.map(img => img.image_id);
    const uploadResult = await batchSync(imageIds);

    console.log('\n📊 Upload Results:');
    console.log(`   Total: ${uploadResult.stats.total}`);
    console.log(`   Succeeded: ${uploadResult.stats.succeeded} ✅`);
    console.log(`   Failed: ${uploadResult.stats.failed} ${uploadResult.stats.failed > 0 ? '❌' : ''}`);

    if (uploadResult.results && uploadResult.results.length > 0) {
      console.log('\n📝 Details:');
      uploadResult.results.forEach((result, i) => {
        const status = result.success ? '✅' : '❌';
        const fileName = pendingImages[i]?.file_name || 'unknown';
        console.log(`   ${status} ${fileName}`);
        if (!result.success) {
          console.log(`      Error: ${result.error}`);
        }
      });
    }

    // Upload collections
    console.log('\n\n=== Uploading Collections ===\n');

    const collections = db.prepare('SELECT collection_id, name FROM face_collections').all();
    console.log(`📦 Found ${collections.length} collections\n`);

    if (collections.length > 0) {
      const { syncAllCollections } = require('./src/main/services/gcs-upload');
      const collectionResult = await syncAllCollections();

      console.log('📊 Collection Upload Results:');
      console.log(`   Total: ${collectionResult.stats.total}`);
      console.log(`   Succeeded: ${collectionResult.stats.succeeded} ✅`);
      console.log(`   Failed: ${collectionResult.stats.failed} ${collectionResult.stats.failed > 0 ? '❌' : ''}`);
    }

    // Final status
    const finalStats = {
      synced: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "completed"').get().count,
      pending: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "pending" OR sync_status IS NULL').get().count,
      failed: db.prepare('SELECT COUNT(*) as count FROM images WHERE sync_status = "failed"').get().count
    };

    console.log('\n\n=== Upload Complete ===\n');
    console.log('📊 Final Status:');
    console.log(`   ✅ Synced: ${finalStats.synced}`);
    console.log(`   ⏳ Pending: ${finalStats.pending}`);
    console.log(`   ❌ Failed: ${finalStats.failed}\n`);

    if (finalStats.failed > 0) {
      console.log('⚠️  Some uploads failed. Check logs for details.');
      console.log('   You can retry failed uploads using the Electron app.\n');
    }

    console.log('🎉 Process complete!\n');

  } catch (error) {
    console.error('\n❌ Upload process failed:', error.message);
    console.error(error.stack);
  }
}

// Run the upload
uploadAllToGCS().catch(console.error);
