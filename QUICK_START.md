# Time Scheduler - Quick Start Guide

Your scheduled job (Job ID: 1) is OVERDUE and waiting to run!
Scheduled time: 17:14, Current time: ~17:35 (20+ minutes late)

## IMMEDIATE ACTION REQUIRED

You need to start 4 services. Your job will run IMMEDIATELY once Celery Beat starts!

---

## Step 1: Start Redis (Terminal 1)

### Option A: Using Docker (Recommended)
1. Open Docker Desktop application
2. Wait for it to fully start
3. Run:
```
docker run -d --name gallery-redis -p 6379:6379 redis:latest
```

### Option B: Download Redis
Download from: https://github.com/microsoftarchive/redis/releases
Then run: redis-server.exe

---

## Step 2: Start Django Backend (Terminal 2)
```
cd backend
python manage.py runserver
```

---

## Step 3: Start Celery Worker (Terminal 3)
```
cd backend
celery -A config worker --loglevel=info --pool=solo --concurrency=2
```
Note: --pool=solo is REQUIRED on Windows!

---

## Step 4: Start Celery Beat (Terminal 4) *** CRITICAL! ***
```
cd backend
celery -A config beat --loglevel=info
```

THIS IS THE MOST IMPORTANT SERVICE!
Without Celery Beat, scheduled jobs will NEVER execute!

You should see:
  Configuration ->
    . check-scheduled-jobs-every-minute: * * * * *

---

## Step 5: Start React Frontend (Terminal 5)
```
cd frontend
npm start
```

---

## What Will Happen

Once Celery Beat starts, you'll see:
- Terminal 4 (Beat): "[Scheduler] Found 1 job(s) to execute"
- Terminal 3 (Worker): "[Task xxx] Executing scheduled job 1"
- Web UI: Status changes from Pending -> Running -> Completed/Failed

Your job will likely FAIL with "Drive credentials not found" error.
This is EXPECTED! Set up Google Drive credentials later.

---

## Verify Services
```
cd backend
python check_scheduler.py
```

Should show:
- [OK] Database
- [OK] Celery Config  
- [OK] Redis
- [OK] Celery Processes

---

## Open Web UI
http://localhost:3000/time-scheduler

The page will auto-refresh every 5 seconds to show job status.

---

READY? Start Docker Desktop, then open 5 terminals and run the commands above!
