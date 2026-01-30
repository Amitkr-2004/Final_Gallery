/**
 * Database Table Checker
 * Run this to see all tables and their structures in your database
 */

const Database = require('better-sqlite3');
const path = require('path');

// Open database
const dbPath = path.join(__dirname, 'app-data', 'database', 'app.db');
console.log('📁 Database location:', dbPath);
console.log('');

try {
  const db = new Database(dbPath, { readonly: true });

  // Get all tables
  const tables = db.prepare(`
    SELECT name FROM sqlite_master
    WHERE type='table'
    ORDER BY name
  `).all();

  console.log('📊 TABLES IN DATABASE:');
  console.log('='.repeat(60));

  tables.forEach((table, index) => {
    console.log(`${index + 1}. ${table.name}`);

    // Get table structure
    const columns = db.pragma(`table_info(${table.name})`);
    console.log('   Columns:');
    columns.forEach(col => {
      const pk = col.pk ? ' [PRIMARY KEY]' : '';
      const notNull = col.notnull ? ' NOT NULL' : '';
      console.log(`     - ${col.name}: ${col.type}${pk}${notNull}`);
    });

    // Get row count
    const count = db.prepare(`SELECT COUNT(*) as count FROM ${table.name}`).get();
    console.log(`   📈 Rows: ${count.count}`);
    console.log('');
  });

  console.log('='.repeat(60));
  console.log(`✅ Total tables: ${tables.length}`);

  // Check for face detection tables specifically
  const faceDetectionTables = ['images', 'faces', 'face_collections', 'face_collection_members'];
  const foundTables = tables.map(t => t.name);

  console.log('\n🔍 Face Detection Tables Status:');
  faceDetectionTables.forEach(tableName => {
    const exists = foundTables.includes(tableName);
    console.log(`  ${exists ? '✅' : '❌'} ${tableName}`);
  });

  db.close();
} catch (error) {
  console.error('❌ Error:', error.message);
  process.exit(1);
}
