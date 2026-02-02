/**
 * Re-cluster all faces with updated threshold
 */

require('dotenv').config();
const { initializeDatabase, getDatabase } = require('./src/main/database/schema');
const { setupLogger } = require('./src/main/utils/logger');
const { getConfigService } = require('./src/main/storage/config');

async function reclusterFaces() {
  console.log('Starting face re-clustering...\n');

  // Initialize
  const configService = getConfigService();
  configService.load();
  const logger = setupLogger(configService);
  const db = initializeDatabase(configService, logger);

  // Initialize clustering service
  const faceClustering = require('./src/main/services/face-clustering');
  faceClustering.initialize(db, logger);

  // Get all faces
  const faces = db.prepare(`
    SELECT f.*, i.image_id
    FROM faces f
    JOIN images i ON f.image_id = i.image_id
    ORDER BY f.created_at ASC
  `).all();

  console.log(`Found ${faces.length} faces to re-cluster\n`);

  let processed = 0;
  const collectionMap = new Map();

  for (const faceRow of faces) {
    try {
      const face = {
        face_id: faceRow.face_id,
        embedding_vector: JSON.parse(faceRow.embedding_vector),
        confidence: faceRow.confidence,
        quality_score: faceRow.quality_score,
        bounding_box: JSON.parse(faceRow.bounding_box),
        landmarks: JSON.parse(faceRow.landmarks)
      };

      const result = await faceClustering.assignFaceToCollection(face, faceRow.image_id);

      processed++;

      if (!collectionMap.has(result.collection_id)) {
        collectionMap.set(result.collection_id, 0);
      }
      collectionMap.set(result.collection_id, collectionMap.get(result.collection_id) + 1);

      console.log(`[${processed}/${faces.length}] Face ${faceRow.face_id.substring(0,8)}... → ${result.action} (collection: ${result.collection_id.substring(0,8)}...)`);
    } catch (error) {
      console.error(`Failed to process face ${faceRow.face_id}:`, error.message);
    }
  }

  // Show results
  console.log('\n=== RE-CLUSTERING COMPLETE ===');
  console.log(`Total faces processed: ${processed}`);
  console.log(`Collections created: ${collectionMap.size}\n`);

  console.log('Collections:');
  let collNum = 1;
  for (const [collId, count] of collectionMap.entries()) {
    console.log(`  ${collNum}. ${collId.substring(0,12)}... - ${count} faces`);
    collNum++;
  }

  // Show collection details from database
  const collections = db.prepare(`
    SELECT fc.collection_id, fc.name,
           COUNT(DISTINCT f.image_id) as image_count,
           COUNT(f.face_id) as face_count
    FROM face_collections fc
    LEFT JOIN face_collection_members fcm ON fc.collection_id = fcm.collection_id
    LEFT JOIN faces f ON fcm.face_id = f.face_id
    GROUP BY fc.collection_id
  `).all();

  console.log('\n=== DATABASE STATUS ===');
  collections.forEach((c, i) => {
    console.log(`${i+1}. ${c.name}: ${c.image_count} images, ${c.face_count} faces`);
  });

  console.log('\n✅ Done! Collections will be auto-synced to GCS on next app start.');
}

reclusterFaces().catch(error => {
  console.error('Re-clustering failed:', error);
  process.exit(1);
});
