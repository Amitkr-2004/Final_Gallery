const { Storage } = require('@google-cloud/storage');
const { getGCPConfig, getCredentialsForSDK } = require('./config/gcp-config');
const Database = require('better-sqlite3');
require('dotenv').config();

async function checkImagesDetailed() {
  try {
    // Get images from database
    const db = new Database('app-data/database/app.db');
    const dbImages = db.prepare(`
      SELECT image_id, original_filename, gcs_path
      FROM images
      ORDER BY upload_time
    `).all();

    console.log('=== DATABASE IMAGES ===');
    dbImages.forEach((img, i) => {
      console.log(`${i+1}. ${img.original_filename}`);
      console.log(`   ID: ${img.image_id}`);
      console.log(`   Path: ${img.gcs_path || 'NULL'}\n`);
    });

    // Get images from GCS
    const gcpConfig = getGCPConfig();
    const storage = new Storage(getCredentialsForSDK(gcpConfig));
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    console.log('\n=== CHECKING GCS ===');
    const [files] = await bucket.getFiles({ prefix: 'images/' });
    const imageFiles = files.filter(f =>
      (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
    );

    // Group by image ID
    const imagesByCollectionId = {};
    imageFiles.forEach(f => {
      const parts = f.name.split('/');
      const collectionId = parts[1];
      const imageId = parts[2].replace(/\.(jpg|jpeg)$/, '');

      if (!imagesByCollectionId[imageId]) {
        imagesByCollectionId[imageId] = [];
      }
      imagesByCollectionId[imageId].push(f.name);
    });

    const uniqueImageIds = Object.keys(imagesByCollectionId);
    console.log(`Total unique images in GCS: ${uniqueImageIds.length}\n`);

    // Check which DB images are in GCS
    console.log('=== VERIFICATION ===');
    let missing = 0;
    dbImages.forEach((img, i) => {
      const inGCS = imagesByCollectionId[img.image_id];
      if (inGCS) {
        console.log(`${i+1}. ${img.original_filename}: OK (${inGCS.length} file(s))`);
      } else {
        console.log(`${i+1}. ${img.original_filename}: MISSING FROM GCS`);
        missing++;
      }
    });

    if (missing > 0) {
      console.log(`\n❌ ${missing} image(s) missing from GCS`);
    } else {
      console.log(`\n✓ All ${dbImages.length} images found in GCS`);
    }

    db.close();
  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

checkImagesDetailed();
