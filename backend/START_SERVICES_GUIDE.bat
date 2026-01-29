@echo off
color 0A
title Time Scheduler - Service Startup Guide
cls

echo.
echo  =========================================================================
echo    TIME SCHEDULER - SERVICE STARTUP GUIDE
echo  =========================================================================
echo.
echo  To use the Time Scheduler, you need 3 services running:
echo.
echo    1. Django Server      (Backend API)
echo    2. Celery Worker      (Background Tasks)
echo    3. Celery Beat        (Scheduler) ^<-- CRITICAL FOR TIME SCHEDULER
echo.
echo  =========================================================================
echo.
echo  STEP 1: Start Django Server
echo  -------------------------------------------------------------------------
echo.
echo  Open a NEW Command Prompt and run:
echo.
echo    cd D:\Gallery_VSCode\backend
echo    venv\Scripts\activate
echo    python manage.py runserver
echo.
echo  Leave that window OPEN.
echo.
pause
cls

echo.
echo  =========================================================================
echo    TIME SCHEDULER - SERVICE STARTUP GUIDE
echo  =========================================================================
echo.
echo  STEP 2: Start Celery Worker
echo  -------------------------------------------------------------------------
echo.
echo  Option A: Double-click this file in File Explorer:
echo    D:\Gallery_VSCode\backend\start_celery_worker.bat
echo.
echo  Option B: Open a NEW Command Prompt and run:
echo    cd D:\Gallery_VSCode\backend
echo    venv\Scripts\activate
echo    start_celery_worker.bat
echo.
echo  Leave that window OPEN.
echo.
pause
cls

echo.
echo  =========================================================================
echo    TIME SCHEDULER - SERVICE STARTUP GUIDE
echo  =========================================================================
echo.
echo  STEP 3: Start Celery Beat (CRITICAL!)
echo  -------------------------------------------------------------------------
echo.
echo  Option A: Double-click this file in File Explorer:
echo    D:\Gallery_VSCode\backend\start_celery_beat.bat
echo.
echo  Option B: Open a NEW Command Prompt and run:
echo    cd D:\Gallery_VSCode\backend
echo    venv\Scripts\activate
echo    start_celery_beat.bat
echo.
echo  Leave that window OPEN.
echo.
echo  You should see "beat: Starting..." and periodic task messages.
echo.
pause
cls

echo.
echo  =========================================================================
echo    TIME SCHEDULER - VERIFY SERVICES
echo  =========================================================================
echo.
echo  Now let's check if everything is running...
echo.
pause

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
) else (
    echo ERROR: Virtual environment not found!
    pause
    exit /b 1
)

echo.
echo  Running diagnostic tool...
echo.
python check_scheduler_status.py

echo.
echo  =========================================================================
echo    NEXT STEPS
echo  =========================================================================
echo.
echo  If you see "Celery Beat is RUNNING" above:
echo    - Go to: http://localhost:3000/time-scheduler
echo    - Schedule a test job
echo    - Watch it execute!
echo.
echo  If you see "Celery Beat is STOPPED":
echo    - Go back and complete Step 3
echo    - Make sure start_celery_beat.bat is running
echo.
echo  =========================================================================
echo.
pause
