# Orchids Gallery - AI-Powered Photo Management System

**Built with Claude Code Assistant**

**Branded for Orchids International School**

A sophisticated Electron-based desktop application that uses real machine learning models to detect, cluster, and organize faces in your photo collection, with seamless Google Cloud Storage integration.

---

## 📋 Table of Contents

- [Overview](#overview)
- [Features](#features)
- [Architecture](#architecture)
- [Technology Stack](#technology-stack)
- [Installation](#installation)
- [Configuration](#configuration)
- [API Documentation](#api-documentation)
- [Development Stages](#development-stages)
- [Testing Guide](#testing-guide)
- [File Structure](#file-structure)
- [Troubleshooting](#troubleshooting)

---

## 🎯 Overview

Face Gallery is a desktop application that automatically:
- **Detects faces** in uploaded images using ML models (SSD MobileNet V1)
- **Generates embeddings** (128-dimension FaceNet descriptors)
- **Clusters similar faces** into collections (persons)
- **Syncs everything to Google Cloud Storage** for backup and cloud access
- **Stores embeddings** in both GCS and Firestore for vector similarity search

---

## ✨ Features

### Core Features
- ✅ **Real Face Detection** with TensorFlow.js and face-api.js
- ✅ **Face Clustering** - Automatically groups similar faces
- ✅ **Face Scanner & Recognition** - Scan and match faces against collections
- ✅ **Cloud Sync** - Upload to Google Cloud Storage
- ✅ **Firestore Integration** - Store embeddings for similarity search
- ✅ **Collection Management** - Review and organize face collections
- ✅ **Local Database** - SQLite for offline-first architecture
- ✅ **Crash-Safe Uploads** - Resumable sync with status tracking
- ✅ **IPC-Based Image Loading** - Reliable image display via base64 data URLs
- ✅ **Image Compression** - Automatic thumbnail generation (small 200x200, medium 800x800)
- ✅ **Django-GCS Sync** - Automatic sync between local database and cloud storage

### ML Features
- **Face Detection**: SSD MobileNet V1 (50-200ms per image)
- **Landmark Detection**: 68-point facial landmarks
- **Face Recognition**: 128-dim FaceNet embeddings
- **Quality Scoring**: Automatic face quality assessment
- **Similarity Matching**: Euclidean distance for face clustering

### UI/UX Features
- **Orchids International School Branding** - Custom maroon/gold theme
- **Lucide React Icons** - Professional SVG icons throughout the app
- **Responsive Grid Gallery** - Auto-fill image grid with hover effects
- **Loading States** - Spinner animations for async operations
- **FotoOwl-style Upload Progress** - Circular progress indicator with percentage
- **Pinterest-style Scanner Gallery** - Masonry grid layout for matched photos
- **Lightbox Image Viewer** - Full-screen viewing with download option
- **Lazy Loading Gallery** - Images load progressively as user scrolls

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────┐
│                   Electron App (Desktop)                 │
├─────────────────────────────────────────────────────────┤
│                                                           │
│  ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │
│  │   Renderer   │◄──►│  Main Process │◄──►│  SQLite   │ │
│  │   (React)    │    │   (Node.js)   │    │  Database │ │
│  └──────────────┘    └──────────────┘    └───────────┘ │
│         │                    │                           │
│         │                    ▼                           │
│         │         ┌─────────────────────┐               │
│         │         │  Face Detection     │               │
│         │         │  (face-api.js)      │               │
│         │         │  - SSD MobileNet    │               │
│         │         │  - Face Landmarks   │               │
│         │         │  - FaceNet          │               │
│         │         └─────────────────────┘               │
│         │                    │                           │
└─────────┼────────────────────┼───────────────────────────┘
          │                    │
          │                    ▼
          │         ┌─────────────────────┐
          │         │  Google Cloud       │
          │         │                     │
          │         │  ┌───────────────┐ │
          │         │  │  Cloud Storage│ │
          │         │  │  (GCS)        │ │
          │         │  │  - Images     │ │
          │         │  │  - Metadata   │ │
          │         │  │  - Embeddings │ │
          │         │  │  - Collections│ │
          │         │  └───────────────┘ │
          │         │                     │
          │         │  ┌───────────────┐ │
          │         │  │  Firestore    │ │
          │         │  │  (Embeddings) │ │
          │         │  └───────────────┘ │
          │         └─────────────────────┘
          │
          ▼
    User Interface
```

---

## 🛠️ Technology Stack

### Frontend
- **React** 18.x - UI framework
- **React Router** - Navigation
- **Electron** 28.x - Desktop app framework
- **Lucide React** - Modern SVG icon library

### Backend (Main Process)
- **Node.js** 18+ - Runtime environment
- **face-api.js** - Face detection and recognition
- **TensorFlow.js** - ML inference
- **better-sqlite3** - Local database
- **Canvas** - Image processing

### Cloud Services
- **Google Cloud Storage (GCS)** - File storage
- **Cloud Firestore** - Vector embeddings database
- **Service Account Authentication** - Secure access

### ML Models
- **SSD MobileNet V1** (~6MB) - Face detection
- **Face Landmark 68** (~350KB) - Landmark detection
- **Face Recognition Net** (~6MB) - 128-dim embeddings

---

## 📦 Installation

### Prerequisites
- **Node.js** 18.0.0 or higher
- **npm** 8.0.0 or higher
- **Git** (for cloning)
- **Google Cloud Project** (for cloud sync)

### Steps

1. **Clone the repository:**
   ```bash
   cd electron-app
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Download face detection models:**
   ```bash
   node scripts/download-face-models.js
   ```

4. **Set up environment variables:**
   Create `.env` file in `electron-app/` directory:
   ```env
   GOOGLE_APPLICATION_CREDENTIALS=./gcp-service-account.json
   GCS_BUCKET_NAME=your-bucket-name
   GCP_PROJECT_ID=your-project-id
   FIRESTORE_DATABASE_ID=(default)
   ```

5. **Add GCP credentials:**
   Place your `gcp-service-account.json` in `electron-app/` directory

6. **Start the app:**
   ```bash
   npm run dev
   ```

---

## ⚙️ Configuration

### GCP Service Account Setup

1. **Create Service Account:**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Navigate to IAM & Admin > Service Accounts
   - Create new service account

2. **Grant Roles:**
   - **Storage Admin** - For GCS uploads
   - **Cloud Datastore User** - For Firestore access

3. **Download JSON Key:**
   - Create key (JSON format)
   - Save as `gcp-service-account.json`

4. **Create GCS Bucket:**
   - Navigate to Cloud Storage > Buckets
   - Create bucket (e.g., `face-gallery-storage`)
   - Choose location and storage class

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `GOOGLE_APPLICATION_CREDENTIALS` | Path to service account JSON | Yes |
| `GCS_BUCKET_NAME` | GCS bucket name | Yes |
| `GCP_PROJECT_ID` | GCP project ID | Yes |
| `FIRESTORE_DATABASE_ID` | Firestore database ID | No (default: `(default)`) |
| `GCS_BUCKET_LOCATION` | Bucket location | No (default: `us-central1`) |

---

## 📚 API Documentation

### Main Process APIs (IPC)

#### GCS Upload APIs

```javascript
// Check if GCS is ready
await window.electronAPI.gcs.isReady()
// Returns: { success: boolean, ready: boolean }

// Sync single image
await window.electronAPI.gcs.syncImage(imageId)
// Returns: { success: boolean, results: object }

// Batch sync images
await window.electronAPI.gcs.batchSync({ limit: 10 })
// Returns: { success: boolean, results: array, stats: { total, succeeded, failed } }

// Get sync statistics
await window.electronAPI.gcs.getSyncStats()
// Returns: { success: boolean, stats: { pending, uploading, completed, failed, total } }

// Retry failed uploads
await window.electronAPI.gcs.retryFailed()
// Returns: { success: boolean, results: array }
```

#### Collection APIs

```javascript
// Upload single collection metadata
await window.electronAPI.gcs.uploadCollection(collectionId)
// Returns: { success: boolean, gcsPath: string }

// Sync all collections
await window.electronAPI.gcs.syncAllCollections()
// Returns: { success: boolean, results: array, stats: object }

// Fetch collection from GCS
await window.electronAPI.gcs.fetchCollection(collectionId)
// Returns: { success: boolean, data: object }

// List all collections in GCS
await window.electronAPI.gcs.listCollections()
// Returns: { success: boolean, collections: array }
```

#### Gallery APIs

```javascript
// Get all uploaded files
await window.electronAPI.gallery.getAllFiles({ limit: 1000 })
// Returns: { success: boolean, files: array }

// Get gallery statistics
await window.electronAPI.gallery.getStats()
// Returns: { success: boolean, stats: { totalFiles, totalSize, todayUploads } }

// Search files by filename
await window.electronAPI.gallery.searchFiles(searchTerm)
// Returns: { success: boolean, files: array }

// Delete a single file
await window.electronAPI.gallery.deleteFile(fileId)
// Returns: { success: boolean, message: string }

// Clear entire gallery
await window.electronAPI.gallery.clearAll()
// Returns: { success: boolean, deletedCount: number }

// Get image as base64 data URL (for reliable display)
await window.electronAPI.gallery.getImageData(filepath)
// Returns: { success: boolean, dataUrl: string }
```

#### Face Scanner APIs

```javascript
// Scan a face and generate embedding
await window.electronAPI.scanner.scanFace(imagePath)
// Returns: { success: boolean, face: { embedding, confidence, boundingBox, landmarks } }

// Complete workflow: Scan and match against collections
await window.electronAPI.scanner.scanAndMatch(imagePath, {
  threshold: 0.6,    // Similarity threshold (0-1)
  limit: 10,         // Max results
  searchMode: 'local' // 'local' (faster) or 'gcs' (cloud)
})
// Returns: { success, scanned_face, matches: [{ collection_id, collection_name, match: { similarity, distance, ... } }], stats }

// Search collections using embedding (local database - faster)
await window.electronAPI.scanner.searchCollectionsLocal(embedding, threshold, limit)
// Returns: { success, matches: [...], stats }

// Search collections using embedding (GCS - cloud-based)
await window.electronAPI.scanner.searchCollections(embedding, threshold, limit)
// Returns: { success, matches: [...], stats }

// Save temporary image (useful for webcam captures)
await window.electronAPI.scanner.saveTempImage(dataUrl, filename)
// Returns: { success: boolean, path: string }

// Cleanup temporary files (older than 1 hour)
await window.electronAPI.scanner.cleanupTemp()
// Returns: { success: boolean }
```

**See [FACE_SCANNER_API.md](./FACE_SCANNER_API.md) for complete documentation and examples.**

### Django Management Commands

```bash
# Clear all data (local only)
python manage.py clear_all_data

# Clear all data including GCS
python manage.py clear_all_data --include-gcs

# Skip confirmation prompt
python manage.py clear_all_data --include-gcs --yes
```

### Face Scanner Web Page

The standalone face scanner is available at `camera-scanner.html`:

```bash
# Serve with HTTP server (required for camera access)
python3 -m http.server 8088

# Open in browser
http://localhost:8088/camera-scanner.html
```

**Features:**
- Camera-based face scanning
- Pinterest-style gallery for matched photos
- Lazy loading (12 images at a time as you scroll)
- Individual photo download
- Lightbox for full-screen viewing
- "Scan Again" button to return to scanner

---

## 🚀 Development Stages

### Stage 1: Data Preparation ✅
- **Objective:** Prepare local data for GCP upload
- **Implementation:**
  - Database queries for pending sync data
  - Face and image metadata preparation
  - Embedding vector formatting
- **Location:** `src/main/services/gcp-data-preparation.js`

### Stage 2: GCS Upload Service ✅
- **Objective:** Upload images, metadata, and embeddings to GCS
- **Implementation:**
  - Image upload: `images/{collection_id}/{image_id}.jpg`
  - Face metadata: `metadata/faces/{face_id}.json`
  - Embeddings: `embeddings/{face_id}.json`
  - Firestore sync for vector search
  - Crash-safe with status tracking
- **Location:** `src/main/services/gcs-upload.js`

### Stage 3: Real Face Detection ✅
- **Objective:** Replace mock detection with real ML models
- **Implementation:**
  - Downloaded face-api.js models (12MB)
  - SSD MobileNet V1 for face detection
  - 68-point landmark detection
  - FaceNet 128-dim embeddings
  - Runs in Main Process (Node.js backend)
- **Location:** `src/main/services/face-detection.js`
- **Models:** `models/face-api/`

### Stage 4: Collection Metadata Upload ✅
- **Objective:** Upload face collections to GCS for review
- **Implementation:**
  - Collection metadata JSON generation
  - Face-to-collection mappings
  - Representative face selection
  - Fetch and list operations
- **Storage:** `collections/{collection_id}.json`

### Stage 5: Face Scanner & Recognition ✅
- **Objective:** Scan faces and match against collections
- **Implementation:**
  - Face scanning with embedding generation
  - Euclidean distance similarity matching
  - Dual search modes: Local (fast) and GCS (cloud)
  - Similarity threshold configuration
  - Temporary image management for webcam/uploads
  - Ranked results with confidence scores
- **Location:** `src/main/services/face-scanner.js`
- **Use Cases:** Attendance systems, access control, face identification

### Stage 6: UI Branding & Image Loading ✅
- **Objective:** Rebrand app for Orchids International School with reliable image loading
- **Implementation:**
  - Complete color palette change from purple to maroon/gold
  - Replaced emoji icons with Lucide React SVG icons
  - Custom protocol registration with `protocol.registerSchemesAsPrivileged()`
  - Modern `protocol.handle()` API for Electron 28+
  - IPC-based image loading via base64 data URLs
  - GalleryImage component with loading states
- **Files Modified:**
  - `src/renderer/styles/global.css` - CSS variables
  - `src/renderer/layouts/MainLayout.jsx` - Navigation icons
  - `src/renderer/pages/Gallery.jsx` - Image loading component
  - `src/renderer/pages/Dashboard.jsx` - Dashboard icons
  - `src/main/index.js` - Protocol handler
  - `src/main/ipc/gallery-handlers.js` - Image data IPC
  - `src/renderer/preload.js` - Gallery API exposure

### Stage 7: Image Compression & Thumbnails ✅
- **Objective:** Optimize storage with automatic thumbnail generation
- **Implementation:**
  - Original images stored at full quality
  - Small thumbnails (200x200) for gallery grid
  - Medium thumbnails (800x800) for preview
  - Integrated into upload pipeline
  - Synced to GCS with proper folder structure
- **Storage Structure:**
  ```
  Local:
  ├── images/{hash}.jpeg          # Original
  ├── thumbnails/small/{hash}.jpg # 200x200
  └── thumbnails/medium/{hash}.jpg # 800x800

  GCS:
  ├── originals/uncategorized/{hash}.jpeg
  ├── thumbnails/small/uncategorized/{hash}.jpg
  └── thumbnails/medium/uncategorized/{hash}.jpg
  ```
- **Files Modified:**
  - `backend/api/utils.py` - Thumbnail generation functions
  - `backend/api/views.py` - Upload integration
  - `backend/api/gcs_service.py` - GCS upload for thumbnails
  - `backend/api/delete_views.py` - Delete thumbnails on photo removal

### Stage 8: Django-GCS Sync ✅
- **Objective:** Keep Django database and GCS in perfect sync
- **Implementation:**
  - Automatic upload sync (original + 2 thumbnails per photo)
  - Automatic delete sync (removes from both Django and GCS)
  - `--include-gcs` flag for `clear_all_data` management command
  - Parallel deletion with ThreadPoolExecutor for faster cleanup
- **Files Modified:**
  - `backend/api/gcs_service.py` - Sync functions
  - `backend/api/delete_views.py` - Cascade deletion to GCS
  - `backend/api/management/commands/clear_all_data.py` - GCS clearing

### Stage 9: FotoOwl-style Upload Progress UI ✅
- **Objective:** Modern, user-friendly upload progress display
- **Implementation:**
  - Circular SVG progress ring with percentage
  - File counter ("3 of 10 files")
  - Current filename display
  - Stats grid (Uploaded/Skipped/Failed/Cancelled)
  - Pill-shaped cancel button with hover effects
  - Glassmorphism styling
- **Files Modified:**
  - `electron-app/src/renderer/pages/Dashboard.jsx` - Progress UI
  - `electron-app/src/renderer/pages/Dashboard.css` - Circular progress styles

### Stage 10: Pinterest-style Face Scanner Gallery ✅
- **Objective:** Clean, user-friendly gallery after face scan
- **Implementation:**
  - Masonry grid layout (4 columns, responsive)
  - Photos displayed immediately after successful scan
  - Scanner view hidden, gallery view shown
  - Floating "Scan Again" button
  - Lightbox for full-screen viewing
  - Individual download buttons on hover
  - Removed technical details (Person #, Collection #, Match %)
- **User Flow:**
  1. Start camera → Scan face → Loading...
  2. Match found → Scanner hides → Pinterest gallery appears
  3. Click photo → Lightbox opens → Download option
  4. Click "Scan Again" → Return to scanner
- **File Modified:**
  - `camera-scanner.html` - Complete redesign

### Stage 11: Lazy Loading for Scanner Gallery ✅
- **Objective:** Improve performance by loading images progressively as user scrolls
- **Implementation:**
  - Intersection Observer API for scroll detection
  - Initial batch of 12 images loaded on scan complete
  - Additional batches of 12 images load as user scrolls
  - 200px rootMargin for preloading before viewport
  - Loading spinner indicator while fetching more
  - Observer cleanup when returning to scanner
- **Technical Details:**
  ```javascript
  // Configuration
  const IMAGES_PER_BATCH = 12;

  // Intersection Observer with look-ahead
  lazyLoadObserver = new IntersectionObserver((entries) => {
    if (entry.isIntersecting) loadMoreImages();
  }, { rootMargin: '200px', threshold: 0.1 });
  ```
- **Benefits:**
  - Faster initial page load
  - Reduced memory usage for large result sets
  - Smoother scrolling experience
  - Better performance on slower connections
- **File Modified:**
  - `camera-scanner.html` - Added lazy loading logic and loading indicator styles

---

## 🧪 Testing Guide

### Developer Console Tests

Open Developer Console (`Ctrl+Shift+I` or `F12`) in the app:

#### Test 1: Check GCS Status
```javascript
const ready = await window.electronAPI.gcs.isReady();
console.log('GCS Ready:', ready);
// Expected: { success: true, ready: true }
```

#### Test 2: Sync Statistics
```javascript
const stats = await window.electronAPI.gcs.getSyncStats();
console.log('Sync Stats:', stats);
// Shows: pending, uploading, completed, failed counts
```

#### Test 3: Upload Single Image
```javascript
const result = await window.electronAPI.gcs.batchSync({ limit: 1 });
console.log('Upload Result:', result);
// Uploads 1 image with all faces and embeddings
```

#### Test 4: Sync All Collections
```javascript
const result = await window.electronAPI.gcs.syncAllCollections();
console.log('Collections Synced:', result);
// Uploads all collection metadata to GCS
```

#### Test 5: List Collections from GCS
```javascript
const list = await window.electronAPI.gcs.listCollections();
console.log('GCS Collections:', list.collections);
// Shows all collections with metadata
```

#### Test 6: Fetch Collection Details
```javascript
const data = await window.electronAPI.gcs.fetchCollection('collection-id');
console.log('Collection Data:', data);
// Returns full collection metadata, faces, and mappings
```

#### Test 7: Scan a Face
```javascript
const scan = await window.electronAPI.scanner.scanFace('D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\test.jpg');
console.log('Face Scan:', scan);
// Returns face embedding, confidence, bounding box
```

#### Test 8: Face Recognition - Complete Workflow
```javascript
const result = await window.electronAPI.scanner.scanAndMatch(
  'D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\test.jpg',
  { threshold: 0.6, limit: 5, searchMode: 'local' }
);
console.log('Match Results:', result);
console.log('Top Match:', result.matches[0]?.collection_name);
// Scans face and returns matching collections ranked by similarity
```

---

## 📁 File Structure

```
electron-app/
├── src/
│   ├── main/                      # Main Process (Node.js)
│   │   ├── database/
│   │   │   └── schema.js         # SQLite schema
│   │   ├── ipc/
│   │   │   ├── handlers.js       # IPC handler registration
│   │   │   ├── gallery-handlers.js    # Gallery IPC (incl. getImageData)
│   │   │   ├── gcs-upload-handlers.js # GCS IPC handlers
│   │   │   └── ...
│   │   ├── services/
│   │   │   ├── face-detection.js        # Real face detection (ML)
│   │   │   ├── face-clustering.js       # Face clustering algorithm
│   │   │   ├── face-processing.js       # Face processing pipeline
│   │   │   ├── face-scanner.js          # Face scanning & matching
│   │   │   ├── gcs-upload.js           # GCS upload service
│   │   │   ├── gcp-data-preparation.js # Data prep for GCP
│   │   │   └── mock-face-detection.js  # Mock (deprecated)
│   │   ├── storage/
│   │   │   └── config.js         # Configuration management
│   │   ├── utils/
│   │   │   └── logger.js         # Winston logger
│   │   └── index.js              # Main entry point (protocol handler)
│   │
│   └── renderer/                 # Renderer Process (React)
│       ├── pages/
│       │   ├── Gallery.jsx       # Gallery with GalleryImage component
│       │   ├── Dashboard.jsx     # Dashboard with Lucide icons
│       │   └── ...
│       ├── layouts/
│       │   └── MainLayout.jsx    # Sidebar with Orchids branding
│       ├── styles/
│       │   └── global.css        # CSS variables (maroon theme)
│       ├── App.jsx               # Root component
│       └── preload.js            # Preload script (IPC bridge)
│
├── config/
│   └── gcp-config.js            # GCP configuration
│
├── models/
│   └── face-api/                # ML models (12MB)
│       ├── ssd_mobilenetv1_model-*
│       ├── face_landmark_68_model-*
│       └── face_recognition_model-*
│
├── scripts/
│   └── download-face-models.js  # Model download script
│
├── app-data/
│   └── database/
│       └── app.db               # SQLite database
│
├── .env                         # Environment variables
├── gcp-service-account.json     # GCP credentials (gitignored)
├── package.json
└── CLAUDE.md                    # This file

backend/                          # Django Backend
├── api/
│   ├── models.py                # Photo, Person, PersonPhoto models
│   ├── views.py                 # Upload API with thumbnail generation
│   ├── delete_views.py          # Delete endpoints with GCS sync
│   ├── gcs_service.py           # GCS upload/delete functions
│   ├── utils.py                 # Thumbnail generation utilities
│   ├── faiss_manager.py         # Face embedding search
│   └── management/
│       └── commands/
│           └── clear_all_data.py # Clear all data command
├── media/
│   ├── images/                  # Original images
│   ├── thumbnails/
│   │   ├── small/              # 200x200 thumbnails
│   │   └── medium/             # 800x800 thumbnails
│   └── faces/                   # Cropped face images
└── gallery/
    └── settings.py              # Django settings

Root Files:
├── camera-scanner.html          # Standalone face scanner (Pinterest-style)
└── CLAUDE.md                    # This documentation
```

---

## 🗄️ Database Schema

### Tables

#### `images`
- Primary storage for uploaded images
- Tracks processing and sync status
- Fields: `image_id`, `image_path`, `file_hash`, `processing_status`, `sync_status`, `gcs_path`, `synced_at`

#### `faces`
- Detected faces with embeddings
- Links to images and collections
- Fields: `face_id`, `image_id`, `bounding_box`, `embedding_vector`, `confidence`, `quality_score`, `sync_status`, `metadata_gcs_path`

#### `face_collections`
- Grouped faces (persons)
- Representative face selection
- Fields: `collection_id`, `name`, `total_faces`, `total_images`, `representative_face_id`, `created_at`, `updated_at`

#### `face_collection_members`
- Many-to-many mapping
- Similarity scores
- Fields: `collection_id`, `face_id`, `similarity_score`, `is_representative`

---

## 🎨 GCS Storage Structure

```
gs://your-bucket/
├── originals/
│   ├── {collection_id}/
│   │   └── {image_hash}.jpeg
│   └── uncategorized/
│       └── {image_hash}.jpeg
│
├── thumbnails/
│   ├── small/
│   │   └── uncategorized/
│   │       └── {image_hash}.jpg    # 200x200
│   └── medium/
│       └── uncategorized/
│           └── {image_hash}.jpg    # 800x800
│
├── metadata/
│   └── faces/
│       └── {face_id}.json
│
├── embeddings/
│   └── {face_id}.json
│
└── collections/
    └── {collection_id}.json
```

**Note:** Each uploaded photo creates 3 files in GCS:
- 1 original (full quality)
- 1 small thumbnail (200x200)
- 1 medium thumbnail (800x800)

### Sample Collection Metadata (`collections/{id}.json`)
```json
{
  "collection_id": "636355b1-7e4f-4bff-82e3-55709d95b402",
  "name": "Person 1",
  "total_faces": 10,
  "total_images": 8,
  "representative_face_id": "97a394aa-68af-4731-8cca-e65a935df3d5",
  "faces": [
    {
      "face_id": "97a394aa-68af-4731-8cca-e65a935df3d5",
      "image_id": "ebd83e0a-43b6-413b-bb4b-2c51c30a54ae",
      "confidence": 0.99,
      "quality_score": 0.85,
      "similarity_score": 0.92,
      "is_representative": true,
      "created_at": "2026-02-02T07:00:00.000Z"
    }
  ],
  "image_ids": ["ebd83e0a-43b6-413b-bb4b-2c51c30a54ae"],
  "synced_at": "2026-02-02T07:35:00.000Z"
}
```

---

## 🎨 UI Branding - Orchids International School

### Color Palette

| Purpose | Color Name | Hex Code |
|---------|------------|----------|
| Primary | Maroon | `#800020` |
| Primary Dark | Dark Maroon | `#5C0015` |
| Primary Light | Light Maroon | `#A64D5B` |
| Accent/Gold | Gold | `#DAA520` |
| Secondary | Forest Green | `#228B22` |
| Sidebar Background | Maroon Gradient | `#3D0011` → `#5C0015` |
| Sidebar Text | Light Gold | `#F5DEB3` |
| Card Background | Light Pink | `#FFF8F5` |
| Border | Soft Pink | `#E8C4C4` |

### Icon Library

The app uses **Lucide React** icons throughout. Key icons include:

| Component | Icon | Usage |
|-----------|------|-------|
| Dashboard | `LayoutDashboard` | Navigation |
| Gallery | `Image` | Navigation & headers |
| Upload | `Upload`, `FolderUp` | Upload actions |
| Settings | `Settings`, `Cog` | Configuration |
| Storage | `HardDrive` | Storage stats |
| Calendar | `Calendar` | Date displays |
| Search | `Search` | Search functionality |
| Delete | `Trash2` | Delete actions |
| Loading | `Loader2`, `RefreshCw` | Loading states |
| Logo | `GraduationCap` | Orchids branding |

### CSS Variables

All colors are defined in `src/renderer/styles/global.css`:

```css
:root {
  --color-primary: #800020;
  --color-primary-dark: #5C0015;
  --color-primary-light: #A64D5B;
  --color-success: #228B22;
  --color-info: #DAA520;
  --color-sidebar-bg: linear-gradient(180deg, #3D0011 0%, #5C0015 100%);
  --color-sidebar-text: #F5DEB3;
  --color-sidebar-active: #800020;
}
```

---

## 🐛 Troubleshooting

### Issue: "GCS service not initialized"
**Solution:**
1. Check `.env` file exists with correct values
2. Verify `gcp-service-account.json` is in correct location
3. Ensure GCS bucket exists
4. Check service account has required roles
5. Restart the app

### Issue: "Face detection models not loaded"
**Solution:**
1. Run: `node scripts/download-face-models.js`
2. Check `models/face-api/` has 8 files (12MB total)
3. Ensure Node.js 18+ is installed
4. Restart the app

### Issue: Blank page in Electron app
**Solution:**
1. Kill all Electron processes: `taskkill //F //IM electron.exe`
2. Kill processes on port 9000: `netstat -ano | findstr :9000`
3. Restart: `npm run dev`

### Issue: Native module version mismatch
**Solution:**
1. Rebuild native modules: `npx electron-rebuild`
2. Or reinstall: `rm -rf node_modules && npm install`

### Issue: Images not displaying in Gallery
**Solution:**
1. Images are now loaded via IPC as base64 data URLs for reliability
2. Check DevTools console for any IPC errors
3. Verify files exist in `app-data/uploads/` directory
4. Ensure `uploaded_files` table has correct file paths
5. Check main process logs for "📷 Gallery:" messages
6. The custom protocol `app://` requires Electron 25+ with `protocol.registerSchemesAsPrivileged()`

### Issue: Custom protocol not working (Electron 25+)
**Solution:**
1. Ensure `protocol.registerSchemesAsPrivileged()` is called BEFORE `app.whenReady()`
2. Use `protocol.handle()` instead of deprecated `registerFileProtocol()`
3. Check CSP in `index.html` includes `img-src 'self' data: file: app:`
4. Restart the app completely (not just hot reload)

### Issue: Port 9000 already in use (macOS)
**Solution:**
```bash
lsof -ti:9000 | xargs kill -9
```

---

## 📊 Performance

- **Face Detection:** 50-200ms per image (CPU)
- **Face Clustering:** ~5ms per face comparison
- **GCS Upload:** Depends on internet speed
  - Image (2MB): ~1-3 seconds
  - Metadata (10KB): ~200-500ms
- **Firestore Write:** ~100-300ms per embedding

---

## 🔐 Security

- ✅ Service account credentials in `.gitignore`
- ✅ `.env` file excluded from version control
- ✅ GCS bucket with IAM permissions
- ✅ Firestore security rules (configure separately)
- ✅ No hardcoded credentials in source code

---

## 📈 Future Enhancements

- [ ] Real-time face search using Firestore vector queries
- [ ] Face recognition for known persons
- [ ] Bulk operations UI
- [ ] Advanced filtering and search
- [ ] Face editing (merge/split collections)
- [ ] Export to other cloud providers
- [ ] Mobile companion app
- [ ] Shared collections with permissions

---

## 📝 License

[Add your license here]

---

## 👥 Credits

**Built with:**
- [face-api.js](https://github.com/justadudewhohacks/face-api.js) - Face detection library
- [TensorFlow.js](https://www.tensorflow.org/js) - ML framework
- [Electron](https://www.electronjs.org/) - Desktop framework
- [React](https://react.dev/) - UI library
- [Google Cloud](https://cloud.google.com/) - Cloud infrastructure

**Developed with assistance from:** Claude Code (Anthropic)

---

## 📞 Support

For issues and questions:
1. Check the [Troubleshooting](#troubleshooting) section
2. Review logs in Developer Console
3. Check `app-data/logs/` directory
4. Open an issue in the repository

---

**Last Updated:** February 4, 2026
**Version:** 1.2.1
**Status:** Production Ready ✅

### Changelog

#### v1.2.1 (February 4, 2026)
- ✅ **Lazy Loading Gallery** - Images load progressively (12 at a time) as user scrolls
- ✅ **Intersection Observer** - Smart scroll detection with 200px look-ahead
- ✅ **Loading Indicator** - Spinner shown while fetching more images
- ✅ **Memory Optimization** - Reduced initial load for large result sets

#### v1.2.0 (February 4, 2026)
- ✅ **Image Compression** - Automatic thumbnail generation (200x200 small, 800x800 medium)
- ✅ **Django-GCS Sync** - Perfect sync between local database and cloud storage
- ✅ **FotoOwl-style Upload Progress** - Circular progress ring with percentage display
- ✅ **Pinterest-style Scanner Gallery** - Masonry grid layout after face scan
- ✅ **Lightbox Image Viewer** - Full-screen viewing with download option
- ✅ **Floating "Scan Again" Button** - Easy navigation back to scanner
- ✅ **Simplified Scanner UI** - Removed technical details (Person #, Collection #, Match %)
- ✅ **`--include-gcs` Flag** - Clear GCS data with `clear_all_data` command
- ✅ **Parallel GCS Deletion** - Faster cleanup with ThreadPoolExecutor

#### v1.1.0 (February 4, 2026)
- ✅ Rebranded UI for Orchids International School (maroon/gold theme)
- ✅ Replaced emoji icons with Lucide React SVG icons
- ✅ Fixed image loading in Gallery with IPC-based base64 approach
- ✅ Updated custom protocol handler for Electron 28 compatibility
- ✅ Added `getImageData` IPC API for reliable image display
- ✅ Improved error handling and loading states in Gallery

#### v1.0.0 (February 2, 2026)
- Initial release with face detection, clustering, and GCS sync
