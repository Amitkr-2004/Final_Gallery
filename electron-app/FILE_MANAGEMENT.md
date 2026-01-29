## File Management System Implementation

## ✅ Task #5 Complete: Local File Management System

---

## Overview

The File Management System provides comprehensive local storage management with:
- ✅ **Hierarchical folder organization** (event/user/date structure)
- ✅ **Thumbnail generation** (using Sharp)
- ✅ **Disk space monitoring** (real-time tracking)
- ✅ **Cache management** (thumbnails, file hashes)
- ✅ **Cleanup policies** (scheduled & manual)
- ✅ **File deduplication** (MD5 hash-based)
- ✅ **Storage health monitoring** (automated warnings)
- ✅ **Trash functionality** (recoverable delete)

---

## Architecture

```
┌──────────────────────────────────────────────────────────┐
│                FILE MANAGEMENT LAYERS                     │
└──────────────────────────────────────────────────────────┘

Layer 1: Storage Monitor (Automated)
├─ Disk space monitoring (every 5 minutes)
├─ Scheduled cleanup (every 24 hours)
├─ Emergency cleanup on low disk space
└─ Health checks

Layer 2: File Manager (Core Operations)
├─ Folder organization
├─ Thumbnail generation
├─ File deduplication
├─ Cache management
└─ Cleanup policies

Layer 3: File System (Basic Operations)
├─ File operations (copy, move, delete)
├─ Directory management
├─ Hash calculation
└─ File existence checks
```

---

## Components

### 1. Enhanced File Manager (`enhanced-file-manager.js`)

**Main file management class with comprehensive features.**

#### Folder Organization

```javascript
const fileManager = createFileManager(configService, logger);

// Create hierarchical structure: downloads/{eventId}/{userId}/{date}/
const folderPath = await fileManager.createImageFolderStructure(
  basePath,
  'event-wedding-2026',
  'user-john',
  '2026-01-28'
);
// Returns: /downloads/event-wedding-2026/user-john/2026-01-28/

// Organize file into structure
const newPath = await fileManager.organizeFile('/temp/IMG_001.jpg', {
  eventId: 'event-wedding-2026',
  userId: 'user-john',
  date: '2026-01-28',
  filename: 'IMG_001.jpg'
});

// List all files in an event
const files = await fileManager.listEventFiles('event-wedding-2026');

// Get files recursively with filters
const jpgFiles = await fileManager.getFilesRecursively('/downloads', {
  extensions: ['.jpg', '.jpeg', '.png']
});
```

#### Thumbnail Generation

```javascript
// Generate single thumbnail
const thumbnailPath = await fileManager.generateThumbnail(
  '/downloads/event/user/date/IMG_001.jpg',
  {
    width: 200,
    height: 200,
    quality: 80,
    format: 'jpeg'
  }
);
// Returns: /processed/thumbnails/IMG_001_200x200.jpeg

// Batch thumbnail generation
const thumbnails = await fileManager.generateThumbnailsBatch(
  ['/path/to/img1.jpg', '/path/to/img2.jpg'],
  { width: 300, height: 300 }
);
// Returns: Map { imagePath => thumbnailPath }

// Delete thumbnail
await fileManager.deleteThumbnail('/path/to/image.jpg');

// Delete all thumbnails
const count = await fileManager.deleteAllThumbnails();
console.log(`Deleted ${count} thumbnails`);
```

**Thumbnail Features:**
- Automatic caching (in-memory)
- Checks for existing thumbnails before generating
- Uses Sharp library (high performance)
- Customizable size, quality, format
- Event emission for tracking

#### Disk Space Monitoring

```javascript
// Get disk space information
const diskSpace = await fileManager.getDiskSpace('/downloads');
// {
//   free: 107374182400,    // 100 GB
//   size: 536870912000,    // 500 GB
//   used: 429496729600,    // 400 GB
//   percentUsed: 80
// }

// Check if enough space available
const hasSpace = await fileManager.hasEnoughDiskSpace(
  '/downloads',
  5 * 1024 * 1024 * 1024  // 5 GB
);

// Get directory size
const size = await fileManager.getDirectorySize('/downloads/event-123');
console.log(`Event folder: ${formatBytes(size)}`);

// Monitor disk space (emits warning if low)
const diskSpace = await fileManager.monitorDiskSpace();
// Emits: 'disk-space:low' if free < threshold

// Event listener
fileManager.on('disk-space:low', ({ free, threshold }) => {
  console.warn(`Low disk space: ${formatBytes(free)} free`);
});
```

#### Cache Management

```javascript
// Thumbnail cache
fileManager.clearThumbnailCache();

// File hash cache (for deduplication)
fileManager.clearFileHashCache();

// Get cached hash
const hash = await fileManager.getCachedFileHash('/path/to/file.jpg');

// Cache hash manually
await fileManager.cacheFileHash('/path/to/file.jpg', 'abc123...');
```

#### Cleanup Policies

```javascript
// Clean up old files
const result = await fileManager.cleanupOldFiles('/downloads', 30);
// Deletes files older than 30 days
// {
//   deletedCount: 45,
//   freedBytes: 5368709120  // 5 GB
// }

// Clean up temp files
const count = await fileManager.cleanupTempFiles();
// Deletes .tmp files and files older than 24 hours

// Run scheduled cleanup
const results = await fileManager.runScheduledCleanup();
// {
//   oldFilesDeleted: 45,
//   tempFilesDeleted: 12,
//   thumbnailsDeleted: 23,
//   totalFreedBytes: 6442450944
// }

// Event listener
fileManager.on('cleanup:completed', ({ deletedCount, freedBytes }) => {
  console.log(`Cleanup freed ${formatBytes(freedBytes)}`);
});
```

#### File Deduplication

```javascript
// Find duplicate files (by MD5 hash)
const duplicates = await fileManager.findDuplicateFiles('/downloads');
// Returns: Map {
//   'abc123...' => ['/path/file1.jpg', '/path/file2.jpg'],
//   'def456...' => ['/path/file3.jpg', '/path/file4.jpg', '/path/file5.jpg']
// }

// Remove duplicates
const result = await fileManager.deduplicateFiles('/downloads', {
  keepStrategy: 'first'  // or 'newest' or 'oldest'
});
// {
//   deletedCount: 78,
//   freedBytes: 10737418240  // 10 GB
// }

// Keep newest file in each duplicate group
await fileManager.deduplicateFiles('/downloads', {
  keepStrategy: 'newest'
});

// Event listener
fileManager.on('deduplication:completed', ({ deletedCount, freedBytes }) => {
  console.log(`Deduplication freed ${formatBytes(freedBytes)}`);
});
```

#### File Operations

```javascript
// Move to trash (recoverable)
const trashPath = await fileManager.moveToTrash('/downloads/file.jpg');
// File moved to: /.trash/1706457600000-file.jpg

// Empty trash
const count = await fileManager.emptyTrash();
console.log(`Emptied ${count} files from trash`);

// Event listener
fileManager.on('file:trashed', ({ filePath, trashPath }) => {
  console.log(`File moved to trash: ${filePath}`);
});
```

#### Storage Statistics

```javascript
const stats = await fileManager.getStorageStatistics();
// {
//   downloadSize: 53687091200,     // 50 GB
//   processedSize: 5368709120,     // 5 GB
//   totalUsed: 59055800320,        // 55 GB
//   diskSpace: {
//     free: 107374182400,
//     size: 536870912000,
//     used: 429496729600,
//     percentUsed: 80
//   },
//   formatted: {
//     downloadSize: '50 GB',
//     processedSize: '5 GB',
//     totalUsed: '55 GB',
//     diskFree: '100 GB',
//     diskSize: '500 GB'
//   }
// }
```

---

### 2. Storage Monitor (`storage-monitor.js`)

**Automated monitoring and maintenance daemon.**

#### Lifecycle Management

```javascript
const storageMonitor = createStorageMonitor(configService, logger);

// Start monitoring
storageMonitor.startMonitoring({
  diskSpaceCheckIntervalMinutes: 5,
  cleanupIntervalHours: 24
});

// Stop monitoring
storageMonitor.stopMonitoring();

// Get status
const status = storageMonitor.getStatus();
// {
//   isMonitoring: true,
//   hasMonitorInterval: true,
//   hasCleanupInterval: true
// }
```

#### Automated Tasks

**Disk Space Monitoring:**
- Runs every 5 minutes (configurable)
- Checks against threshold (from config)
- Emits warnings when low
- Triggers emergency cleanup if critical

**Scheduled Cleanup:**
- Runs every 24 hours (configurable)
- Cleans old files (based on config: cleanupOldFilesAfterDays)
- Cleans temp files (older than 24 hours)
- Cleans old thumbnails (older than 30 days)

**Emergency Cleanup:**
- Triggered when disk space below threshold
- Runs aggressive cleanup
- Performs deduplication if still low
- Emits emergency-cleanup events

#### Manual Operations

```javascript
// Run cleanup manually
const results = await storageMonitor.runManualCleanup();

// Deduplicate storage
const dedupeResults = await storageMonitor.deduplicateStorage({
  keepStrategy: 'newest'
});

// Get storage statistics
const stats = await storageMonitor.getStorageStatistics();

// Delete all thumbnails
const count = await storageMonitor.deleteAllThumbnails();

// Empty trash
const trashCount = await storageMonitor.emptyTrash();
```

#### Health Check

```javascript
const health = await storageMonitor.runHealthCheck();
// {
//   healthy: true,
//   diskSpace: { free: ..., size: ..., percentUsed: ... },
//   storage: { downloadSize: ..., processedSize: ... },
//   warnings: [
//     {
//       type: 'low-disk-space',
//       message: 'Disk space below threshold (5 GB)',
//       severity: 'high'
//     }
//   ]
// }
```

#### Event Listeners

```javascript
storageMonitor.on('monitor:started', () => {
  console.log('Storage monitoring started');
});

storageMonitor.on('disk-space:checked', (diskSpace) => {
  console.log(`Free: ${formatBytes(diskSpace.free)}`);
});

storageMonitor.on('disk-space:low', ({ free, threshold }) => {
  console.warn(`Low disk space: ${formatBytes(free)}`);
});

storageMonitor.on('cleanup:scheduled', (results) => {
  console.log(`Scheduled cleanup: ${results.deletedCount} files deleted`);
});

storageMonitor.on('emergency-cleanup:completed', (results) => {
  console.log('Emergency cleanup completed');
});

storageMonitor.on('health-check:completed', (health) => {
  console.log(`Health: ${health.healthy ? 'OK' : 'WARNING'}`);
});
```

---

## Folder Structure

### Hierarchical Organization

```
app-data/
├── downloads/                          # Main download folder
│   ├── event-wedding-2026/
│   │   ├── user-john-phone/
│   │   │   ├── 2026-01-28/
│   │   │   │   ├── IMG_001.jpg
│   │   │   │   ├── IMG_002.jpg
│   │   │   │   └── IMG_003.jpg
│   │   │   └── 2026-01-29/
│   │   │       └── IMG_004.jpg
│   │   └── user-mary-camera/
│   │       └── 2026-01-28/
│   │           ├── DSC_001.jpg
│   │           └── DSC_002.jpg
│   └── event-birthday-2026/
│       └── user-bob/
│           └── 2026-01-27/
│               └── photo.jpg
│
├── processed/                          # Processed data
│   ├── thumbnails/
│   │   ├── IMG_001_200x200.jpeg
│   │   ├── IMG_002_200x200.jpeg
│   │   └── IMG_003_300x300.jpeg
│   └── results/
│       └── event-wedding-2026/
│           └── processing-results.json
│
├── database/
│   └── app.db
│
├── logs/
│   ├── app-2026-01-28.log
│   └── error-2026-01-28.log
│
├── config/
│   └── settings.json
│
├── temp/                               # Temporary files
│   ├── IMG_001.jpg.tmp                 # Partial downloads
│   └── processing-temp/
│
└── .trash/                             # Recoverable deleted files
    ├── 1706457600000-IMG_001.jpg
    └── 1706457700000-old-file.jpg
```

---

## Configuration

### Storage Settings (`config/default.json`)

```json
{
  "storage": {
    "basePath": "./app-data",
    "downloadPath": "./app-data/downloads",
    "processedPath": "./app-data/processed",
    "databasePath": "./app-data/database",
    "logsPath": "./app-data/logs",
    "configPath": "./app-data/config",
    "tempPath": "./app-data/temp"
  },
  "processing": {
    "generateThumbnails": true,
    "thumbnailWidth": 200,
    "thumbnailHeight": 200,
    "thumbnailQuality": 80
  },
  "performance": {
    "diskSpaceThresholdGB": 5,
    "cleanupOldFilesAfterDays": 30
  }
}
```

### Production Settings (`config/prod.json`)

```json
{
  "performance": {
    "diskSpaceThresholdGB": 10,
    "cleanupOldFilesAfterDays": 60
  }
}
```

---

## Usage Examples

### Basic File Organization

```javascript
const fileManager = createFileManager(configService, logger);

// Download completes, organize file
const downloadedFile = '/temp/downloads/IMG_001.jpg';

const organizedPath = await fileManager.organizeFile(downloadedFile, {
  eventId: 'event-wedding-2026',
  userId: 'user-john',
  date: '2026-01-28',
  filename: 'IMG_001.jpg'
});

console.log(`File organized: ${organizedPath}`);
// /downloads/event-wedding-2026/user-john/2026-01-28/IMG_001.jpg
```

### Thumbnail Generation Workflow

```javascript
// After download completes
const imagePath = '/downloads/event/user/date/IMG_001.jpg';

// Generate thumbnail
const thumbnailPath = await fileManager.generateThumbnail(imagePath);

// Save thumbnail path to database
const { saveProcessingResult } = require('./database/queries');
saveProcessingResult(imageId, {
  thumbnail_path: thumbnailPath
});

// Display in UI
console.log(`Thumbnail: ${thumbnailPath}`);
```

### Automated Storage Monitoring

```javascript
const storageMonitor = createStorageMonitor(configService, logger);

// Setup event listeners
storageMonitor.on('disk-space:low', async ({ free, threshold }) => {
  // Notify user
  mainWindow.webContents.send('storage:low-disk-space', {
    free: formatBytes(free),
    threshold: formatBytes(threshold)
  });

  // Suggest cleanup
  const stats = await storageMonitor.getStorageStatistics();
  console.log(`Current usage: ${stats.formatted.totalUsed}`);
});

storageMonitor.on('cleanup:scheduled', (results) => {
  console.log(`Cleanup freed ${formatBytes(results.totalFreedBytes)}`);

  // Notify user
  mainWindow.webContents.send('storage:cleanup-completed', results);
});

// Start monitoring
storageMonitor.startMonitoring();
```

### Manual Cleanup

```javascript
// User clicks "Clean Up" button in UI
ipcMain.handle('storage:cleanup', async () => {
  const storageMonitor = getStorageMonitor();

  const results = await storageMonitor.runManualCleanup();

  return {
    success: true,
    deletedCount: results.oldFilesDeleted + results.tempFilesDeleted,
    freedSpace: formatBytes(results.totalFreedBytes)
  };
});
```

### Deduplication

```javascript
// User clicks "Find Duplicates" button
ipcMain.handle('storage:find-duplicates', async () => {
  const fileManager = getFileManager();

  const duplicates = await fileManager.findDuplicateFiles(
    config.storage.downloadPath
  );

  // Convert to array for UI
  const duplicateGroups = [];
  for (const [hash, files] of duplicates.entries()) {
    duplicateGroups.push({
      hash,
      files,
      count: files.length,
      totalSize: await Promise.all(
        files.map(f => getFileSize(f))
      ).then(sizes => sizes.reduce((sum, s) => sum + s, 0))
    });
  }

  return duplicateGroups;
});

// User clicks "Remove Duplicates"
ipcMain.handle('storage:remove-duplicates', async (event, options) => {
  const fileManager = getFileManager();

  const results = await fileManager.deduplicateFiles(
    config.storage.downloadPath,
    options
  );

  return results;
});
```

### Health Monitoring Dashboard

```javascript
// Periodic health check (e.g., every hour)
setInterval(async () => {
  const health = await storageMonitor.runHealthCheck();

  if (!health.healthy) {
    // Send notification
    mainWindow.webContents.send('storage:health-warning', {
      warnings: health.warnings
    });

    // Log warnings
    for (const warning of health.warnings) {
      logger.warn('Storage health warning', warning);
    }
  }
}, 60 * 60 * 1000); // 1 hour
```

---

## Integration with Download Manager

### Post-Download Organization

```javascript
// In downloader.js, after download completes
downloadManager.on('download:completed', async (data) => {
  const { localPath, gcsPath } = data;

  // Parse metadata from GCS path
  const metadata = gcpClient.parseGcsPath(gcsPath);

  // Organize file
  const organizedPath = await fileManager.organizeFile(localPath, metadata);

  // Generate thumbnail
  if (config.processing.generateThumbnails) {
    const thumbnailPath = await fileManager.generateThumbnail(organizedPath);

    // Update database
    db.prepare('UPDATE images SET thumbnail_path = ? WHERE id = ?')
      .run(thumbnailPath, data.imageId);
  }

  // Update local path in database
  db.prepare('UPDATE images SET local_path = ? WHERE id = ?')
    .run(organizedPath, data.imageId);
});
```

---

## Performance Optimization

### Thumbnail Generation

```javascript
// Generate thumbnails in batch for better performance
const imagePaths = await fileManager.listEventFiles('event-123');

const thumbnails = await fileManager.generateThumbnailsBatch(imagePaths, {
  width: 200,
  height: 200
});

console.log(`Generated ${thumbnails.size} thumbnails`);
```

### Caching Strategy

```javascript
// Thumbnails cached in memory
// Check cache before generating
// Cache key: imagePath-widthxheight

// File hashes cached with mtime
// Invalidated if file modified
// Speeds up deduplication

// Clear caches when memory high
if (memoryUsage > threshold) {
  fileManager.clearThumbnailCache();
  fileManager.clearFileHashCache();
}
```

### Deduplication Performance

```javascript
// Cache file hashes during scan
// Only calculate hash once per file
// Reuse cached hashes on subsequent scans

// Parallel hash calculation (if needed)
const files = await fileManager.getFilesRecursively('/downloads');

const hashPromises = files.map(async (file) => {
  const hash = await calculateFileHash(file);
  await fileManager.cacheFileHash(file, hash);
  return { file, hash };
});

const results = await Promise.all(hashPromises);
```

---

## Error Handling

### Disk Full Scenarios

```javascript
fileManager.on('disk-space:low', async ({ free, threshold }) => {
  // Try cleanup first
  await storageMonitor.runManualCleanup();

  // Check again
  const newSpace = await fileManager.getDiskSpace(downloadPath);

  if (newSpace.free < threshold) {
    // Still low - try deduplication
    await storageMonitor.deduplicateStorage();

    // Check again
    const finalSpace = await fileManager.getDiskSpace(downloadPath);

    if (finalSpace.free < threshold) {
      // Critical - notify user, pause downloads
      downloadManager.pauseSync();

      mainWindow.webContents.send('storage:critical', {
        message: 'Disk space critically low. Downloads paused.',
        free: formatBytes(finalSpace.free)
      });
    }
  }
});
```

### Thumbnail Generation Errors

```javascript
try {
  const thumbnail = await fileManager.generateThumbnail(imagePath);
} catch (error) {
  if (error.message.includes('unsupported image format')) {
    logger.warn('Skipping thumbnail for unsupported format', { imagePath });
    // Continue without thumbnail
  } else if (error.message.includes('corrupt')) {
    logger.error('Image file corrupted', { imagePath });
    // Mark for re-download
    updateImageStatus(imageId, 'failed', 'failed', null);
  } else {
    throw error;
  }
}
```

---

## Testing

### Unit Tests

```javascript
test('File organization creates correct folder structure', async () => {
  const fileManager = createFileManager(configService, logger);

  const path = await fileManager.createImageFolderStructure(
    '/test',
    'event-1',
    'user-1',
    '2026-01-28'
  );

  expect(path).toBe('/test/event-1/user-1/2026-01-28');
});

test('Thumbnail generation creates file', async () => {
  const thumbnail = await fileManager.generateThumbnail('/test/image.jpg');

  expect(await fileExists(thumbnail)).toBe(true);
  expect(thumbnail).toMatch(/\.jpeg$/);
});

test('Deduplication removes duplicate files', async () => {
  const results = await fileManager.deduplicateFiles('/test');

  expect(results.deletedCount).toBeGreaterThan(0);
  expect(results.freedBytes).toBeGreaterThan(0);
});
```

---

## File Structure

```
electron-app/src/main/storage/
├── file-manager.js                 # Basic operations (from Task #1)
├── enhanced-file-manager.js        # Full featured manager ← NEW
├── storage-monitor.js              # Automated monitoring ← NEW
├── config.js                       # Config service
└── credentials.js                  # Credential storage
```

---

## Integration Points

### For IPC Handlers (Task #7)

```javascript
// Expose storage operations to renderer
ipcMain.handle('storage:get-stats', async () => {
  return await storageMonitor.getStorageStatistics();
});

ipcMain.handle('storage:cleanup', async () => {
  return await storageMonitor.runManualCleanup();
});

ipcMain.handle('storage:find-duplicates', async () => {
  const duplicates = await fileManager.findDuplicateFiles(downloadPath);
  return Array.from(duplicates.entries());
});

ipcMain.handle('storage:health-check', async () => {
  return await storageMonitor.runHealthCheck();
});
```

### For UI (Task #8)

```javascript
// React component
function StorageMonitor() {
  const [stats, setStats] = useState(null);

  useEffect(() => {
    window.electronAPI.storage.getStats().then(setStats);

    const interval = setInterval(async () => {
      const newStats = await window.electronAPI.storage.getStats();
      setStats(newStats);
    }, 60000); // Update every minute

    return () => clearInterval(interval);
  }, []);

  return (
    <div>
      <h2>Storage</h2>
      <p>Used: {stats?.formatted.totalUsed}</p>
      <p>Free: {stats?.formatted.diskFree}</p>
    </div>
  );
}
```

---

## Security Considerations

✅ **Path Traversal Prevention**
- All paths validated
- Relative paths resolved to absolute
- Files restricted to designated folders

✅ **Trash Functionality**
- Recoverable delete instead of permanent
- Trash automatically emptied on cleanup
- User can restore files if needed

✅ **Hash Verification**
- MD5 hashes for deduplication
- Cached with modification time
- Invalidated on file changes

---

**Implementation Date:** 2026-01-28
**Status:** ✅ Complete
**Production Ready:** Yes
