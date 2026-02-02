/**
 * Cleanup old collection files from GCS
 * Uses current-collections.json instead of database
 */

const { Storage } = require('@google-cloud/storage');
const path = require('path');
const fs = require('fs');
const { getGCPConfig, getCredentialsForSDK } = require('./config/gcp-config');
require('dotenv').config();

const GCS_BASE_PATH = 'collections/';

async function cleanupOldCollections() {
  try {
    console.log('🧹 Starting GCS collection cleanup...\n');

    // Read current collections from JSON file
    const currentCollections = JSON.parse(fs.readFileSync('current-collections.json', 'utf8'));

    console.log('=== CURRENT COLLECTIONS IN DATABASE ===');
    currentCollections.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.id.substring(0, 8)}...)`);
    });
    console.log();

    const validCollectionIds = new Set(currentCollections.map(c => c.id));
    console.log(`✓ Found ${validCollectionIds.size} valid collections\n`);

    // Initialize GCS
    const gcpConfig = getGCPConfig();
    const storage = new Storage(getCredentialsForSDK(gcpConfig));
    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);

    console.log(`📦 Bucket: ${bucketName}\n`);

    // Get all collection files from GCS
    console.log('📡 Fetching collection files from GCS...');
    const [files] = await bucket.getFiles({ prefix: GCS_BASE_PATH });

    console.log(`\n=== COLLECTION FILES IN GCS ===`);
    const collectionFiles = files.filter(f => f.name.endsWith('.json'));
    console.log(`Found ${collectionFiles.length} collection files\n`);

    let deleted = 0;
    let kept = 0;

    for (const file of collectionFiles) {
      const filename = path.basename(file.name);
      const collectionId = filename.replace('.json', '');

      if (validCollectionIds.has(collectionId)) {
        console.log(`✓ KEEP: ${filename}`);
        kept++;
      } else {
        console.log(`✗ DELETE: ${filename}`);
        await file.delete();
        deleted++;
      }
    }

    console.log(`\n=== CLEANUP COMPLETE ===`);
    console.log(`✓ Kept: ${kept} files`);
    console.log(`✗ Deleted: ${deleted} old files`);
    console.log(`\n🎉 GCS cleanup successful!`);

  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

cleanupOldCollections();
