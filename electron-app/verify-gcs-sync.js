const { Storage } = require('@google-cloud/storage');
const { getGCPConfig, getCredentialsForSDK } = require('./config/gcp-config');
const fs = require('fs');
require('dotenv').config();

async function verifySync() {
  try {
    // Load database images
    const dbImages = JSON.parse(fs.readFileSync('db-images.json', 'utf8'));

    console.log('=== DATABASE IMAGES ===');
    console.log(`Total: ${dbImages.length} images\n`);

    // Get images from GCS
    const gcpConfig = getGCPConfig();
    const storage = new Storage(getCredentialsForSDK(gcpConfig));
    const bucket = storage.bucket(process.env.GCS_BUCKET_NAME);

    console.log('Fetching files from GCS...');
    const [files] = await bucket.getFiles({ prefix: 'images/' });
    const imageFiles = files.filter(f =>
      (f.name.endsWith('.jpg') || f.name.endsWith('.jpeg'))
    );

    console.log(`Total files in GCS: ${imageFiles.length}\n`);

    // Extract unique image IDs from GCS
    const gcsImageIds = new Set();
    imageFiles.forEach(f => {
      const parts = f.name.split('/');
      const imageId = parts[2].replace(/\.(jpg|jpeg)$/, '');
      gcsImageIds.add(imageId);
    });

    console.log(`Unique images in GCS: ${gcsImageIds.size}\n`);

    // Check each DB image
    console.log('=== VERIFICATION ===');
    let missing = [];
    dbImages.forEach((img, i) => {
      const inGCS = gcsImageIds.has(img.image_id);
      const status = inGCS ? 'OK' : 'MISSING';
      console.log(`${i+1}. ${img.filename}: ${status}`);
      if (!inGCS) {
        missing.push(img);
      }
    });

    if (missing.length > 0) {
      console.log(`\n❌ ${missing.length} image(s) missing from GCS:`);
      missing.forEach(img => {
        console.log(`   - ${img.filename}`);
        console.log(`     ID: ${img.image_id}`);
        console.log(`     Expected path: ${img.gcs_path}\n`);
      });

      // Return missing IDs for upload
      console.log('Missing IDs:', missing.map(m => m.image_id).join(','));
    } else {
      console.log(`\n✓ All ${dbImages.length} images found in GCS`);
    }

  } catch (error) {
    console.error('Error:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

verifySync();
