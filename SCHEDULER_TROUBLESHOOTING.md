# Time Scheduler Troubleshooting Guide

## 🐛 Bugs Fixed

### 1. Missing Photo Status Constants ✅
**Problem:** The `Photo` model was missing status constants (`STATUS_PENDING`, `STATUS_PROCESSING`, etc.) that were being referenced in `tasks.py`.

**Fix Applied:** Added status constants to the Photo model:
```python
STATUS_PENDING = 'pending'
STATUS_PROCESSING = 'processing'
STATUS_COMPLETED = 'completed'
STATUS_FAILED = 'failed'
```

### 2. Job Executor Status Reference ✅
**Problem:** Job executor was using string literal `'pending'` instead of the constant.

**Fix Applied:** Changed to use `Photo.STATUS_PENDING` constant.

---

## 🔍 Diagnostic Tool

I've created a diagnostic tool to help identify issues. Run it to check your scheduler status:

### Windows:
```cmd
cd D:\Gallery_VSCode\backend
CHECK_SCHEDULER.bat
```

### Manual:
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
python check_scheduler_status.py
```

This will tell you:
- ✅ Is Celery Beat running?
- ✅ Are there any scheduled jobs?
- ✅ What is the status of each job?
- ✅ Is the folder path valid?
- ✅ How many images are in the folder?

---

## 🚀 Most Common Issue: Celery Not Running

The **#1 reason** jobs don't execute is because **Celery Beat is not running**.

### What is Celery Beat?
Celery Beat is a scheduler that checks every minute if any jobs need to run. Without it, jobs will stay in "pending" status forever.

### How to Start Celery Services

You need **TWO terminals** running:

#### Terminal 1: Celery Worker
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
celery -A config worker -l info
```

**What it does:** Processes background tasks (face detection, thumbnails)

#### Terminal 2: Celery Beat
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
celery -A config beat -l info
```

**What it does:** Checks scheduled jobs every minute and triggers them

### Verify Celery is Running

When Celery Beat is running, you should see output like:
```
celery beat v5.x.x is starting.
LocalTime -> 2026-01-27 15:30:00
Scheduler: PersistentScheduler
-> celerybeat: ...
```

Every minute, you'll see:
```
Scheduler: Sending due task check-scheduled-jobs-every-minute
```

---

## 📋 Step-by-Step Troubleshooting

### Step 1: Restart Django Server

After applying the fixes, restart your Django server:

```cmd
# Stop the server (Ctrl+C)
# Then restart:
python manage.py runserver
```

### Step 2: Check Scheduled Job Status

Run the diagnostic tool:
```cmd
CHECK_SCHEDULER.bat
```

Look for:
```
SCHEDULED JOBS STATUS
=====================
Found 1 active job(s):

Job ID: 1
  Status: pending
  Scheduled Time: 2026-01-27 15:25:00
  Folder Path: C:\Users\AMIT\Downloads\Images
```

### Step 3: Check Folder Path

The diagnostic tool will verify:
- ✅ Folder exists
- ✅ Folder is readable
- ✅ Images found in folder

If you see errors:
- ✗ "Folder does NOT exist" → Check the path is correct
- ✗ "No images found" → Make sure folder contains .jpg, .png, etc.

### Step 4: Start Celery Services

If the diagnostic says "Celery Beat is STOPPED":

1. **Start Celery Worker:**
   ```cmd
   # New terminal 1
   cd D:\Gallery_VSCode\backend
   venv\Scripts\activate
   celery -A config worker -l info
   ```

2. **Start Celery Beat:**
   ```cmd
   # New terminal 2
   cd D:\Gallery_VSCode\backend
   venv\Scripts\activate
   celery -A config beat -l info
   ```

### Step 5: Wait for Execution

- If your scheduled time has passed, the job should execute **within 1 minute**
- If scheduling a new job, it will execute at the scheduled time (assuming Celery is running)

### Step 6: Monitor Execution

Watch the Celery Beat terminal for:
```
Scheduler: Sending due task check-scheduled-jobs-every-minute
Received task: api.tasks.execute_scheduled_job[...]
```

Watch the Celery Worker terminal for:
```
[Job 1] Starting execution
[Job 1] Validating folder path: C:\Users\AMIT\Downloads\Images
[Job 1] Found 50 images in folder
[Job 1] Created event: student-images-1234567890
[Job 1] Processing 50 images
...
[Job 1] Completed successfully
```

### Step 7: Verify Results

Check the Time Scheduler page in your browser:
- Status should change: Pending → Running → Completed
- Images processed count should show
- Event ID should be displayed

---

## ⚠️ Common Issues & Solutions

### Issue 1: Job Stuck in "Pending"
**Symptom:** Job status stays "pending" even after scheduled time passed

**Cause:** Celery Beat not running

**Solution:**
1. Run diagnostic: `CHECK_SCHEDULER.bat`
2. Start Celery Beat: `celery -A config beat -l info`

---

### Issue 2: Job Status "Failed"
**Symptom:** Job status changes to "failed" with error log

**Causes & Solutions:**

#### A. Folder not found
```
Error: Folder path does not exist: C:\Users\AMIT\Downloads\Images
```
**Solution:** Check the folder path is correct and folder exists

#### B. Permission denied
```
Error: Folder is not readable (permission denied)
```
**Solution:** Ensure backend has read access to the folder

#### C. No images found
```
Error: No images found in folder
```
**Solution:**
- Check folder contains image files (.jpg, .png, etc.)
- Verify file extensions are in `ALLOWED_IMAGE_EXTENSIONS`

#### D. Import error or module not found
```
Error: No module named 'PIL' or 'insightface'
```
**Solution:**
```cmd
pip install -r requirements.txt
```

---

### Issue 3: Images Not Appearing in Event
**Symptom:** Job completes but no images in "My Events"

**Cause:** Frontend localStorage not updated

**Solution:**
1. Refresh browser (Ctrl+Shift+R)
2. Check event ID in job completion message
3. Navigate to My Events page manually

---

### Issue 4: Face Detection Not Working
**Symptom:** Images uploaded but no collections created

**Causes & Solutions:**

#### A. Celery Worker not running
**Solution:** Start worker: `celery -A config worker -l info`

#### B. InsightFace model not downloaded
**Solution:** Models download automatically on first use. Wait a few minutes.

#### C. No faces detected in images
**Solution:** This is normal if images don't contain clear faces

---

### Issue 5: Celery Connection Error
```
Error: [Errno 10061] No connection could be made
```

**Cause:** Redis or RabbitMQ not running (if using message broker)

**Solution:** Check your Celery broker configuration in `settings.py`

For development, you might be using:
```python
CELERY_BROKER_URL = 'filesystem://'  # No broker needed
```

Or:
```python
CELERY_BROKER_URL = 'redis://localhost:6379'  # Requires Redis running
```

---

## 📊 How to Verify Everything Works

### Complete Test Flow:

1. **Create test folder:**
   ```
   C:\TestImages\
   ├── photo1.jpg
   ├── photo2.png
   └── photo3.jpg
   ```

2. **Schedule a job:**
   - Go to: http://localhost:3000/time-scheduler
   - Enter path: `C:\TestImages`
   - Select time: 2 minutes from now
   - Click "Save Schedule"

3. **Verify job created:**
   ```cmd
   CHECK_SCHEDULER.bat
   ```
   Should show: "Found 1 active job(s)" with status "pending"

4. **Start Celery services:**
   ```cmd
   # Terminal 1
   celery -A config worker -l info

   # Terminal 2
   celery -A config beat -l info
   ```

5. **Wait for execution:**
   - Watch Celery Beat terminal for task trigger
   - Watch Celery Worker terminal for execution logs
   - Watch browser - status should update automatically

6. **Check results:**
   - Status: Completed ✓
   - Images processed: 3 ✓
   - Event ID: student-images-... ✓
   - Go to "My Events" → Should see new event ✓
   - Go to "Collections" → Should see face collections ✓

---

## 🛠️ Development Setup Checklist

For **ongoing development**, keep these running:

- [ ] **Terminal 1:** Django server
  ```cmd
  python manage.py runserver
  ```

- [ ] **Terminal 2:** Celery Worker
  ```cmd
  celery -A config worker -l info
  ```

- [ ] **Terminal 3:** Celery Beat
  ```cmd
  celery -A config beat -l info
  ```

- [ ] **Terminal 4:** Frontend (React)
  ```cmd
  npm start
  ```

**Total:** 4 terminal windows for full system

---

## 📝 Quick Reference

### Check Status
```cmd
CHECK_SCHEDULER.bat
```

### Start Services
```cmd
# Django
python manage.py runserver

# Celery Worker
celery -A config worker -l info

# Celery Beat
celery -A config beat -l info
```

### View Logs
- Django: Terminal where `runserver` is running
- Celery Worker: Terminal where worker is running
- Celery Beat: Terminal where beat is running

### Stop Services
- Press `Ctrl+C` in each terminal

---

## 🎯 Summary

**Bugs Fixed:**
1. ✅ Added missing Photo status constants
2. ✅ Updated job executor to use constants

**Most Common Issue:**
- ⚠️ Celery Beat not running → Jobs stay in "pending" forever

**Solution:**
1. Start Celery Worker: `celery -A config worker -l info`
2. Start Celery Beat: `celery -A config beat -l info`
3. Run diagnostic: `CHECK_SCHEDULER.bat`

**Everything Working When:**
- ✓ Diagnostic shows "Celery Beat is RUNNING"
- ✓ Job status changes: Pending → Running → Completed
- ✓ Images appear in "My Events"
- ✓ Face collections are created

---

**Need more help?** Run the diagnostic tool for detailed status information!
