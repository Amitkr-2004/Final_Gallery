const Database = require('better-sqlite3');
const path = require('path');

const dbPath = path.join(__dirname, 'app-data', 'database.db');
const db = new Database(dbPath);

// Count total collections
const countResult = db.prepare('SELECT COUNT(*) as count FROM face_collections').get();
console.log('Total collections in local DB:', countResult.count);

// Get most recent collections
const recentCollections = db.prepare(`
  SELECT collection_id, name, created_at
  FROM face_collections
  ORDER BY created_at DESC
  LIMIT 5
`).all();

console.log('\nMost recent collections:');
recentCollections.forEach((col, idx) => {
  console.log(`${idx + 1}. ${col.name} (${col.collection_id.substring(0, 12)}...) - Created: ${col.created_at}`);
});

// Check if there are any collections created today
const today = new Date().toISOString().split('T')[0];
const todayCollections = db.prepare(`
  SELECT COUNT(*) as count
  FROM face_collections
  WHERE created_at LIKE ?
`).get(`${today}%`);

console.log(`\nCollections created today (${today}):`, todayCollections.count);

// Check GCS sync status
const unsyncedCount = db.prepare(`
  SELECT COUNT(*) as count
  FROM face_collections
  WHERE gcs_synced_at IS NULL OR gcs_synced_at = ''
`).get();

console.log('Collections not synced to GCS:', unsyncedCount.count);

db.close();
