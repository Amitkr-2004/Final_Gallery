# Image Processor - Electron Desktop Application

Desktop application for downloading, processing, and managing images from Google Cloud Storage with face detection and classification capabilities.

## Features

- **Multi-platform Support**: Windows, macOS, Linux
- **GCP Integration**: Secure connection to Google Cloud Storage
- **Parallel Downloads**: Configurable concurrent download workers
- **Resume Capability**: Resume interrupted downloads and processing
- **Face Detection**: TensorFlow.js powered face recognition
- **Image Classification**: Automatic image categorization
- **Collection Management**: Create and manage image collections
- **Progress Monitoring**: Real-time download and processing status
- **Backend Sync**: Optional synchronization with Django backend

## Architecture

```
electron-app/
├── src/
│   ├── main/           # Main process (Node.js)
│   │   ├── gcp/        # GCP connection and operations
│   │   ├── database/   # SQLite database management
│   │   ├── processing/ # Image processing pipeline
│   │   ├── sync/       # Sync orchestration
│   │   ├── storage/    # File and config management
│   │   ├── ipc/        # IPC handlers
│   │   └── utils/      # Logger, helpers
│   ├── renderer/       # Renderer process (UI)
│   │   ├── src/        # React components
│   │   └── preload.js  # Secure IPC bridge
│   └── shared/         # Shared code
├── config/             # Environment configurations
│   ├── default.json    # Base configuration
│   ├── dev.json        # Development overrides
│   └── prod.json       # Production overrides
└── app-data/           # Local storage (gitignored)
    ├── downloads/
    ├── processed/
    ├── database/
    └── logs/
```

## Prerequisites

- **Node.js**: >= 18.0.0
- **npm**: >= 8.0.0
- **GCP Service Account**: With Cloud Storage permissions
- **Python** (optional): For face detection models

## Installation

### 1. Clone and Install Dependencies

```bash
cd electron-app
npm install
```

### 2. Configure Environment

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
NODE_ENV=development
GCP_PROJECT_ID=your-project-id
GCP_BUCKET_NAME=your-bucket-name
BACKEND_API_URL=http://localhost:8000/api
```

### 3. Set Up GCP Credentials

#### Option A: Service Account Key File

1. Download your service account JSON key from GCP Console
2. Place it in a secure location (NEVER commit to Git)
3. Set the path in `.env`:
   ```env
   GCP_SERVICE_ACCOUNT_PATH=/path/to/service-account-key.json
   ```

#### Option B: First-Time Setup in App

1. Start the app without credentials
2. The app will prompt you to upload your service account JSON
3. Credentials will be encrypted and stored securely

### 4. Configure Settings (Optional)

Create `config/local.json` for user-specific overrides:

```json
{
  "gcp": {
    "bucketName": "my-custom-bucket"
  },
  "download": {
    "maxConcurrentDownloads": 10
  }
}
```

## Development

### Start Development Mode

```bash
npm run dev
```

This starts:
- Electron main process with hot reload
- Webpack dev server for renderer (port 9000)
- DevTools automatically opened

### Build for Production

```bash
npm run build
```

### Package for Distribution

```bash
# All platforms
npm run package

# Specific platform
npm run package:win   # Windows
npm run package:mac   # macOS
npm run package:linux # Linux
```

## Configuration

### Environment-Based Configuration

The app uses a layered configuration system:

1. **default.json**: Base configuration
2. **dev.json** / **prod.json**: Environment overrides
3. **local.json**: User-specific overrides (gitignored)

Set `NODE_ENV` to switch environments:

```bash
# Development
NODE_ENV=development npm start

# Production
NODE_ENV=production npm start
```

### Key Configuration Options

```json
{
  "download": {
    "maxConcurrentDownloads": 5,  // Parallel downloads
    "chunkSizeBytes": 5242880,    // 5MB chunks
    "retryAttempts": 3            // Retry failed downloads
  },
  "processing": {
    "maxConcurrentWorkers": 3,    // Parallel processing
    "faceDetectionConfidence": 0.7
  },
  "sync": {
    "autoSyncEnabled": false,
    "syncIntervalMinutes": 30
  }
}
```

## Usage

### First Run

1. **Launch the app**
2. **Configure GCP credentials** (if not set in .env)
3. **Test connection** to verify GCS bucket access
4. **Start sync** to download images

### Workflow

1. **Sync**: Download images from GCS bucket
   - Dashboard → Click "Sync Now"
   - Select events/filters (optional)
   - Monitor progress in real-time

2. **Process**: Run face detection and classification
   - Processing Monitor → Click "Start Processing"
   - View results as they complete
   - Check detected faces and classifications

3. **Organize**: Create collections
   - Gallery → Select images
   - Create Collection
   - View organized collections

4. **Sync Results**: Upload processing results to backend
   - Settings → Enable "Sync Results"
   - Results automatically synced

## Database Schema

SQLite database with sync state tracking:

```sql
-- Images table with comprehensive sync state
images (
  id INTEGER PRIMARY KEY,
  gcs_path TEXT UNIQUE,
  local_path TEXT,
  sync_status TEXT,      -- pending/downloading/processing/processed/uploaded/failed
  download_status TEXT,  -- not_started/in_progress/completed/failed
  process_status TEXT,   -- not_started/in_progress/completed/failed
  last_attempt INTEGER,  -- timestamp
  retry_count INTEGER,   -- retry attempts
  error_message TEXT,    -- last error
  md5_hash TEXT,
  size INTEGER,
  created_at INTEGER,
  updated_at INTEGER
)

-- Processing results
processing_results (
  id INTEGER PRIMARY KEY,
  image_id INTEGER,
  faces_detected INTEGER,
  face_data TEXT,        -- JSON
  classifications TEXT,  -- JSON
  created_at INTEGER
)

-- Collections
collections (
  id INTEGER PRIMARY KEY,
  name TEXT,
  image_ids TEXT,        -- JSON array
  created_at INTEGER
)
```

## Security

### Credential Storage

- **Encrypted**: Service account keys encrypted using electron-store
- **OS Keychain**: Optionally stored in OS keychain (macOS Keychain, Windows Credential Manager)
- **Never in Code**: Credentials never hardcoded or committed to Git

### IPC Security

- **Context Isolation**: Renderer process sandboxed
- **Preload Script**: Secure bridge using contextBridge
- **No Node Integration**: Renderer has no direct Node.js access

### Network Security

- **HTTPS Only**: All GCS requests over HTTPS
- **Signed URLs**: Upload clients use time-limited signed URLs
- **Navigation Blocking**: Prevents XSS via navigation

## Troubleshooting

### Connection Issues

```bash
# Test GCP connection
# In app: Settings → Test Connection

# Check credentials
ls -la /path/to/service-account-key.json

# Verify IAM permissions
# GCS bucket → Permissions → Check service account roles
```

### Download Failures

- Check disk space: Settings → System Info
- Verify network connection
- Check logs: `app-data/logs/app-{date}.log`
- Retry failed downloads: Downloads → Retry Failed

### Processing Errors

- Check memory usage: Task Manager / Activity Monitor
- Reduce concurrent workers in config
- Clear processed cache: Settings → Cleanup

### Database Issues

```bash
# Backup database
# Settings → Database → Backup

# Vacuum database
# Settings → Database → Vacuum
```

## Logs

Logs are stored in `app-data/logs/`:

- `app-{date}.log`: All logs
- `error-{date}.log`: Error logs only

View recent logs in the app:
- Settings → Logs → View Recent Logs

## Performance Tuning

### For Fast Networks

```json
{
  "download": {
    "maxConcurrentDownloads": 10,
    "chunkSizeBytes": 10485760  // 10MB
  }
}
```

### For Limited Resources

```json
{
  "processing": {
    "maxConcurrentWorkers": 2,
    "batchSize": 5
  },
  "performance": {
    "maxMemoryUsageMB": 1024
  }
}
```

## Testing

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run with coverage
npm test -- --coverage
```

## Building & Distribution

### Code Signing

For production builds, configure code signing in `build/electron-builder.json`:

```json
{
  "win": {
    "certificateFile": "path/to/certificate.pfx",
    "certificatePassword": "password"
  },
  "mac": {
    "identity": "Developer ID Application: Your Name"
  }
}
```

### Auto-Updates

Configure update server in config:

```json
{
  "updates": {
    "enabled": true,
    "server": "https://your-update-server.com"
  }
}
```

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests
5. Submit a pull request

## License

MIT License - See LICENSE file for details

## Support

- **Issues**: https://github.com/your-repo/issues
- **Docs**: https://your-docs-site.com
- **Email**: support@yourapp.com

---

**Version**: 1.0.0
**Last Updated**: 2026-01-28
