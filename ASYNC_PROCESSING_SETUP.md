# Async Processing Setup Guide

This guide explains how to run the optimized async photo processing system with Celery and Redis.

## System Architecture

The application now uses **async background processing** to handle photo uploads efficiently:

1. **Upload Flow** (< 200ms):
   - User uploads photo
   - Photo saved to disk with `status='pending'`
   - Background task enqueued
   - API returns immediately

2. **Background Processing** (runs asynchronously):
   - Generate thumbnails (200x200 and 800x800 WebP)
   - Detect faces with InsightFace
   - Match faces using FAISS
   - Create/update person collections
   - Update daily statistics
   - Mark photo as `completed`

3. **Collections Page** (fast load):
   - Pagination (30 persons per page)
   - Redis caching (5 minute TTL)
   - Optimized queries (no embedding_vector)
   - Thumbnail images (15KB vs 3MB)

## Prerequisites

Before starting, ensure you have:

1. **Python packages installed** (already done):
   ```bash
   celery==5.3.4
   redis==5.0.1
   django-redis==5.4.0
   pillow-heif==0.13.1
   ```

2. **Redis server** (needed for Celery broker and caching)

3. **Docker Desktop** (easiest way to run Redis on Windows)

## Step 1: Start Redis Server

### Option A: Using Docker (Recommended)

1. **Start Docker Desktop**
   - Open Docker Desktop application
   - Wait for it to fully start (whale icon in system tray should be stable)

2. **Start Redis container**:
   ```bash
   docker run -d -p 6379:6379 --name redis redis:7-alpine
   ```

3. **Verify Redis is running**:
   ```bash
   docker ps
   # Should show redis container running on port 6379
   ```

### Option B: Using the Quick Setup Script

```bash
cd D:\Gallery_VSCode
.\SETUP_REDIS_QUICK.bat
```

This script will:
- Check if Docker is running
- Start Redis container
- Test connection

### Option C: Manual Windows Installation

If Docker is not available:
1. Download Memurai (Redis for Windows) from: https://www.memurai.com/
2. Install and start Memurai service
3. Redis will run on `localhost:6379` by default

## Step 2: Start Celery Worker

The Celery worker processes background tasks (thumbnail generation, face detection).

### In a new terminal:

```bash
# Navigate to backend directory
cd D:\Gallery_VSCode\backend

# Activate virtual environment
.\venv\Scripts\activate

# Start Celery worker
celery -A config worker --loglevel=info --pool=solo
```

**Notes**:
- `--pool=solo` is required on Windows (default pool doesn't work on Windows)
- Keep this terminal open - it needs to run continuously
- You'll see logs for each task processed

**Expected output**:
```
 -------------- celery@HOSTNAME v5.3.4 (emerald-rush)
--- ***** -----
-- ******* ---- Windows-10-... 2026-01-21 ...
- *** --- * ---
- ** ---------- [config]
- ** ---------- .> app:         gallery:0x...
- ** ---------- .> transport:   redis://localhost:6379/0
- ** ---------- .> results:     redis://localhost:6379/0
- *** --- * --- .> concurrency: 1 (solo)
-- ******* ---- .> task events: OFF
--- ***** -----
 -------------- [queues]
                .> celery           exchange=celery(direct) key=celery

[tasks]
  . api.tasks.process_photo
  . config.celery.debug_task

[2026-01-21 ...] INFO/MainProcess] Connected to redis://localhost:6379/0
[2026-01-21 ...] INFO/MainProcess] celery@HOSTNAME ready.
```

## Step 3: Start Django Server

### In another terminal:

```bash
# Navigate to backend directory
cd D:\Gallery_VSCode\backend

# Activate virtual environment
.\venv\Scripts\activate

# Start Django development server
python manage.py runserver
```

## Step 4: Test the System

### 1. Upload a Photo

```bash
# Using curl (with an example photo)
curl -X POST http://localhost:8000/api/upload/ \
  -F "image=@D:\path\to\photo.jpg" \
  -F "event_id=evt_test_123"
```

**Expected response**:
```json
{
    "photo_id": 1,
    "message": "Photo uploaded successfully and queued for processing",
    "file_path": "images/abc123...jpg",
    "status": "pending",
    "task_id": "task-uuid-here",
    "note": "Photo is being processed in background. Face detection and thumbnails will be ready shortly."
}
```

### 2. Check Celery Worker Logs

In the Celery worker terminal, you should see:
```
[Task task-uuid] Starting processing for photo 1
[Task task-uuid] Generating thumbnails for photo 1
[Task task-uuid] Thumbnails created: {'small': '...', 'medium': '...'}
[Task task-uuid] Running face detection for photo 1
[Task task-uuid] Detected and matched 2 faces
[Task task-uuid] Updated daily statistics
[Task task-uuid] Invalidated persons list cache
[Task task-uuid] Successfully completed processing photo 1
```

### 3. Check Photo Status

```bash
curl http://localhost:8000/api/photos/
```

Response should show:
```json
[
    {
        "id": 1,
        "status": "completed",
        "thumbnail_small_url": "/media/thumbnails/abc123_small.webp",
        "thumbnail_medium_url": "/media/thumbnails/abc123_medium.webp",
        ...
    }
]
```

### 4. Check Collections Page (with caching)

```bash
# First request - hits database
curl http://localhost:8000/api/persons/?page=1

# Second request within 5 minutes - returns from cache
curl http://localhost:8000/api/persons/?page=1
```

Response includes pagination:
```json
{
    "results": [
        {
            "id": 1,
            "person_number": 1,
            "photo_count": 5,
            "cover_face_image_url": "/media/...",
            ...
        }
    ],
    "pagination": {
        "page": 1,
        "total_pages": 3,
        "total_count": 75,
        "has_next": true,
        "has_previous": false
    }
}
```

## Performance Monitoring

### Check Redis Cache

```bash
# Connect to Redis
docker exec -it redis redis-cli

# Check cache keys
KEYS persons_list_*

# Check TTL (time to live)
TTL persons_list_page_1

# Get cached data
GET persons_list_page_1
```

### Check Celery Task Queue

```bash
# In Django shell
python manage.py shell

# Check pending tasks
from celery.result import AsyncResult
task_id = "your-task-id-here"
result = AsyncResult(task_id)
print(result.state)  # PENDING, STARTED, SUCCESS, FAILURE
print(result.info)   # Task result or error info
```

### Monitor Database Queries

```python
# In Django shell
from api.models import Photo, Person

# Check processing status
Photo.objects.values('status').annotate(count=Count('id'))
# Example output: [{'status': 'completed', 'count': 100}, {'status': 'pending', 'count': 5}]

# Check persons count
Person.objects.count()
```

## Troubleshooting

### Redis Connection Error

**Error**: `ConnectionRefusedError: [Errno 10061] No connection could be made`

**Solution**:
1. Check if Redis is running: `docker ps`
2. If not running: `docker start redis`
3. If container doesn't exist: `docker run -d -p 6379:6379 --name redis redis:7-alpine`

### Celery Worker Not Processing Tasks

**Error**: Tasks stuck in `pending` state

**Solutions**:
1. Check worker is running: Look for "celery@HOSTNAME ready" message
2. Check worker can connect to Redis: Look for "Connected to redis://..." message
3. Restart worker: `Ctrl+C` then run celery command again
4. Check task is registered: Look for `api.tasks.process_photo` in [tasks] list

### Django Can't Import Celery

**Error**: `ModuleNotFoundError: No module named 'celery'`

**Solution**:
```bash
# Make sure you're in the virtual environment
cd D:\Gallery_VSCode\backend
.\venv\Scripts\activate

# Verify celery is installed
python -c "import celery; print(celery.__version__)"

# If not installed
pip install celery==5.3.4 redis==5.0.1 django-redis==5.4.0
```

### Thumbnails Not Generated

**Check**:
1. Photo status: Should be `completed`, not `failed`
2. Celery logs: Look for thumbnail generation errors
3. Media directory: `backend/media/thumbnails/` should exist
4. Permissions: Ensure worker can write to media directory

### Cache Not Working

**Check**:
1. Redis is running: `docker ps`
2. Django cache settings: Check `config/settings.py` CACHES configuration
3. Cache keys: `docker exec -it redis redis-cli` then `KEYS *`

## Architecture Benefits

### Before (Synchronous)
- Upload time: 2-5 seconds per image (blocking)
- Collections page: 3-5 seconds for 100 persons
- Each upload increased page load time
- Large payloads (2KB embedding_vector per person)

### After (Async + Cached)
- Upload time: **< 200ms** (immediate return)
- Collections page: **< 100ms** (from cache)
- Background processing doesn't block uploads
- Optimized payloads (no embedding_vector)
- Thumbnail images (15KB vs 3MB)
- Pagination (only 30 persons loaded)

## Next Steps

### For Production Deployment:
1. Use separate Redis instances for cache and Celery
2. Scale Celery workers horizontally (multiple worker processes)
3. Add monitoring (Flower for Celery, Redis monitoring)
4. Configure CDN for static/media files
5. Use Redis persistence (RDB or AOF)
6. Set up Celery beat for periodic tasks (cleanup, statistics)

### Optional Enhancements:
1. WebSocket notifications for upload status
2. Progress bars for batch uploads
3. Image optimization (compression, format conversion)
4. Face quality scoring for better cover image selection
5. Duplicate detection before upload (client-side hashing)
