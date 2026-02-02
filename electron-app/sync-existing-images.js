require('dotenv').config();
const Database = require('better-sqlite3');
const path = require('path');
const gcsUpload = require('./src/main/services/gcs-upload');
const logger = console;

async function syncExistingImages() {
  // Initialize database
  const dbPath = path.join(__dirname, 'app-data', 'database', 'app.db');
  const db = new Database(dbPath);

  await gcsUpload.initialize(db, logger, {
    bucket: {
      name: process.env.GCS_BUCKET_NAME
    }
  });

  console.log('Fetching images pending sync...\n');

  // Get all completed images that aren't synced
  const images = db.prepare(`
    SELECT image_id, image_path
    FROM images
    WHERE processing_status = 'completed'
    AND (sync_status = 'pending' OR sync_status IS NULL)
  `).all();

  console.log(`Found ${images.length} images to sync\n`);

  if (images.length === 0) {
    console.log('No images to sync!');
    return;
  }

  // Sync each image
  let succeeded = 0;
  let failed = 0;

  for (const image of images) {
    try {
      console.log(`Syncing ${image.image_id}...`);
      const result = await gcsUpload.syncImage(image.image_id);

      if (result.success) {
        succeeded++;
        console.log(`  OK - Synced`);
      } else {
        failed++;
        console.log(`  FAILED - ${result.error}`);
      }
    } catch (error) {
      failed++;
      console.log(`  ERROR - ${error.message}`);
    }
  }

  console.log('\n===============================');
  console.log('IMAGE SYNC COMPLETE');
  console.log('===============================');
  console.log(`Total: ${images.length}`);
  console.log(`Succeeded: ${succeeded}`);
  console.log(`Failed: ${failed}`);
}

syncExistingImages().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
