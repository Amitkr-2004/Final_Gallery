# Download Manager Implementation

## ✅ Task #4 Complete: Download Manager with Resume Capability

---

## Overview

The Download Manager provides a robust, production-ready system for downloading files from Google Cloud Storage with:
- ✅ **Parallel downloads** (configurable workers)
- ✅ **Resume capability** for interrupted downloads
- ✅ **MD5 checksum verification**
- ✅ **Progress tracking** with real-time updates
- ✅ **Retry logic** with exponential backoff
- ✅ **Bandwidth control** (optional)
- ✅ **Disk space monitoring**
- ✅ **Database integration** with sync state tracking

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                  DOWNLOAD FLOW                           │
└──────────────────────────────────────────────────────────┘

User clicks "Sync"
    │
    ▼
SyncManager.startFullSync()
    │
    │ 1. List files from GCS (via backend API)
    │
    ▼
DownloadManager.listFilesFromGCS()
    │
    │ 2. Compare with local database
    │    - Check MD5 hashes
    │    - Verify local files exist
    │    - Determine files to download
    │
    ▼
DownloadManager.determineFilesToDownload()
    │
    │ 3. Request signed URLs (batch)
    │
    ▼
GCPClient.requestSignedDownloadUrlsBatch()
    │
    │ 4. Add to download queue
    │    - Update database (images table)
    │    - Create queue entries
    │    - Add to p-queue
    │
    ▼
DownloadManager.queueDownloads()
    │
    │ 5. Process queue (parallel workers)
    │
    ▼
┌────────────────┬────────────────┬────────────────┐
│   Worker 1     │   Worker 2     │   Worker 3     │
│                │                │                │
│ Download       │ Download       │ Download       │
│ file1.jpg      │ file2.jpg      │ file3.jpg      │
│                │                │                │
│ ↓ Progress     │ ↓ Progress     │ ↓ Progress     │
│ ↓ Checksum     │ ↓ Checksum     │ ↓ Checksum     │
│ ↓ DB Update    │ ↓ DB Update    │ ↓ DB Update    │
└────────────────┴────────────────┴────────────────┘
    │
    │ 6. Emit events to UI
    │
    ▼
UI updates progress bars
```

---

## Components

### 1. Download Manager (`downloader.js`)

**Main orchestrator for all download operations.**

#### Key Features

**Parallel Downloads:**
```javascript
const downloadManager = createDownloadManager(configService, logger);
await downloadManager.initialize();

// Downloads run in parallel (default: 5 concurrent)
await downloadManager.startSync({
  prefix: 'uploads/',
  eventId: 'event-123'
});
```

**Resume Capability:**
```javascript
// Downloads automatically resume from last byte
// Uses HTTP Range header: "bytes=12345-"
// Temp files: /path/to/file.jpg.tmp
// Renamed to final path on completion
```

**Checksum Verification:**
```javascript
// After download, verify MD5 hash
// Matches GCS metadata
// Deletes file if verification fails
// Retries download
```

**Progress Tracking:**
```javascript
downloadManager.on('download:progress', (data) => {
  console.log(`${data.gcsPath}: ${data.percentage}%`);
  console.log(`Speed: ${formatSpeed(data.speed)}`);
});

downloadManager.on('download:completed', (data) => {
  console.log(`Downloaded: ${data.localPath}`);
});
```

#### Methods

```javascript
// Lifecycle
await downloadManager.initialize();
await downloadManager.disconnect();

// Sync operations
await downloadManager.startSync(options);
downloadManager.pauseSync();
downloadManager.resumeSync();
await downloadManager.cancelSync();

// Status
const status = downloadManager.getStatus();
// {
//   isRunning: true,
//   isPaused: false,
//   queueSize: 10,
//   pendingCount: 7,
//   activeDownloads: [...]
// }

const stats = downloadManager.getStats();
// {
//   totalFiles: 100,
//   downloadedFiles: 75,
//   failedFiles: 2,
//   totalBytes: 1073741824,
//   downloadedBytes: 805306368,
//   duration: 45000,
//   avgSpeed: 17895697
// }

// Cleanup
await downloadManager.cleanup();
```

#### Events

```javascript
// Sync lifecycle
downloadManager.on('sync:started', (data) => {});
downloadManager.on('sync:listing-files', () => {});
downloadManager.on('sync:requesting-urls', (data) => {});
downloadManager.on('sync:downloading', (data) => {});
downloadManager.on('sync:completed', (data) => {});
downloadManager.on('sync:failed', (data) => {});
downloadManager.on('sync:paused', (data) => {});
downloadManager.on('sync:resumed', (data) => {});
downloadManager.on('sync:cancelled', (data) => {});

// Download progress
downloadManager.on('download:progress', (data) => {
  // data: { gcsPath, downloadedBytes, totalBytes, percentage, speed }
});

downloadManager.on('download:completed', (data) => {
  // data: { imageId, gcsPath, localPath, size }
});

downloadManager.on('download:failed', (data) => {
  // data: { imageId, gcsPath, error }
});
```

---

### 2. Sync Manager (`sync-manager.js`)

**High-level orchestrator that coordinates download manager with other sync operations.**

#### Features

**Full Sync:**
```javascript
const syncManager = createSyncManager(configService, logger);
await syncManager.initialize();

// Full sync: download + process + upload
await syncManager.startFullSync({
  prefix: 'uploads/',
  eventId: 'event-123'
});
```

**Download-Only Sync:**
```javascript
// Download only (no processing)
await syncManager.startDownloadSync({
  prefix: 'uploads/event-123/'
});
```

**Scheduled Sync:**
```javascript
// Auto-sync every 30 minutes (configured in config.json)
syncManager.startAutoSync();

// Stop auto-sync
syncManager.stopAutoSync();
```

#### Methods

```javascript
// Sync operations
await syncManager.startFullSync(options);
await syncManager.startDownloadSync(options);
syncManager.pauseSync();
syncManager.resumeSync();
await syncManager.cancelSync();

// Auto-sync
syncManager.startAutoSync();
syncManager.stopAutoSync();

// Status
const status = syncManager.getStatus();
// {
//   isInitialized: true,
//   currentSyncId: 123,
//   downloadStatus: {...},
//   lastSync: {...}
// }

const stats = syncManager.getStatistics();

// Cleanup
await syncManager.cleanup();
```

---

### 3. Download Utilities (`download-utils.js`)

**Helper utilities for progress tracking, bandwidth control, and formatting.**

#### Formatting Functions

```javascript
const { formatBytes, formatSpeed, formatETA } = require('./download-utils');

formatBytes(1073741824);  // "1 GB"
formatSpeed(2097152);     // "2 MB/s"
formatETA(3665);          // "1h 1m 5s"
```

#### Bandwidth Limiter

```javascript
const { BandwidthLimiter } = require('./download-utils');

// Limit to 5 MB/s
const limiter = new BandwidthLimiter(5 * 1024 * 1024);

// Consume tokens before downloading
await limiter.consume(chunkSize);

// Update limit dynamically
limiter.setLimit(10 * 1024 * 1024); // 10 MB/s
```

#### Speed Calculator

```javascript
const { SpeedCalculator } = require('./download-utils');

const speedCalc = new SpeedCalculator(10); // 10-sample window

// Add samples
speedCalc.addSample(65536); // 64 KB

// Get current speed
const speed = speedCalc.getSpeed(); // bytes per second
const avgSpeed = speedCalc.getAverageSpeed();
```

#### Progress Tracker

```javascript
const { ProgressTracker } = require('./download-utils');

const tracker = new ProgressTracker(totalBytes);

// Update progress
tracker.update(chunkSize);

// Pause/Resume
tracker.pause();
tracker.resume();

// Get progress
const progress = tracker.getProgress();
// {
//   downloadedBytes, totalBytes, percentage,
//   speed, avgSpeed, eta, elapsed,
//   downloadedFormatted, speedFormatted, etaFormatted
// }
```

#### Progress Aggregator

```javascript
const { ProgressAggregator } = require('./download-utils');

const aggregator = new ProgressAggregator();

// Add downloads
aggregator.addDownload('file1', 1048576);
aggregator.addDownload('file2', 2097152);

// Update progress
aggregator.updateDownload('file1', 65536);
aggregator.updateDownload('file2', 131072);

// Get aggregated progress
const progress = aggregator.getAggregatedProgress();
// {
//   activeDownloads: 2,
//   downloadedBytes, totalBytes, percentage,
//   totalSpeed, eta
// }

// Remove completed
aggregator.removeDownload('file1');
```

---

## Database Integration

### Sync State Tracking

The download manager fully utilizes the **sync state layer** (Task #2):

```sql
-- Track image download state
UPDATE images SET
  sync_status = 'downloading',      -- Overall state
  download_status = 'in_progress',  -- Download state
  last_attempt = 1706457600,        -- Timestamp
  retry_count = 0                   -- Reset on success
WHERE id = 123;

-- Track in download queue
INSERT INTO download_queue (image_id, status, progress_bytes, total_bytes, speed_bps)
VALUES (123, 'downloading', 524288, 2097152, 131072);
```

### Recovery & Resume

```javascript
// On app restart, resume failed downloads
const { getImagesReadyForDownload } = require('../database/queries');

const pendingImages = getImagesReadyForDownload(100);
// Returns images with:
// - download_status IN ('not_started', 'failed')
// - retry_count < 5
// - Ordered by retry_count (prioritize first attempts)

// Resume from partial downloads
// Checks for .tmp files and uses HTTP Range header
```

---

## Configuration

### Download Settings (`config/default.json`)

```json
{
  "download": {
    "maxConcurrentDownloads": 5,
    "chunkSizeBytes": 5242880,
    "retryAttempts": 3,
    "retryDelayMs": 1000,
    "retryBackoffMultiplier": 2,
    "timeoutMs": 30000,
    "checksumVerification": true,
    "resumeDownloads": true
  }
}
```

### Production Settings (`config/prod.json`)

```json
{
  "download": {
    "maxConcurrentDownloads": 8,
    "chunkSizeBytes": 10485760,
    "retryAttempts": 5,
    "timeoutMs": 60000
  }
}
```

---

## Usage Examples

### Basic Sync

```javascript
const { createSyncManager } = require('./sync/sync-manager');

const syncManager = createSyncManager(configService, logger);
await syncManager.initialize();

// Start sync
const result = await syncManager.startFullSync();

console.log(`Downloaded: ${result.downloadedFiles} files`);
console.log(`Failed: ${result.failedFiles} files`);
console.log(`Total: ${formatBytes(result.downloadedBytes)}`);
```

### Event-Specific Sync

```javascript
// Download only files from specific event
await syncManager.startDownloadSync({
  prefix: 'uploads/event-wedding-2026/',
  eventId: 'event-wedding-2026'
});
```

### Progress Monitoring

```javascript
const syncManager = createSyncManager(configService, logger);

// Listen to progress
syncManager.on('download:progress', ({ gcsPath, percentage, speed }) => {
  console.log(`${gcsPath}: ${percentage.toFixed(1)}% @ ${formatSpeed(speed)}`);
});

syncManager.on('sync:completed', (stats) => {
  console.log(`Sync complete in ${stats.duration}ms`);
  console.log(`Avg speed: ${formatSpeed(stats.avgSpeed)}`);
});

await syncManager.initialize();
await syncManager.startFullSync();
```

### Pause & Resume

```javascript
// Start sync
const syncPromise = syncManager.startFullSync();

// Pause after 5 seconds
setTimeout(() => {
  syncManager.pauseSync();
  console.log('Sync paused');
}, 5000);

// Resume after 10 seconds
setTimeout(() => {
  syncManager.resumeSync();
  console.log('Sync resumed');
}, 10000);

await syncPromise;
```

### Retry Failed Downloads

```javascript
const { getFailedImages } = require('./database/queries');

const failedImages = getFailedImages();

console.log(`Found ${failedImages.length} failed downloads`);

// Retry with force redownload
await syncManager.startDownloadSync({
  forceRedownload: true
});
```

---

## Error Handling

### Retry Logic

```javascript
// Automatic retry with exponential backoff
// Attempt 1: Immediate
// Attempt 2: 1 second delay
// Attempt 3: 2 second delay
// Attempt 4: 4 second delay
// Attempt 5: 8 second delay (max)

// Database tracks retry_count
// Max retries: 5 (configurable)
```

### Error Types

```javascript
downloadManager.on('download:failed', ({ gcsPath, error }) => {
  if (error.includes('Insufficient disk space')) {
    // Stop sync, alert user
    syncManager.cancelSync();
  } else if (error.includes('Checksum verification failed')) {
    // File corrupted, already deleted and will retry
  } else if (error.includes('Network timeout')) {
    // Will auto-retry with backoff
  }
});
```

### Database Error Recovery

```javascript
// Images marked as 'failed' can be retried
const { getImagesByStatus } = require('./database/queries');

const failedImages = getImagesByStatus('failed');

// Manual retry
for (const image of failedImages) {
  // Reset status
  updateImageStatus(image.id, 'pending', 'not_started');
  resetImageRetry(image.id);
}

// Re-sync
await syncManager.startDownloadSync();
```

---

## Performance Optimization

### Parallel Downloads

```json
// Low bandwidth
{ "maxConcurrentDownloads": 3 }

// High bandwidth
{ "maxConcurrentDownloads": 10 }

// Server has rate limits
{ "maxConcurrentDownloads": 5 }
```

### Chunk Size

```json
// Slow network (smaller chunks, more frequent progress)
{ "chunkSizeBytes": 1048576 }  // 1 MB

// Fast network (larger chunks, less overhead)
{ "chunkSizeBytes": 10485760 }  // 10 MB
```

### Batch URL Requests

```javascript
// GOOD: Request 1000 URLs in one API call
const urls = await gcpClient.requestSignedDownloadUrlsBatch(gcsPaths);

// BAD: 1000 separate API calls
for (const path of gcsPaths) {
  await gcpClient.getSignedDownloadUrl(path);
}
```

---

## Testing

### Unit Tests

```javascript
// Test download manager initialization
test('DownloadManager initializes correctly', async () => {
  const dm = createDownloadManager(configService, logger);
  await dm.initialize();
  expect(dm.isInitialized).toBe(true);
});

// Test file determination
test('determineFilesToDownload skips existing files', async () => {
  const dm = createDownloadManager(configService, logger);
  const files = await dm.determineFilesToDownload(gcsFiles);
  expect(files.length).toBeLessThan(gcsFiles.length);
});
```

### Integration Tests

```javascript
// Test full sync flow
test('Full sync downloads new files', async () => {
  const syncManager = createSyncManager(configService, logger);
  await syncManager.initialize();

  const result = await syncManager.startFullSync();

  expect(result.downloadedFiles).toBeGreaterThan(0);
  expect(result.failedFiles).toBe(0);
});
```

### Manual Testing

```bash
# Start Electron app
npm run dev

# Trigger sync from UI
# Monitor console for progress logs

# Check database
sqlite3 app-data/database/app.db
SELECT COUNT(*) FROM images WHERE download_status = 'completed';
SELECT * FROM download_queue WHERE status = 'failed';

# Check downloaded files
ls app-data/downloads/
```

---

## File Structure

```
electron-app/src/main/
├── gcp/
│   ├── downloader.js          # Main download manager
│   ├── download-utils.js      # Progress tracking, bandwidth control
│   ├── client.js              # GCP client (signed URLs)
│   └── errors.js              # Error handling
├── sync/
│   └── sync-manager.js        # Sync orchestrator
├── database/
│   ├── schema.js              # Database with sync state
│   └── queries.js             # Query helpers
└── storage/
    └── file-manager.js        # File system operations
```

---

## Integration Points

### For IPC Handlers (Task #7)

```javascript
// Expose to renderer
ipcMain.handle('download:start-sync', async (event, options) => {
  return await syncManager.startFullSync(options);
});

ipcMain.handle('download:pause', async () => {
  syncManager.pauseSync();
});

ipcMain.handle('download:get-status', async () => {
  return syncManager.getStatus();
});

// Progress events
syncManager.on('download:progress', (data) => {
  mainWindow.webContents.send('download:progress', data);
});
```

### For UI (Task #8)

```javascript
// React component
function DownloadMonitor() {
  const [status, setStatus] = useState(null);

  useEffect(() => {
    const unsubscribe = window.electronAPI.download.onProgress((data) => {
      setProgress(data);
    });

    return unsubscribe;
  }, []);

  const handleStartSync = async () => {
    await window.electronAPI.download.startSync();
  };

  // ... render progress bars
}
```

---

## Security Considerations

✅ **No credentials in download flow**
- Downloads use signed URLs (from GCP client)
- URLs expire in 15 minutes
- No service account keys needed

✅ **File integrity**
- MD5 checksum verification
- Corrupted files deleted and re-downloaded

✅ **Path traversal prevention**
- All paths validated
- Files stored in designated download folder
- Hierarchical structure enforced

---

## Troubleshooting

### Downloads Fail with "Signed URL expired"

```javascript
// Clear expired URLs from cache
gcpClient.clearExpiredUrls();

// Restart sync (will request new URLs)
await syncManager.startDownloadSync();
```

### Downloads Slow

```javascript
// Increase concurrent downloads
config.download.maxConcurrentDownloads = 10;

// Increase chunk size
config.download.chunkSizeBytes = 10485760; // 10 MB
```

### Disk Full

```javascript
// Check disk space before sync
const { getDiskSpace } = require('./storage/file-manager');
const space = await getDiskSpace(config.storage.downloadPath);

if (space.free < (5 * 1024 * 1024 * 1024)) {
  throw new Error('Insufficient disk space');
}
```

---

**Implementation Date:** 2026-01-28
**Status:** ✅ Complete
**Production Ready:** Yes
