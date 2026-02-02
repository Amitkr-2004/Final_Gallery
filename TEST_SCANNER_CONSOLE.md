# Face Scanner Console Tests

Run these tests in the Electron app DevTools Console (Press F12 or Ctrl+Shift+I)

## Test 1: Check Scanner Availability

```javascript
// Check if scanner API is available
console.log('Scanner API available:', !!window.electronAPI?.scanner);
console.log('Scanner methods:', Object.keys(window.electronAPI?.scanner || {}));
```

## Test 2: Get Test Image Path

```javascript
// Get a test image from the gallery
const images = await window.electronAPI.gallery.getAllFiles({ limit: 1 });
console.log('Test image:', images.files[0]);
const testImagePath = images.files[0]?.file_path;
console.log('Using image path:', testImagePath);
```

## Test 3: Scan a Face

```javascript
// Use the image path from Test 2
const testImagePath = 'D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg';

console.log('Scanning face...');
const scanResult = await window.electronAPI.scanner.scanFace(testImagePath);

console.log('Scan Result:', scanResult);
if (scanResult.success) {
  console.log('✅ Face detected!');
  console.log('  Confidence:', (scanResult.face.confidence * 100).toFixed(1) + '%');
  console.log('  Embedding length:', scanResult.face.embedding.length);
  console.log('  Bounding box:', scanResult.face.boundingBox);
} else {
  console.log('❌ Scan failed:', scanResult.error);
}
```

## Test 4: Scan and Match (Complete Workflow)

```javascript
// Change this path to match an image you have
const testImagePath = 'D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg';

console.log('Running scan and match...');
const result = await window.electronAPI.scanner.scanAndMatch(testImagePath, {
  threshold: 0.6,
  limit: 5,
  searchMode: 'local'
});

console.log('Complete Result:', result);

if (result.success) {
  console.log('✅ Workflow completed!');
  console.log('  Face confidence:', (result.scanned_face.confidence * 100).toFixed(1) + '%');
  console.log('  Collections scanned:', result.stats.total_collections_scanned);
  console.log('  Matches found:', result.matches.length);

  if (result.matches.length > 0) {
    console.log('\n  Top matches:');
    result.matches.forEach((match, i) => {
      console.log(`  ${i + 1}. ${match.collection_name}`);
      console.log(`     Similarity: ${(match.match.similarity * 100).toFixed(1)}%`);
      console.log(`     Distance: ${match.match.distance.toFixed(4)}`);
      console.log(`     Total faces: ${match.total_faces}`);
    });
  } else {
    console.log('  No matches found - try increasing threshold or verify collections exist');
  }
} else {
  console.log('❌ Failed:', result.error);
}
```

## Test 5: Check Collections First

```javascript
// Verify collections exist before scanning
const collections = await window.electronAPI.face.getCollections();
console.log('Total collections:', collections.collections.length);
console.log('First 5 collections:', collections.collections.slice(0, 5).map(c => ({
  name: c.name,
  faces: c.total_faces
})));
```

## Test 6: Full Test Suite

Copy and paste this entire block:

```javascript
(async () => {
  console.log('\n=== Face Scanner Test Suite ===\n');

  // Test 1: Check availability
  console.log('1. Checking scanner availability...');
  if (!window.electronAPI?.scanner) {
    console.error('❌ Scanner API not available!');
    return;
  }
  console.log('✅ Scanner API available\n');

  // Test 2: Get collections
  console.log('2. Checking collections...');
  const collections = await window.electronAPI.face.getCollections();
  console.log(`✅ Found ${collections.collections.length} collections\n`);

  if (collections.collections.length === 0) {
    console.warn('⚠️  No collections found. Upload and process images first.');
    return;
  }

  // Test 3: Get test image
  console.log('3. Getting test image...');
  const images = await window.electronAPI.gallery.getAllFiles({ limit: 1 });
  if (!images.files || images.files.length === 0) {
    console.error('❌ No images found!');
    return;
  }
  const testImagePath = images.files[0].file_path;
  console.log(`✅ Using: ${images.files[0].file_name}\n`);

  // Test 4: Scan face
  console.log('4. Scanning face...');
  const scanResult = await window.electronAPI.scanner.scanFace(testImagePath);
  if (!scanResult.success) {
    console.error('❌ Scan failed:', scanResult.error);
    return;
  }
  console.log(`✅ Face detected (${(scanResult.face.confidence * 100).toFixed(1)}% confidence)\n`);

  // Test 5: Search locally
  console.log('5. Searching collections...');
  const searchResult = await window.electronAPI.scanner.scanAndMatch(testImagePath, {
    threshold: 0.6,
    limit: 5,
    searchMode: 'local'
  });

  if (!searchResult.success) {
    console.error('❌ Search failed:', searchResult.error);
    return;
  }

  console.log('✅ Search completed!');
  console.log(`   Scanned ${searchResult.stats.total_collections_scanned} collections`);
  console.log(`   Found ${searchResult.matches.length} matches\n`);

  if (searchResult.matches.length > 0) {
    console.log('🎯 Top Matches:');
    searchResult.matches.slice(0, 3).forEach((match, i) => {
      console.log(`   ${i + 1}. ${match.collection_name}`);
      console.log(`      Similarity: ${(match.match.similarity * 100).toFixed(1)}%`);
      console.log(`      Faces in collection: ${match.total_faces}`);
    });
  } else {
    console.log('ℹ️  No matches found. Try:');
    console.log('   - Increasing threshold (e.g., 0.7 or 0.8)');
    console.log('   - Verifying face was detected correctly');
  }

  console.log('\n=== Test Suite Complete ===\n');
})();
```

## Test 7: Different Threshold Tests

```javascript
// Test different thresholds
const testImagePath = 'D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg';

const thresholds = [0.4, 0.6, 0.8];

for (const threshold of thresholds) {
  console.log(`\nTesting threshold: ${threshold}`);
  const result = await window.electronAPI.scanner.scanAndMatch(testImagePath, {
    threshold,
    limit: 3,
    searchMode: 'local'
  });

  if (result.success) {
    console.log(`  Matches: ${result.matches.length}`);
    if (result.matches.length > 0) {
      console.log(`  Best: ${result.matches[0].collection_name} (${(result.matches[0].match.similarity * 100).toFixed(1)}%)`);
    }
  }
}
```

## Expected Results

- **Test 1**: Should show scanner API is available
- **Test 2**: Should show image paths from your database
- **Test 3**: Should detect a face and show confidence score
- **Test 4**: Should find matching collections (if they exist)
- **Test 5**: Should list all face collections
- **Test 6**: Complete automated test suite
- **Test 7**: Compare results at different thresholds

## Troubleshooting

### "No face detected"
- Try a different image with a clear, frontal face
- Check image path is correct

### "No matches found"
- Verify collections exist: `await window.electronAPI.face.getCollections()`
- Try higher threshold (0.7 or 0.8)
- Ensure images have been processed and clustered

### "Scanner API not available"
- Check console logs for initialization errors
- Verify app restarted after adding scanner code

## Quick Copy-Paste Test

For fastest testing, use this one-liner:

```javascript
await window.electronAPI.scanner.scanAndMatch('D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg', {threshold: 0.6, limit: 3, searchMode: 'local'}).then(r => console.log('Matches:', r.matches?.length || 0, r.matches?.[0] || 'none'));
```
