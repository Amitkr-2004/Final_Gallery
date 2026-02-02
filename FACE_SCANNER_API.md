# Face Scanner API Documentation

## Overview

The Face Scanner API enables facial recognition and search functionality. It can scan a face from an image (uploaded or captured via camera) and match it against collections stored in GCS or locally.

## Features

- **Face Detection**: Extract face embeddings from images using ML models
- **Collection Search**: Match faces against existing face collections
- **Dual Search Modes**: Local (faster) or GCS (cloud-based)
- **Similarity Scoring**: Ranking by confidence and similarity
- **Temporary Image Management**: Handle uploaded/captured images

## API Methods

### 1. Scan Face

Detect a face and generate its 128-dimensional embedding.

```javascript
const result = await window.electronAPI.scanner.scanFace(imagePath);
```

**Parameters:**
- `imagePath` (string): Absolute path to the image file

**Response:**
```javascript
{
  success: true,
  face: {
    embedding: [0.123, -0.456, ...], // 128-dimensional array
    confidence: 0.98,
    boundingBox: { x: 100, y: 150, width: 200, height: 250 },
    landmarks: [{ x: 120, y: 180 }, ...] // Facial landmarks
  }
}
```

### 2. Scan and Match (Complete Workflow)

Scan a face and immediately search for matches in collections.

```javascript
const result = await window.electronAPI.scanner.scanAndMatch(imagePath, {
  threshold: 0.6,    // Similarity threshold (0-1)
  limit: 10,         // Max results
  searchMode: 'local' // 'local' or 'gcs'
});
```

**Parameters:**
- `imagePath` (string): Absolute path to the image
- `options` (object):
  - `threshold` (number, default: 0.6): Maximum distance for a match (lower = stricter)
  - `limit` (number, default: 10): Maximum number of results
  - `searchMode` (string, default: 'local'): 'local' (faster) or 'gcs' (cloud)

**Response:**
```javascript
{
  success: true,
  scanned_face: {
    confidence: 0.98,
    boundingBox: { x: 100, y: 150, width: 200, height: 250 }
  },
  matches: [
    {
      collection_id: "abc-123",
      collection_name: "Person 1",
      total_faces: 15,
      image_ids: ["img1", "img2"],
      match: {
        face_id: "face-xyz",
        image_id: "img1",
        distance: 0.42,
        similarity: 0.58, // 1 - distance
        confidence: 0.95,
        is_representative: true,
        matched_at: "2026-02-02T10:30:00.000Z"
      }
    }
  ],
  stats: {
    total_collections_scanned: 50,
    total_matches_found: 3,
    threshold_used: 0.6,
    search_mode: "local"
  }
}
```

### 3. Search Collections (Manual)

Search for matches using a pre-computed embedding.

#### Local Search (Faster)
```javascript
const result = await window.electronAPI.scanner.searchCollectionsLocal(
  embedding,  // 128-dim array
  threshold,  // 0.6
  limit       // 10
);
```

#### GCS Search (Cloud-based)
```javascript
const result = await window.electronAPI.scanner.searchCollections(
  embedding,
  threshold,
  limit
);
```

### 4. Save Temporary Image

Save a captured/uploaded image for scanning (useful for webcam captures).

```javascript
const result = await window.electronAPI.scanner.saveTempImage(
  dataUrl,   // Base64 data URL
  filename   // Optional filename
);

// Returns: { success: true, path: "/tmp/face-scanner/scan_123456.jpg" }
```

### 5. Cleanup Temporary Files

Remove temporary images older than 1 hour.

```javascript
await window.electronAPI.scanner.cleanupTemp();
```

## Understanding Similarity Scores

### Distance vs Similarity
- **Distance**: 0 = identical, higher = more different
- **Similarity**: 1 - distance (0 = different, 1 = identical)

### Threshold Guidelines
- `0.4` - Very strict (same photo, slight variations)
- `0.6` - Recommended (same person, different photos)
- `0.8` - Loose (may include similar-looking people)

## Complete Usage Examples

### Example 1: Simple Face Match

```javascript
// Scan an image and find matches
const result = await window.electronAPI.scanner.scanAndMatch(
  'D:\\photos\\person.jpg',
  { threshold: 0.6, limit: 5, searchMode: 'local' }
);

if (result.success) {
  console.log(`Found ${result.matches.length} matches`);

  result.matches.forEach(match => {
    console.log(`
      Collection: ${match.collection_name}
      Similarity: ${(match.match.similarity * 100).toFixed(1)}%
      Images: ${match.image_ids.length}
    `);
  });
} else {
  console.error('Scan failed:', result.error);
}
```

### Example 2: Webcam Capture and Match

```javascript
// 1. Capture from webcam (using HTML5 video/canvas)
const video = document.getElementById('webcam');
const canvas = document.createElement('canvas');
canvas.width = video.videoWidth;
canvas.height = video.videoHeight;
canvas.getContext('2d').drawImage(video, 0, 0);
const dataUrl = canvas.toDataURL('image/jpeg');

// 2. Save temporarily
const saveResult = await window.electronAPI.scanner.saveTempImage(dataUrl);

if (!saveResult.success) {
  console.error('Failed to save image');
  return;
}

// 3. Scan and match
const result = await window.electronAPI.scanner.scanAndMatch(
  saveResult.path,
  { threshold: 0.6, searchMode: 'local' }
);

// 4. Cleanup
await window.electronAPI.scanner.cleanupTemp();

// 5. Display results
if (result.success && result.matches.length > 0) {
  const topMatch = result.matches[0];
  console.log(`
    Identified: ${topMatch.collection_name}
    Confidence: ${(topMatch.match.similarity * 100).toFixed(1)}%
  `);
}
```

### Example 3: Multi-Step Workflow

```javascript
// 1. Scan the face first
const scanResult = await window.electronAPI.scanner.scanFace('path/to/image.jpg');

if (!scanResult.success) {
  console.error('No face detected');
  return;
}

console.log(`Face detected with ${(scanResult.face.confidence * 100).toFixed(1)}% confidence`);

// 2. Try local search first (faster)
let matchResult = await window.electronAPI.scanner.searchCollectionsLocal(
  scanResult.face.embedding,
  0.6,
  10
);

// 3. If no local matches, try GCS
if (matchResult.success && matchResult.matches.length === 0) {
  console.log('No local matches, searching GCS...');

  matchResult = await window.electronAPI.scanner.searchCollections(
    scanResult.face.embedding,
    0.6,
    10
  );
}

// 4. Display results
if (matchResult.matches.length > 0) {
  console.log('Matches found:', matchResult.matches);
} else {
  console.log('No matches found - this might be a new person');
}
```

### Example 4: Batch Scanning

```javascript
// Scan multiple images
const imagePaths = [
  'D:\\photos\\person1.jpg',
  'D:\\photos\\person2.jpg',
  'D:\\photos\\person3.jpg'
];

const results = await Promise.all(
  imagePaths.map(path =>
    window.electronAPI.scanner.scanAndMatch(path, {
      threshold: 0.6,
      limit: 3,
      searchMode: 'local'
    })
  )
);

// Process results
results.forEach((result, index) => {
  console.log(`\nImage ${index + 1}:`);

  if (!result.success) {
    console.log('  No face detected or error:', result.error);
    return;
  }

  if (result.matches.length === 0) {
    console.log('  No matches found - new person');
  } else {
    const topMatch = result.matches[0];
    console.log(`  Match: ${topMatch.collection_name}`);
    console.log(`  Similarity: ${(topMatch.match.similarity * 100).toFixed(1)}%`);
  }
});
```

## Testing from DevTools Console

```javascript
// Test 1: Scan a face
const scan = await window.electronAPI.scanner.scanFace('D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\test.jpg');
console.log('Scan result:', scan);

// Test 2: Quick match
const match = await window.electronAPI.scanner.scanAndMatch(
  'D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\test.jpg',
  { threshold: 0.6, limit: 5, searchMode: 'local' }
);
console.log('Match result:', match);

// Test 3: Get all collections first
const collections = await window.electronAPI.face.getCollections();
console.log(`Total collections: ${collections.collections.length}`);
```

## Search Modes Comparison

### Local Search Mode (`searchMode: 'local'`)
- **Pros:**
  - Very fast (no network latency)
  - Works offline
  - No GCS API costs

- **Cons:**
  - Only searches locally available collections
  - Requires local database with embeddings

### GCS Search Mode (`searchMode: 'gcs'`)
- **Pros:**
  - Searches all collections in cloud
  - Works across devices
  - Always up-to-date

- **Cons:**
  - Slower (network + download time)
  - Requires internet connection
  - GCS API costs

**Recommendation:** Use `local` for real-time scanning (e.g., attendance, access control). Use `gcs` when you need comprehensive search across all cloud data.

## Performance Considerations

### Face Detection
- Average time: ~500ms per image
- Depends on: Image size, CPU speed
- Optimization: Resize images to max 1024px width before scanning

### Collection Search
- **Local:**
  - ~10ms per collection
  - ~500ms for 50 collections

- **GCS:**
  - ~100ms per collection (network download)
  - ~5s for 50 collections
  - Limited by network speed

### Recommendations
1. Use local search for interactive UIs
2. Batch GCS searches in background
3. Cache embeddings when possible
4. Clean up temp files regularly

## Error Handling

```javascript
try {
  const result = await window.electronAPI.scanner.scanAndMatch(imagePath);

  if (!result.success) {
    switch (result.error) {
      case 'No face detected in the image':
        // Show "No face found" message
        break;
      case 'Image file not found':
        // Invalid path
        break;
      default:
        // Other errors
        console.error('Scan error:', result.error);
    }
    return;
  }

  // Process matches
  if (result.matches.length === 0) {
    console.log('No matches - unknown person');
  } else {
    console.log('Found matches:', result.matches);
  }

} catch (error) {
  console.error('Unexpected error:', error);
}
```

## Integration with Existing APIs

### Check Sync Status Before Scanning
```javascript
// Get sync stats
const syncStats = await window.electronAPI.gcs.getSyncStats();
console.log(`Synced collections: ${syncStats.stats.completed}`);

// Ensure collections are synced
if (syncStats.stats.pending > 0) {
  console.log('Syncing collections first...');
  await window.electronAPI.gcs.syncAllCollections();
}

// Now scan
const result = await window.electronAPI.scanner.scanAndMatch(imagePath);
```

### Fetch Collection Details After Match
```javascript
const result = await window.electronAPI.scanner.scanAndMatch(imagePath);

if (result.success && result.matches.length > 0) {
  const topMatch = result.matches[0];

  // Get full collection details
  const collection = await window.electronAPI.face.getCollectionFaces(
    topMatch.collection_id
  );

  console.log('Collection details:', collection);

  // Get person images
  const images = await window.electronAPI.face.getPersonImages(
    topMatch.collection_id
  );

  console.log(`Total images: ${images.images.length}`);
}
```

## Security Considerations

1. **Temporary Files**: Automatically cleaned up after 1 hour
2. **Path Validation**: File existence checked before processing
3. **Sandboxed**: Runs in Main Process with proper IPC isolation
4. **No External Upload**: Images processed locally, embeddings compared locally or in your GCS

## Troubleshooting

### "No face detected"
- Ensure face is clearly visible
- Check image lighting
- Face should be frontal, not profile
- Minimum face size: ~80x80 pixels

### "Failed to search collections"
- Check if collections exist: `await window.electronAPI.face.getCollections()`
- Verify GCS credentials if using GCS search
- Ensure face detection models are loaded

### Slow Performance
- Use `searchMode: 'local'` instead of 'gcs'
- Reduce `limit` parameter
- Process images in background thread

### No Matches Found
- Try increasing `threshold` (e.g., 0.7 or 0.8)
- Verify collections are synced
- Check embedding quality (confidence score)

## Future Enhancements

Potential improvements (not yet implemented):
- Real-time webcam scanning
- Multi-face detection and batch matching
- Embedding caching for faster repeated searches
- Parallel GCS collection fetching
- Progressive result streaming
- Face quality pre-filtering

---

**Last Updated**: 2026-02-02
**Version**: 1.0.0
