/**
 * Test Script for Face Scanner
 * Run with: node test-scanner.js
 */

require('dotenv').config();
const path = require('path');
const { initializeDatabase } = require('./src/main/database/schema');
const { setupLogger } = require('./src/main/utils/logger');
const { getConfigService } = require('./src/main/storage/config');

async function testScanner() {
  console.log('\n=== Face Scanner Test ===\n');

  try {
    // Initialize services
    const configService = getConfigService();
    configService.load();
    const logger = setupLogger(configService);
    const db = initializeDatabase(configService, logger);

    // Initialize face detection
    const { initialize: initializeFaceDetection } = require('./src/main/services/face-detection');
    await initializeFaceDetection(logger);
    console.log('✓ Face detection initialized\n');

    // Initialize GCS Upload
    const { initialize: initializeGCSUpload } = require('./src/main/services/gcs-upload');
    await initializeGCSUpload(db, logger);
    console.log('✓ GCS upload initialized\n');

    // Initialize Face Scanner
    const faceScanner = require('./src/main/services/face-scanner');
    faceScanner.initialize(logger);
    console.log('✓ Face scanner initialized\n');

    // Get a test image from database
    const testImage = db.prepare(`
      SELECT image_id, file_name, file_path
      FROM images
      WHERE processing_status = 'completed'
      LIMIT 1
    `).get();

    if (!testImage) {
      console.error('❌ No processed images found in database');
      return;
    }

    console.log('📸 Test Image:', testImage.file_name);
    console.log('Path:', testImage.file_path);
    console.log('');

    // Test 1: Scan Face
    console.log('Test 1: Scanning face...');
    const scanResult = await faceScanner.scanFace(testImage.file_path);

    if (scanResult.success) {
      console.log('✅ Face detected!');
      console.log('  Confidence:', (scanResult.face.confidence * 100).toFixed(1) + '%');
      console.log('  Embedding length:', scanResult.face.embedding.length);
      console.log('  Bounding box:', JSON.stringify(scanResult.face.boundingBox));
    } else {
      console.log('❌ Scan failed:', scanResult.error);
      return;
    }

    console.log('');

    // Test 2: Search Collections (Local)
    console.log('Test 2: Searching collections locally...');
    const searchResult = await faceScanner.searchCollectionsLocal(
      scanResult.face.embedding,
      0.6,
      5
    );

    if (searchResult.success) {
      console.log('✅ Search completed!');
      console.log('  Collections scanned:', searchResult.stats.total_collections_scanned);
      console.log('  Matches found:', searchResult.stats.total_matches_found);

      if (searchResult.matches.length > 0) {
        console.log('\n  Top matches:');
        searchResult.matches.slice(0, 3).forEach((match, i) => {
          console.log(`  ${i + 1}. ${match.collection_name}`);
          console.log(`     Similarity: ${(match.match.similarity * 100).toFixed(1)}%`);
          console.log(`     Distance: ${match.match.distance.toFixed(4)}`);
        });
      } else {
        console.log('  No matches found (threshold too strict or new person)');
      }
    } else {
      console.log('❌ Search failed:', searchResult.error);
    }

    console.log('');

    // Test 3: Complete Workflow
    console.log('Test 3: Testing complete workflow (scanAndMatch)...');
    const workflowResult = await faceScanner.scanAndMatch(
      testImage.file_path,
      { threshold: 0.6, limit: 3, searchMode: 'local' }
    );

    if (workflowResult.success) {
      console.log('✅ Workflow completed!');
      console.log('  Scanned face confidence:', (workflowResult.scanned_face.confidence * 100).toFixed(1) + '%');
      console.log('  Matches found:', workflowResult.matches.length);

      if (workflowResult.matches.length > 0) {
        const topMatch = workflowResult.matches[0];
        console.log('\n  Best match:');
        console.log('    Collection:', topMatch.collection_name);
        console.log('    Similarity:', (topMatch.match.similarity * 100).toFixed(1) + '%');
        console.log('    Total faces in collection:', topMatch.total_faces);
      }
    } else {
      console.log('❌ Workflow failed:', workflowResult.error);
    }

    console.log('\n=== All Tests Completed ===\n');

  } catch (error) {
    console.error('\n❌ Test failed with error:', error.message);
    console.error(error.stack);
  }
}

// Run tests
testScanner().catch(console.error);
