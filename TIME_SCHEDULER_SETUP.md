# Time Scheduler - Setup Guide

## Overview

The Time Scheduler feature allows you to schedule automated image processing jobs from Google Drive folders. At the scheduled time, the system will:

1. Fetch all images from the provided Google Drive link
2. Create a new event called "Student Images"
3. Upload and process each image
4. Run face detection and create collections
5. Update statistics

---

## Prerequisites

- Python 3.8+ with all dependencies installed
- Node.js 16+ for frontend
- PostgreSQL database running
- Redis server running (for Celery)
- Google Cloud Platform account

---

## Installation Steps

### 1. Install Backend Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Install Frontend Dependencies

```bash
cd frontend
npm install
```

### 3. Apply Database Migrations

```bash
cd backend
python manage.py migrate
```

---

## Google Drive API Setup

### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Click "Select a project" → "New Project"
3. Name: "Gallery-Scheduler" (or your preferred name)
4. Click "Create"

### Step 2: Enable Google Drive API

1. In the Google Cloud Console, go to "APIs & Services" → "Library"
2. Search for "Google Drive API"
3. Click on it and press "Enable"

### Step 3: Create Service Account

1. Go to "APIs & Services" → "Credentials"
2. Click "Create Credentials" → "Service Account"
3. Fill in details:
   - **Service account name**: `gallery-scheduler-service`
   - **Service account ID**: (auto-generated)
   - **Description**: Service account for automated image processing
4. Click "Create and Continue"
5. **Grant this service account access to project**:
   - Role: Select "Viewer" (read-only access)
   - Click "Continue"
6. Click "Done"

### Step 4: Download Service Account Credentials

1. In the Credentials page, find your newly created service account
2. Click on the service account email
3. Go to the "Keys" tab
4. Click "Add Key" → "Create new key"
5. Select "JSON" format
6. Click "Create"
7. A JSON file will be downloaded

### Step 5: Configure Credentials in Project

1. Rename the downloaded file to `drive_credentials.json`
2. Move it to: `backend/drive_credentials.json`
3. **Important**: This file is already in `.gitignore` and should NEVER be committed to git

The JSON file should look like this:
```json
{
  "type": "service_account",
  "project_id": "your-project-id",
  "private_key_id": "...",
  "private_key": "-----BEGIN PRIVATE KEY-----\n...",
  "client_email": "gallery-scheduler-service@your-project.iam.gserviceaccount.com",
  "client_id": "...",
  "auth_uri": "https://accounts.google.com/o/oauth2/auth",
  "token_uri": "https://oauth2.googleapis.com/token",
  ...
}
```

### Step 6: Share Google Drive Folder

For each folder you want to process:

1. Open the Google Drive folder in your browser
2. Click the "Share" button
3. In the "Add people and groups" field, paste the service account email:
   - Found in `drive_credentials.json` as `client_email`
   - Example: `gallery-scheduler-service@your-project.iam.gserviceaccount.com`
4. Set permission to **"Viewer"**
5. Uncheck "Notify people" (service accounts don't receive emails)
6. Click "Share"

---

## Running the Application

### 1. Start Backend Services

**Terminal 1 - Django Server:**
```bash
cd backend
python manage.py runserver
```

**Terminal 2 - Celery Worker:**
```bash
cd backend
celery -A config worker --loglevel=info --concurrency=2
```

**Terminal 3 - Celery Beat (Scheduler):**
```bash
cd backend
celery -A config beat --loglevel=info
```

### 2. Start Frontend

**Terminal 4 - React App:**
```bash
cd frontend
npm start
```

The application will open at: http://localhost:3000

---

## Using Time Scheduler

### Scheduling a Job

1. Navigate to **"Time Scheduler"** in the sidebar
2. Select a date and time (must be in the future)
3. Paste your Google Drive folder link
   - Format: `https://drive.google.com/drive/folders/FOLDER_ID`
   - Make sure the folder is shared with the service account
4. Click **"Save Schedule"**

### Monitoring Job Status

The page automatically polls for status updates every 5 seconds when a job is running.

**Status Indicators:**
- **Pending** (Blue): Job scheduled, waiting for execution time
- **Running** (Yellow): Job currently processing images
- **Completed** (Green): Job finished successfully
- **Failed** (Red): Job encountered an error

### Job Lifecycle

1. **Pending**: Job is scheduled and waiting
   - You can cancel it using the "Cancel Job" button
2. **Running**: Job is executing
   - Shows real-time progress (images processed)
   - Cannot be cancelled
3. **Completed**: Job finished
   - Shows statistics: Event ID, images processed, completion time
   - Check "My Events" page to see the created "Student Images" event
4. **Failed**: Job encountered an error
   - Shows detailed error log
   - Common errors:
     - Invalid Drive link
     - Permission denied (folder not shared)
     - No images found in folder
     - Network issues

---

## Troubleshooting

### Issue: "No module named 'insightface'"

**Solution:**
```bash
cd backend
pip install insightface onnxruntime
```

### Issue: "Drive credentials not found"

**Solution:**
- Ensure `backend/drive_credentials.json` exists
- Check file path is correct
- Verify JSON format is valid

### Issue: "Permission denied" when accessing Drive folder

**Solution:**
- Verify folder is shared with service account email
- Check service account has "Viewer" permission
- Wait a few minutes for permissions to propagate

### Issue: "Celery worker not processing tasks"

**Solution:**
- Ensure Redis is running: `redis-cli ping` (should return "PONG")
- Restart Celery worker
- Check Celery logs for errors

### Issue: "Job stays in pending status"

**Solution:**
- Ensure Celery Beat is running (scheduler service)
- Check Celery Beat logs: should see "[Scheduler] Checking for scheduled jobs..."
- Verify scheduled time is in the past (job should execute immediately)

### Issue: "Face detection not working"

**Solution:**
```bash
cd backend
python manage.py shell
>>> from api.utils import detect_faces_and_extract_embeddings
>>> # Test with a sample image
```

---

## Architecture Overview

### Backend Components

1. **ScheduledJob Model** (`api/models.py`)
   - Stores job information and status
   - One active job at a time

2. **DriveService** (`api/drive_service.py`)
   - Handles Google Drive API integration
   - Downloads images from Drive folders

3. **JobExecutor** (`api/job_executor.py`)
   - Orchestrates job execution pipeline
   - Handles errors gracefully

4. **Celery Tasks** (`api/tasks.py`)
   - `check_and_execute_scheduled_jobs()`: Runs every minute via Beat
   - `execute_scheduled_job()`: Executes a specific job
   - `process_photo()`: Existing task for face detection

5. **API Endpoints** (`api/scheduler_views.py`)
   - `GET /api/scheduler/job/`: Get current job
   - `POST /api/scheduler/job/`: Create/update job
   - `DELETE /api/scheduler/job/`: Cancel job

### Frontend Components

1. **TimeScheduler** (`components/scheduler/TimeScheduler.js`)
   - Main page component
   - Form for scheduling
   - Status monitoring with polling

2. **Routing** (`App.js`)
   - Route: `/time-scheduler`

3. **Sidebar** (`components/layout/Sidebar.js`)
   - Navigation link with Clock icon

---

## Configuration

### Environment Variables (Optional)

Create a `.env` file in `backend/`:

```env
# Google Drive
DRIVE_CREDENTIALS_PATH=/path/to/drive_credentials.json

# Face Detection
FAISS_SIMILARITY_THRESHOLD=0.7
FACE_DETECTION_CONFIDENCE_THRESHOLD=0.5

# Database
DB_NAME=photogallery
DB_USER=postgres
DB_PASSWORD=yourpassword
DB_HOST=localhost
DB_PORT=5432
```

### Django Settings

Key settings in `backend/config/settings.py`:

```python
# Media files
MEDIA_ROOT = os.path.join(BASE_DIR, 'media')
MEDIA_URL = '/media/'

# Thumbnails
THUMBNAIL_SIZES = {
    'small': (200, 200),
    'medium': (800, 800),
}
THUMBNAIL_QUALITY = 85
THUMBNAIL_FORMAT = 'JPEG'

# Face detection
FAISS_SIMILARITY_THRESHOLD = 0.7
FACE_DETECTION_CONFIDENCE_THRESHOLD = 0.5
```

---

## Security Notes

1. **Never commit `drive_credentials.json` to git**
   - Already in `.gitignore`
   - Contains sensitive service account key

2. **Service account has read-only access**
   - Cannot modify or delete files in Drive
   - Cannot access folders not explicitly shared

3. **No user authentication required**
   - Face recognition is the only identity
   - Per project requirements

---

## Testing

### Test Job Execution Manually

```bash
cd backend
python manage.py shell
```

```python
from api.models import ScheduledJob
from api.job_executor import JobExecutor
from django.utils import timezone

# Create test job
job = ScheduledJob.objects.create(
    scheduled_time=timezone.now(),
    drive_link="https://drive.google.com/drive/folders/YOUR_FOLDER_ID"
)

# Execute
executor = JobExecutor(job)
result = executor.execute()
print(result)
```

### Verify Celery Beat Schedule

```bash
cd backend
celery -A config beat --loglevel=debug
```

Should show:
```
LocalTime -> 2026-01-26 15:30:00
Configuration ->
    . check-scheduled-jobs-every-minute: * * * * * (m/h/d/dM/MY)
```

---

## Production Deployment Checklist

- [ ] Set up proper credentials management (env vars or secrets manager)
- [ ] Configure logging to file and monitoring service
- [ ] Set up Celery worker auto-restart (supervisor/systemd)
- [ ] Configure Celery Beat for high availability
- [ ] Add health check endpoints
- [ ] Set up alerting for failed jobs
- [ ] Implement rate limiting on API endpoints
- [ ] Configure backup for FAISS index
- [ ] Set up database backups
- [ ] Configure CORS for production domain

---

## Support

For issues or questions:
- Check logs in `backend/logs/` (if configured)
- Review Django logs: `backend/manage.py runserver` output
- Review Celery logs: worker and beat outputs
- Check browser console for frontend errors

---

## Feature Roadmap (Future Enhancements)

- [ ] Multiple concurrent scheduled jobs
- [ ] Recurring schedules (daily, weekly)
- [ ] Local folder support (alternative to Drive)
- [ ] Email notifications on completion
- [ ] Progress bar with percentage
- [ ] Custom event names
- [ ] Selective face detection toggle
- [ ] Job history page
- [ ] Export job results as CSV
