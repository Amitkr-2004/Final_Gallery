# Image Processing Pipeline Setup

## Overview

Task #6 implements a comprehensive image processing pipeline with:
- **Face Detection** using @vladmandic/face-api
- **Face Recognition** with descriptor matching
- **Metadata Extraction** (EXIF, GPS, camera info)
- **Age & Gender Estimation**
- **Person Management** for organizing faces
- **Real-time Progress Events**

## Architecture

```
Downloaded Image
    ↓
Metadata Extractor (EXIF, GPS, Camera)
    ↓
Face Detector (SSD MobileNet v1)
    ↓
Face Descriptor Extraction (128-d vector)
    ↓
Face Matching (Euclidean distance)
    ↓
Database Storage (images, faces, persons)
    ↓
Event Emission (progress, completed)
```

## Dependencies

The following packages have been added to `package.json`:

```json
{
  "@vladmandic/face-api": "^1.7.12",
  "canvas": "^2.11.2",
  "exifr": "^7.1.3"
}
```

Install them with:
```bash
npm install
```

## Face Detection Models Setup

### 1. Download Models

Face detection requires pre-trained models. Download them from:
https://github.com/vladmandic/face-api/tree/master/model

Required models:
- `ssd_mobilenetv1_model-weights_manifest.json`
- `ssd_mobilenetv1_model-shard1`
- `face_landmark_68_model-weights_manifest.json`
- `face_landmark_68_model-shard1`
- `face_recognition_model-weights_manifest.json`
- `face_recognition_model-shard1`
- `age_gender_model-weights_manifest.json`
- `age_gender_model-shard1`

### 2. Place Models

Create a `models` directory in your app data path:
```
app-data/
  └── models/
      ├── ssd_mobilenetv1_model-weights_manifest.json
      ├── ssd_mobilenetv1_model-shard1
      ├── face_landmark_68_model-weights_manifest.json
      ├── face_landmark_68_model-shard1
      ├── face_recognition_model-weights_manifest.json
      ├── face_recognition_model-shard1
      ├── age_gender_model-weights_manifest.json
      └── age_gender_model-shard1
```

Default path: `./app-data/models/`

The processing manager will check for these models on initialization and warn if they're missing.

## Configuration

### Config Options (config/default.json)

```json
{
  "processing": {
    "maxConcurrentProcessing": 2,     // Parallel processing workers
    "batchSize": 10,                   // Images per batch
    "maxRetries": 3,                   // Retry failed images
    "enableFaceDetection": true,       // Enable face detection
    "enableMetadataExtraction": true,  // Enable EXIF extraction
    "minFaceConfidence": 0.5,          // Min confidence (0-1)
    "faceMatchThreshold": 0.6,         // Face match threshold
    "extractAgeGender": true,          // Estimate age & gender
    "faceThumbnailSize": 150          // Face thumbnail size (px)
  }
}
```

## Usage

### Main Process Integration

```javascript
const ProcessingManager = require('./src/main/processing/processing-manager');

// Initialize
const processingManager = new ProcessingManager(config, logger);
await processingManager.initialize();

// Register with IPC handlers
initializeServices({ processingManager, /* other services */ });

// Setup event forwarding
setupEventForwarding(mainWindow);

// Start processing
await processingManager.start({
  batchSize: 10,
  skipFaceDetection: false,
  skipMetadata: false
});
```

### Renderer Process Usage

```javascript
// Start processing all ready images
await window.electronAPI.processing.start();

// Process specific images
await window.electronAPI.processing.start({
  imageIds: [1, 2, 3],
  batchSize: 5
});

// Listen to progress
const cleanup = window.electronAPI.processing.onProgress((data) => {
  console.log(`Processed ${data.totalProcessed} images`);
  console.log(`Faces detected: ${data.facesDetected}`);
});

// Cleanup listener when done
cleanup();

// Get statistics
const stats = await window.electronAPI.processing.getStats();
console.log(`Total faces: ${stats.totalFaces}`);
console.log(`Avg time: ${stats.avgTimePerImageMs}ms`);
```

### Person Management

```javascript
// Get all persons
const persons = await window.electronAPI.processing.getPersons();

// Create new person
const { id } = await window.electronAPI.processing.createPerson(
  "John Doe",
  { notes: "Friend from college" }
);

// Get unassigned faces
const faces = await window.electronAPI.processing.getUnassignedFaces(50);

// Assign face to person
await window.electronAPI.processing.assignFace(faceId, personId);

// Get faces for an image
const faces = await window.electronAPI.processing.getFaces(imageId);
```

## Database Schema

### Images Table (Extended)
```sql
- face_count: INTEGER        -- Number of faces detected
- processed_at: INTEGER      -- Processing timestamp
- camera_make: TEXT          -- Camera manufacturer
- camera_model: TEXT         -- Camera model
- taken_at: TEXT            -- Photo capture timestamp
- latitude: REAL            -- GPS latitude
- longitude: REAL           -- GPS longitude
- width: INTEGER            -- Image width
- height: INTEGER           -- Image height
```

### Faces Table
```sql
- id: INTEGER PRIMARY KEY
- image_id: INTEGER         -- Reference to images
- person_id: INTEGER        -- Reference to persons (nullable)
- confidence: REAL          -- Detection confidence (0-1)
- bounding_box: TEXT        -- JSON: {x, y, width, height}
- descriptor: TEXT          -- JSON: 128-d face embedding
- landmarks: TEXT           -- JSON: 68 facial landmarks
- age: INTEGER             -- Estimated age
- gender: TEXT             -- Estimated gender
- thumbnail_path: TEXT     -- Path to face thumbnail
```

### Persons Table
```sql
- id: INTEGER PRIMARY KEY
- name: TEXT               -- Person name
- metadata: TEXT          -- JSON: additional info
- created_at: INTEGER
- updated_at: INTEGER
```

## API Reference

### Processing Manager

#### `initialize()`
Loads face detection models from disk.

#### `start(options)`
Start processing images.
- `options.imageIds` - Array of specific image IDs (optional)
- `options.batchSize` - Images per batch (default: 10)
- `options.skipFaceDetection` - Skip face detection (default: false)
- `options.skipMetadata` - Skip metadata extraction (default: false)

#### `pause()`
Pause processing (current batch completes).

#### `resume()`
Resume paused processing.

#### `cancel()`
Cancel processing and clear queue.

#### `getStatus()`
Returns current processing status.

#### `getStats()`
Returns processing statistics.

### Events

#### `processing:started`
Emitted when processing begins.

#### `processing:progress`
Emitted for each processed image.
```javascript
{
  imageId: 123,
  status: 'completed',
  facesDetected: 2,
  totalProcessed: 45,
  queueSize: 10
}
```

#### `processing:batch-completed`
Emitted when a batch completes.
```javascript
{
  batchNumber: 5,
  batchSize: 10,
  totalProcessed: 50,
  totalImages: 100
}
```

#### `processing:completed`
Emitted when all processing completes.
```javascript
{
  timestamp: 1234567890,
  stats: {
    totalProcessed: 100,
    totalFaces: 234,
    totalErrors: 2,
    elapsedMs: 45000
  }
}
```

#### `processing:failed`
Emitted when processing fails.

#### `processing:error`
Emitted when an individual image fails.
```javascript
{
  imageId: 123,
  error: 'Face detection failed',
  retryCount: 1
}
```

## Performance Considerations

### CPU Usage
- Face detection is CPU-intensive
- Recommended: `maxConcurrentProcessing: 2` on typical machines
- Higher values may cause UI lag

### Memory Usage
- Each face descriptor: ~512 bytes
- Models in memory: ~100MB
- Active processing queue: ~50MB

### Processing Speed
- Typical: 1-3 seconds per image
- Depends on:
  - Image resolution
  - Number of faces
  - CPU performance
  - Face detection confidence threshold

### Optimization Tips
1. **Lower confidence threshold** for faster processing (but more false positives)
2. **Reduce batch size** to lower memory usage
3. **Process during idle time** to avoid UI lag
4. **Use worker threads** for heavy processing (future enhancement)

## Error Handling

### Retry Logic
Images that fail processing are retried up to `maxRetries` times (default: 3).

### Error States
- `process_status = 'failed'` - Permanent failure after max retries
- `retry_count` - Number of retry attempts
- `error_message` - Last error message

### Recovery
```javascript
// Get failed images
const failed = await window.electronAPI.database.getFailedImages();

// Retry specific images
await window.electronAPI.processing.start({
  imageIds: failed.map(img => img.id)
});
```

## Testing

### Manual Testing
```javascript
// Process a single test image
await window.electronAPI.processing.start({
  imageIds: [1],
  batchSize: 1
});

// Check results
const faces = await window.electronAPI.processing.getFaces(1);
console.log(`Detected ${faces.length} faces`);
```

### Validation
1. Verify models are loaded: Check logs for "Face detection models loaded successfully"
2. Test face detection: Process image with known faces
3. Verify database: Check `faces` table for inserted records
4. Test matching: Upload duplicate images, verify person_id matching

## Troubleshooting

### Models Not Found
```
Face detection models not found. Please download models...
```
**Solution:** Download models and place in `app-data/models/` directory.

### Canvas Module Error
```
Error: Cannot find module 'canvas'
```
**Solution:** Rebuild native modules:
```bash
npm rebuild canvas --build-from-source
```

### Face Detection Fails
**Possible causes:**
1. Image resolution too low
2. Confidence threshold too high
3. Poor lighting in image
4. Faces too small or occluded

**Solution:** Adjust `minFaceConfidence` in config or check image quality.

### Memory Issues
**Symptoms:** Process crashes or hangs
**Solution:**
1. Reduce `maxConcurrentProcessing` to 1
2. Reduce `batchSize` to 5
3. Process in smaller chunks

## Next Steps

After Task #6, the system progression is:
- **Task #6**: Image Processing Pipeline ✓ (COMPLETED)
- **Task #7**: IPC Communication Layer (IN PROGRESS)
- **Task #8**: Create UI with React
- **Task #9**: Build Upload Client
- **Task #10**: Integrate with Django Backend

The processing pipeline is now fully operational and ready for UI integration in Task #8.
