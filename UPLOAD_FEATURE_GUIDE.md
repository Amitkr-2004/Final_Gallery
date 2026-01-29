# Upload Feature - Complete Implementation Guide

## Overview

The upload feature allows users to upload images to Google Cloud Storage (GCS) directly from the Electron Gallery app. Images are uploaded in the background with progress tracking, retry logic, and automatic face detection processing.

---

## Architecture

### **Flow Diagram**

```
User selects files/folder in Gallery UI
    ↓
Electron IPC: core:upload:start
    ↓
Upload Manager validates files & requests signed URLs
    ↓
Django Backend generates signed upload URLs
    ↓
Files uploaded to GCS in parallel (concurrency: 3)
    ↓
Upload registered with Django backend
    ↓
Auto-trigger face detection processing (if enabled)
    ↓
Images appear in Gallery
```

### **Key Components**

1. **Django Backend** (`backend/api/gcs_views.py`)
   - Generates signed upload URLs
   - Registers completed uploads
   - Validates file sizes and formats

2. **Electron Upload Manager** (`electron-app/src/main/gcp/uploader.js`)
   - Manages parallel uploads (P-Queue with concurrency=3)
   - Progress tracking and events
   - Retry logic with exponential backoff
   - MD5 hash verification

3. **IPC Communication** (`electron-app/src/main/ipc/upload-handlers.js`)
   - File/folder selection dialogs
   - Upload control (start/pause/resume/cancel)
   - Status and progress tracking

4. **React UI Components**
   - `UploadModal.jsx` - File/folder selection interface
   - `UploadProgress.jsx` - Real-time upload progress display
   - Gallery integration with Upload button

---

## Setup Instructions

### **1. Django Backend Configuration**

#### Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

The following dependency was added:
- `google-cloud-storage==2.14.0`

#### Set Environment Variables

Create or update `.env` file:

```env
# GCS Configuration
GCS_BUCKET_NAME=your-image-bucket
GCS_PROJECT_ID=your-gcp-project-id
GOOGLE_APPLICATION_CREDENTIALS=/path/to/service-account-key.json

# Upload Configuration
MAX_IMAGE_SIZE_MB=50
MAX_UPLOAD_BATCH_SIZE=100
```

#### Get GCS Service Account Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Navigate to **IAM & Admin → Service Accounts**
4. Create a new service account or use existing
5. Grant permissions: **Storage Object Admin**
6. Create and download JSON key file
7. Set `GOOGLE_APPLICATION_CREDENTIALS` to the path of this file

#### Test GCS Connection

```bash
curl http://localhost:8000/api/gcs/test-connection/
```

Expected response:
```json
{
  "success": true,
  "bucket": "your-image-bucket",
  "project_id": "your-gcp-project-id",
  "message": "GCS connection successful"
}
```

### **2. Electron App Configuration**

#### Configuration File

The upload configuration is in `electron-app/config/default.json`:

```json
{
  "upload": {
    "maxConcurrentUploads": 3,
    "chunkSizeBytes": 5242880,
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "retryBackoffMultiplier": 2,
    "timeoutMs": 60000,
    "checksumVerification": true,
    "maxFileSizeMB": 50,
    "autoProcessAfterUpload": true,
    "allowedFileTypes": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]
  }
}
```

#### Key Configuration Options

- **maxConcurrentUploads**: Number of parallel uploads (default: 3)
- **maxRetries**: Number of retry attempts on failure (default: 3)
- **autoProcessAfterUpload**: Auto-trigger face detection after upload (default: true)
- **maxFileSizeMB**: Maximum file size allowed (default: 50MB)
- **allowedFileTypes**: Supported image formats

#### Database Migration

The database schema will automatically migrate when you start the Electron app:

**Migration v2**: Adds `upload_status` column to `images` table
**Migration v3**: Creates `upload_queue` table for upload tracking

---

## API Endpoints

### **Django Backend Endpoints**

#### 1. Get Single Signed Upload URL

```http
POST /api/gcs/get-signed-upload-url/
Content-Type: application/json

{
  "filename": "vacation.jpg",
  "content_type": "image/jpeg",
  "event_id": "event123",
  "user_id": "user456",
  "date": "2026-01-28",
  "file_size": 1048576
}
```

Response:
```json
{
  "signed_url": "https://storage.googleapis.com/...",
  "gcs_path": "uploads/event123/user456/2026-01-28/uuid_vacation.jpg",
  "blob_name": "uploads/event123/user456/2026-01-28/uuid_vacation.jpg",
  "expires_in_minutes": 60
}
```

#### 2. Get Batch Signed Upload URLs

```http
POST /api/gcs/get-signed-upload-urls-batch/
Content-Type: application/json

{
  "files": [
    {
      "filename": "image1.jpg",
      "content_type": "image/jpeg",
      "event_id": "event123",
      "user_id": "user456",
      "date": "2026-01-28",
      "file_size": 1048576
    },
    ...
  ]
}
```

Response:
```json
{
  "urls": [
    {
      "signed_url": "https://...",
      "gcs_path": "uploads/...",
      "original_filename": "image1.jpg",
      "unique_filename": "uuid_image1.jpg"
    },
    ...
  ],
  "total": 10,
  "successful": 10,
  "failed": 0,
  "errors": []
}
```

#### 3. Register Upload

```http
POST /api/gcs/register-upload/
Content-Type: application/json

{
  "gcs_path": "uploads/event123/user456/2026-01-28/uuid_image.jpg",
  "original_filename": "vacation.jpg",
  "file_size": 1048576,
  "content_type": "image/jpeg",
  "md5_hash": "abc123...",
  "event_id": "event123",
  "user_id": "user456",
  "upload_date": "2026-01-28T10:30:00Z"
}
```

Response:
```json
{
  "success": true,
  "image_id": null,
  "message": "Image registered successfully"
}
```

---

## Usage Guide

### **Using the Upload Feature**

#### 1. Open the Gallery Page

Navigate to the Gallery page in the Electron app.

#### 2. Click "Upload Images" Button

You'll see an "Upload Images" button in the top-right corner (purple button with ⬆️ icon).

#### 3. Select Files or Folder

**Option A: Select Files**
- Click "Select Files" button
- Multi-select images (Ctrl/Cmd+Click)
- Supported formats: JPG, PNG, GIF, BMP, WEBP

**Option B: Select Folder**
- Click "Select Folder" button
- Choose a folder
- All images in folder (and subfolders) will be found automatically

#### 4. Configure Upload Options

- **Event ID**: Identifier for the event (e.g., "wedding-2026", "vacation-jan")
- **User ID**: User identifier (e.g., "user1", "john-doe")
- **Date**: Upload date (defaults to today)

**GCS Path Preview**: `uploads/{eventId}/{userId}/{date}/{uuid_filename}`

#### 5. Click "Upload"

- Files will be validated
- Signed URLs will be requested from backend
- Uploads will start in parallel (3 concurrent)
- Progress panel will appear in bottom-right

#### 6. Monitor Progress

The upload progress panel shows:
- Overall progress percentage
- Upload speed
- Individual file progress
- File names and sizes

#### 7. Automatic Processing

If `autoProcessAfterUpload` is `true` (default):
- Face detection starts automatically after upload
- Faces are extracted and matched
- Images appear in Gallery with face overlays

---

## Testing

### **Test Scenarios**

#### 1. Single File Upload

```javascript
// In Browser DevTools Console (Electron app)
const files = await window.electronAPI.upload.selectFiles();
await window.electronAPI.upload.start(files.files, {
  eventId: 'test-event',
  userId: 'test-user',
  date: '2026-01-28'
});
```

#### 2. Folder Upload

```javascript
const folder = await window.electronAPI.upload.selectFolder();
console.log(`Found ${folder.files.length} images`);
await window.electronAPI.upload.start(folder.files, {
  eventId: 'test-event',
  userId: 'test-user',
  date: '2026-01-28'
});
```

#### 3. Upload Control

```javascript
// Pause
await window.electronAPI.upload.pause();

// Resume
await window.electronAPI.upload.resume();

// Cancel
await window.electronAPI.upload.cancel();
```

#### 4. Check Status

```javascript
const status = await window.electronAPI.upload.getStatus();
console.log(status);
// Output: { isRunning, isPaused, stats, activeUploads, queueSize }

const stats = await window.electronAPI.upload.getStats();
console.log(stats);
// Output: { totalFiles, uploadedFiles, failedFiles, duration, averageSpeed }
```

### **Manual Testing Checklist**

- [ ] Upload 1 file (< 1MB)
- [ ] Upload multiple files (5-10 files)
- [ ] Upload large file (> 10MB)
- [ ] Upload folder with nested subfolders
- [ ] Test pause/resume functionality
- [ ] Test cancel functionality
- [ ] Test retry on network failure
- [ ] Verify files appear in GCS bucket with correct path
- [ ] Verify automatic face detection triggers after upload
- [ ] Verify images appear in Gallery after processing
- [ ] Test file size validation (try > 50MB)
- [ ] Test unsupported file formats
- [ ] Test duplicate file uploads

---

## Troubleshooting

### **Common Issues**

#### Issue: "GCS connection failed"

**Solution:**
1. Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
2. Check service account has **Storage Object Admin** role
3. Verify GCS bucket exists and is accessible
4. Test with: `curl http://localhost:8000/api/gcs/test-connection/`

#### Issue: "Upload failed: 403 Forbidden"

**Solution:**
- Service account lacks permissions
- Grant **Storage Object Admin** role in GCP Console

#### Issue: "Upload stuck at 0%"

**Solution:**
- Check network connection
- Verify backend API is running (`http://localhost:8000/api/health/`)
- Check browser console for errors (F12 → Console)

#### Issue: "Uploads succeed but images don't appear in Gallery"

**Solution:**
- Check if auto-processing is enabled: `config.upload.autoProcessAfterUpload = true`
- Manually trigger processing from Processing page
- Check Electron logs: `app-data/logs/app.log`

#### Issue: "File size exceeds limit"

**Solution:**
- Increase `MAX_IMAGE_SIZE_MB` in Django `.env`
- Increase `maxFileSizeMB` in Electron `config/default.json`
- Restart both backend and Electron app

---

## Configuration Reference

### **Django Settings** (`backend/config/settings.py`)

```python
# GCS Configuration
GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME')
GCS_PROJECT_ID = os.getenv('GCS_PROJECT_ID')
GOOGLE_APPLICATION_CREDENTIALS = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

# Upload Limits
MAX_IMAGE_SIZE_MB = int(os.getenv('MAX_IMAGE_SIZE_MB', '50'))
MAX_UPLOAD_BATCH_SIZE = int(os.getenv('MAX_UPLOAD_BATCH_SIZE', '100'))
```

### **Electron Configuration** (`electron-app/config/default.json`)

```json
{
  "upload": {
    "maxConcurrentUploads": 3,
    "chunkSizeBytes": 5242880,
    "maxRetries": 3,
    "retryDelayMs": 1000,
    "retryBackoffMultiplier": 2,
    "timeoutMs": 60000,
    "checksumVerification": true,
    "maxFileSizeMB": 50,
    "autoProcessAfterUpload": true,
    "allowedFileTypes": [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp"]
  }
}
```

---

## Advanced Features

### **Resume Capability**

Uploads support resumable protocol:
- Signed URLs valid for 60 minutes
- Failed uploads retry with exponential backoff
- Network interruptions automatically retry

### **Progress Tracking**

Real-time progress events:
```javascript
window.electronAPI.upload.onProgress((data) => {
  console.log(`File: ${data.filename}`);
  console.log(`Progress: ${data.progress}%`);
  console.log(`Speed: ${data.speed} bytes/s`);
});
```

### **Event Listeners**

Available upload events:
- `onStarted` - Upload started
- `onValidating` - Files being validated
- `onRequestingUrls` - Requesting signed URLs
- `onProgress` - Upload progress update
- `onFileCompleted` - Individual file completed
- `onFileFailed` - Individual file failed
- `onCompleted` - All uploads completed
- `onFailed` - Upload batch failed
- `onPaused` - Upload paused
- `onResumed` - Upload resumed
- `onCancelled` - Upload cancelled

---

## Performance Considerations

### **Optimizations**

1. **Parallel Uploads**: 3 concurrent uploads by default
2. **Batch URL Requests**: Request multiple signed URLs in single API call
3. **Streaming**: Files streamed directly to GCS (no intermediate storage)
4. **Progress Throttling**: Progress events throttled to avoid UI lag
5. **MD5 Verification**: Ensures data integrity

### **Recommended Settings**

- **Small files (< 5MB)**: `maxConcurrentUploads: 5`
- **Large files (> 50MB)**: `maxConcurrentUploads: 2`
- **Slow network**: `maxRetries: 5`, `retryDelayMs: 2000`
- **Fast network**: `maxRetries: 3`, `retryDelayMs: 1000`

---

## Security

### **Best Practices**

1. **Never expose service account credentials** in Electron app
2. **All uploads use signed URLs** from Django backend
3. **Signed URLs expire after 60 minutes**
4. **File size limits enforced** on both frontend and backend
5. **File type validation** on client and server
6. **MD5 checksums** verify upload integrity

### **GCS Bucket Permissions**

Recommended IAM configuration:
- Service Account: **Storage Object Admin**
- Bucket: **Private** (not public)
- CORS: Enable if uploading from web browser

---

## What Was Implemented

### **✅ Backend (Django)**

1. `backend/api/gcs_views.py` - 4 new endpoints
2. `backend/api/urls.py` - URL routing
3. `backend/config/settings.py` - GCS configuration
4. `backend/requirements.txt` - Added `google-cloud-storage==2.14.0`

### **✅ Electron Backend**

1. `src/main/gcp/uploader.js` - Upload manager (423 lines)
2. `src/main/gcp/client.js` - Added upload methods
3. `src/main/ipc/upload-handlers.js` - IPC handlers (174 lines)
4. `src/main/database/schema.js` - Migrations v2 & v3
5. `src/main/database/queries.js` - Upload queue queries
6. `config/default.json` - Upload configuration

### **✅ Electron Frontend (React)**

1. `src/renderer/pages/Gallery.jsx` - Upload integration
2. `src/renderer/components/UploadModal.jsx` - File selection UI (187 lines)
3. `src/renderer/components/UploadProgress.jsx` - Progress display (114 lines)
4. `src/renderer/components/Modal.css` - Base modal styles
5. `src/renderer/components/UploadModal.css` - Upload modal styles
6. `src/renderer/components/UploadProgress.css` - Progress styles
7. `src/renderer/preload.js` - Upload API exposure

### **✅ Integration**

1. Auto-trigger processing after upload
2. Event forwarding (11 upload events)
3. Database tracking (upload_status, upload_queue)
4. Configuration (both Django & Electron)

---

## Next Steps

1. **Install dependencies**: `pip install -r backend/requirements.txt`
2. **Configure GCS**: Set environment variables
3. **Test connection**: `curl http://localhost:8000/api/gcs/test-connection/`
4. **Rebuild Electron app**: `npm run build:renderer` (in electron-app/)
5. **Start Electron**: `npm run start:prod`
6. **Test upload**: Upload a few images from Gallery page

---

## Support

For issues or questions:
- Check logs: `backend/logs/` and `electron-app/app-data/logs/`
- Test backend: `curl http://localhost:8000/api/gcs/test-connection/`
- Check GCS bucket: [Google Cloud Console](https://console.cloud.google.com/storage/)

**Happy Uploading! 🚀**
