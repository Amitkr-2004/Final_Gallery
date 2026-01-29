# 🚀 Quick Start Guide - Time Scheduler

## ⚡ Start All Required Services

To use the Time Scheduler feature, you need **3 services running**:

### 1️⃣ Django Server (Backend API)
### 2️⃣ Celery Worker (Background Tasks)
### 3️⃣ Celery Beat (Scheduler) ⭐ **REQUIRED FOR TIME SCHEDULER**

---

## 📝 Step-by-Step Instructions

### **Step 1: Start Django Server**

**Terminal 1:**
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
python manage.py runserver
```

**What you'll see:**
```
Starting development server at http://127.0.0.1:8000/
Quit the server with CTRL-BREAK.
```

✅ **Leave this terminal open**

---

### **Step 2: Start Celery Worker**

**Open a NEW terminal (Terminal 2):**

**Option A - Double-click the batch file:**
- Navigate to: `D:\Gallery_VSCode\backend`
- Double-click: `start_celery_worker.bat`

**Option B - Manual command:**
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
start_celery_worker.bat
```

**What you'll see:**
```
-------------- celery@YourPC v5.x.x
---- **** -----
--- * ***  * --
-- * - **** ---
- ** ----------
- ** ----------
- *** --- * ---

[tasks]
  . api.tasks.check_and_execute_scheduled_jobs
  . api.tasks.execute_scheduled_job
  . api.tasks.process_photo

[2026-01-27 15:30:00] [INFO/MainProcess] Connected to ...
```

✅ **Leave this terminal open**

---

### **Step 3: Start Celery Beat** ⭐ **CRITICAL**

**Open a NEW terminal (Terminal 3):**

**Option A - Double-click the batch file:**
- Navigate to: `D:\Gallery_VSCode\backend`
- Double-click: `start_celery_beat.bat`

**Option B - Manual command:**
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
start_celery_beat.bat
```

**What you'll see:**
```
LocalTime -> 2026-01-27 15:30:00
Configuration ->
    . broker -> memory://
    . loader -> celery.loaders.app.AppLoader
    . scheduler -> celery.beat.PersistentScheduler

beat: Starting...
```

**Every minute, you should see:**
```
Scheduler: Sending due task check-scheduled-jobs-every-minute (check_and_execute_scheduled_jobs)
```

✅ **Leave this terminal open**

---

## ✅ Verify Everything is Running

Run the diagnostic tool to confirm:

```cmd
cd D:\Gallery_VSCode\backend
CHECK_SCHEDULER.bat
```

You should see:
```
✓ Celery Beat is RUNNING (last update: 30s ago)
```

---

## 🧪 Test the Time Scheduler

### 1. **Create a Test Folder**
```
C:\TestScheduler\
├── image1.jpg
├── image2.jpg
└── image3.png
```

### 2. **Schedule a Job**
- Open browser: http://localhost:3000/time-scheduler
- Enter folder path: `C:\TestScheduler`
- Select time: **2 minutes from now**
- Click "Save Schedule"

### 3. **Watch the Execution**

**In Celery Beat terminal** (around scheduled time):
```
Scheduler: Sending due task check-scheduled-jobs-every-minute
```

**In Celery Worker terminal:**
```
[INFO/MainProcess] Task api.tasks.execute_scheduled_job[...] received
[INFO/ForkPoolWorker-1] [Job 1] Starting execution
[INFO/ForkPoolWorker-1] [Job 1] Validating folder path: C:\TestScheduler
[INFO/ForkPoolWorker-1] [Job 1] Found 3 images in folder
[INFO/ForkPoolWorker-1] [Job 1] Created event: student-images-1706361234
[INFO/ForkPoolWorker-1] [Job 1] Processing 3 images
[INFO/ForkPoolWorker-1] [Job 1] Processing image 1/3: image1.jpg
[INFO/ForkPoolWorker-1] [Job 1] Processing image 2/3: image2.jpg
[INFO/ForkPoolWorker-1] [Job 1] Processing image 3/3: image3.png
[INFO/ForkPoolWorker-1] [Job 1] Completed successfully. Processed 3 images
```

**In Browser** (Time Scheduler page):
- Status changes: Pending → Running → Completed
- Shows: "3 images processed"
- Shows: Event ID

### 4. **Check Results**
- Go to **My Events** page
- You should see: "Student Images" event
- Click to view the 3 uploaded images
- Go to **Collections** page
- You should see face collections (if faces detected)

---

## 🛑 How to Stop Services

Press **Ctrl+C** in each terminal window:
1. Django Server terminal
2. Celery Worker terminal
3. Celery Beat terminal

---

## 📊 Service Status Summary

| Service | Status | Terminal | Purpose |
|---------|--------|----------|---------|
| Django Server | ✅ Running | Terminal 1 | API Backend |
| Celery Worker | ✅ Running | Terminal 2 | Process images |
| Celery Beat | ✅ Running | Terminal 3 | **Execute scheduled jobs** |

**Total:** 3 terminal windows must be open

---

## ⚠️ Common Issues

### Issue: Job stays "Pending" forever
**Cause:** Celery Beat not running
**Solution:** Start `start_celery_beat.bat`

### Issue: "No module named 'celery'"
**Cause:** Virtual environment not activated or Celery not installed
**Solution:**
```cmd
venv\Scripts\activate
pip install celery
```

### Issue: Port already in use
**Cause:** Service already running
**Solution:** Kill the existing process or use a different port

### Issue: Folder not found
**Cause:** Invalid path or folder doesn't exist
**Solution:** Verify the folder path is correct:
```cmd
dir "C:\Your\Folder\Path"
```

---

## 🎯 Quick Commands Reference

```cmd
# Check scheduler status
cd D:\Gallery_VSCode\backend
CHECK_SCHEDULER.bat

# Start Django
python manage.py runserver

# Start Celery Worker
start_celery_worker.bat

# Start Celery Beat
start_celery_beat.bat

# View scheduled jobs
python manage.py shell
>>> from api.models import ScheduledJob
>>> for job in ScheduledJob.objects.filter(is_active=True):
...     print(f"Job {job.id}: {job.status} - {job.folder_path}")
```

---

## ✅ Success Checklist

Before scheduling a job, verify:

- [ ] Django server is running (Terminal 1)
- [ ] Celery Worker is running (Terminal 2)
- [ ] Celery Beat is running (Terminal 3)
- [ ] Diagnostic shows "Celery Beat is RUNNING"
- [ ] Test folder exists and contains images
- [ ] Browser can access: http://localhost:3000/time-scheduler

---

**🎉 You're all set! The Time Scheduler is now ready to use.**

**Remember:** All 3 services must be running for the scheduler to work!
