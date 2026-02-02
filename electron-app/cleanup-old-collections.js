/**
 * Cleanup old collection files from GCS
 * Keep only the 5 latest collections from local database
 */

const { Storage } = require('@google-cloud/storage');
const Database = require('better-sqlite3');
const path = require('path');
const { getGCPConfig, getCredentialsForSDK } = require('./config/gcp-config');
require('dotenv').config();

const GCS_BASE_PATH = 'dev-gallery-uploads/collections/';

async function cleanupOldCollections() {
  try {
    console.log('🧹 Starting GCS collection cleanup...\n');

    // Initialize GCS
    const gcpConfig = getGCPConfig();
    const storage = new Storage(getCredentialsForSDK(gcpConfig));
    const bucketName = process.env.GCS_BUCKET_NAME;
    const bucket = storage.bucket(bucketName);

    console.log(`📦 Bucket: ${bucketName}\n`);

    // Get current collections from database
    const db = new Database('app-data/database/app.db');
    const currentCollections = db.prepare(`
      SELECT collection_id, name, created_at
      FROM face_collections
      ORDER BY created_at DESC
    `).all();

    console.log('=== CURRENT COLLECTIONS IN DATABASE ===');
    currentCollections.forEach((c, i) => {
      console.log(`${i + 1}. ${c.name} (${c.collection_id.substring(0, 8)}...) - ${c.created_at}`);
    });
    console.log();

    const validCollectionIds = new Set(currentCollections.map(c => c.collection_id));
    console.log(`✓ Found ${validCollectionIds.size} valid collections in database\n`);

    // Get all collection files from GCS
    console.log('📡 Fetching collection files from GCS...');
    const [files] = await bucket.getFiles({ prefix: GCS_BASE_PATH });

    console.log(`\n=== COLLECTION FILES IN GCS ===`);
    const collectionFiles = files.filter(f => f.name.endsWith('.json'));

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

    db.close();
  } catch (error) {
    console.error('❌ Error during cleanup:', error.message);
    process.exit(1);
  }
}

cleanupOldCollections();
