# Quick Start Guide - Async Photo Gallery

This guide will help you start Redis, Celery, Django, and test the async processing system.

## Prerequisites

- Docker Desktop installed and running
- Python virtual environment set up (already done)
- All packages installed (already done)

## Step-by-Step Startup

### 1. Start Docker Desktop

**IMPORTANT: Do this first!**

1. Press `Windows key` and search for "Docker Desktop"
2. Open Docker Desktop
3. Wait until the whale icon in system tray stops animating (this means Docker is ready)

### 2. Start Redis

**Option A: Using the startup script (Recommended)**
```bash
# Double-click this file or run in terminal:
start_redis.bat
```

**Option B: Manual command**
```bash
docker run -d -p 6379:6379 --name redis redis:7-alpine
```

**Verify Redis is running:**
```bash
docker ps
# Should show redis container running

docker exec redis redis-cli ping
# Should respond with "PONG"
```

### 3. Start Celery Worker

**Open a NEW terminal/command prompt:**

**Option A: Using the startup script (Recommended)**
```bash
# Double-click this file or run in terminal:
start_celery_worker.bat
```

**Option B: Manual commands**
```bash
cd backend
.\venv\Scripts\activate
celery -A config worker --loglevel=info --pool=solo
```

**What to expect:**
```
 -------------- celery@YOUR-PC v5.3.4 (emerald-rush)
--- ***** -----
...
[tasks]
  . api.tasks.process_photo
  . config.celery.debug_task

[INFO/MainProcess] Connected to redis://localhost:6379/0
[INFO/MainProcess] celery@YOUR-PC ready.
```

**Keep this terminal open!** The worker needs to run continuously.

### 4. Start Django Server

**Open ANOTHER NEW terminal/command prompt:**

**Option A: Using the startup script (Recommended)**
```bash
# Double-click this file or run in terminal:
start_django.bat
```

**Option B: Manual commands**
```bash
cd backend
.\venv\Scripts\activate
python manage.py runserver
```

**What to expect:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

**Keep this terminal open too!**

### 5. Test the System

Now you have 3 things running:
1. ✅ Redis (in Docker)
2. ✅ Celery Worker (in Terminal 1)
3. ✅ Django Server (in Terminal 2)

**Test the API:**

Open a browser and visit:
- Health check: http://localhost:8000/api/health/
- Get persons: http://localhost:8000/api/persons/?page=1
- Get statistics: http://localhost:8000/api/statistics/

## Testing Image Upload

### Method 1: Using curl (if you have it installed)

```bash
# Find a test image
curl -X POST http://localhost:8000/api/upload/ -F "image=@C:\path\to\your\photo.jpg"
```

### Method 2: Using Python script

Create a file `test_upload.py`:

```python
import requests

# Change this to your image path
image_path = r"C:\Users\AMIT\Pictures\test_photo.jpg"

with open(image_path, 'rb') as img:
    files = {'image': img}
    response = requests.post('http://localhost:8000/api/upload/', files=files)
    print(response.json())
```

Run it:
```bash
python test_upload.py
```

### Method 3: Using Postman or browser extension

1. Open Postman
2. Create POST request to: `http://localhost:8000/api/upload/`
3. Select Body → form-data
4. Add key: `image`, type: File
5. Choose your image file
6. Send request

### Expected Response

```json
{
    "photo_id": 1,
    "message": "Photo uploaded successfully and queued for processing",
    "file_path": "images/abc123...jpg",
    "status": "pending",
    "task_id": "some-uuid-here",
    "note": "Photo is being processed in background..."
}
```

### Watch the Magic Happen!

**In the Celery Worker terminal**, you'll see:
```
[INFO] [Task uuid] Starting processing for photo 1
[INFO] [Task uuid] Generating thumbnails for photo 1
[INFO] [Task uuid] Thumbnails created: {'small': '...', 'medium': '...'}
[INFO] [Task uuid] Running face detection for photo 1
[INFO] [Task uuid] Detected and matched 2 faces
[INFO] [Task uuid] Updated daily statistics
[INFO] [Task uuid] Successfully completed processing photo 1
```

**Check the result:**
```bash
# Get all photos
curl http://localhost:8000/api/photos/

# Should show status: "completed"
```

## Monitoring

### Check Redis Cache

```bash
# Connect to Redis CLI
docker exec -it redis redis-cli

# Inside Redis CLI:
KEYS *                      # See all cache keys
GET persons_list_page_1     # Get cached data
TTL persons_list_page_1     # Check time-to-live
```

### Check Celery Tasks

```bash
# In Django shell
cd backend
.\venv\Scripts\activate
python manage.py shell

# Run these commands:
from api.models import Photo
Photo.objects.values('status').annotate(count=Count('id'))
```

### View Generated Thumbnails

Navigate to: `backend\media\thumbnails\`

You should see files like:
- `abc123_small.webp` (200x200)
- `abc123_medium.webp` (800x800)

## Stopping Services

### Stop Celery Worker
Press `Ctrl+C` in the Celery terminal

### Stop Django Server
Press `Ctrl+C` in the Django terminal

### Stop Redis
```bash
docker stop redis
```

### Stop Everything
```bash
docker stop redis
# Plus Ctrl+C in both Celery and Django terminals
```

## Restarting Later

### Quick restart:
```bash
# Terminal 1: Start Redis
start_redis.bat

# Terminal 2: Start Celery
start_celery_worker.bat

# Terminal 3: Start Django
start_django.bat
```

All three need to be running for the system to work!

## Troubleshooting

### Redis won't start
- Make sure Docker Desktop is running
- Check if port 6379 is already in use: `netstat -ano | findstr :6379`

### Celery can't connect to Redis
- Verify Redis is running: `docker ps`
- Check connection: `docker exec redis redis-cli ping`

### Photos stuck in "pending" status
- Make sure Celery worker is running
- Check worker logs for errors
- Verify worker shows "celery@YOUR-PC ready"

### Import errors
- Make sure virtual environment is activated
- Verify packages installed: `pip list | findstr celery`

## Performance Testing

After uploading a few photos, test the optimizations:

1. **Upload Speed**: Should return in < 200ms
2. **Collections Page**: `http://localhost:8000/api/persons/?page=1`
   - First request: ~300-500ms (database query)
   - Second request: < 100ms (from cache)
3. **Thumbnail Size**: Check `media/thumbnails/` - should be 10-20KB WebP files

## Next Steps

Once everything works:
1. Upload multiple photos and watch async processing
2. Check pagination works with > 30 persons
3. Verify cache works (second request is faster)
4. Check daily statistics endpoint
5. Test with photos containing multiple faces

Enjoy your optimized photo gallery! 🚀
