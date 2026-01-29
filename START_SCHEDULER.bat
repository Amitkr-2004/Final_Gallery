@echo off
echo ============================================================
echo   TIME SCHEDULER - Service Starter
echo ============================================================
echo.
echo This script will help you start all required services.
echo You need to open MULTIPLE terminal windows.
echo.
echo ============================================================
echo   REQUIRED SERVICES:
echo ============================================================
echo   1. Redis Server
echo   2. Django Backend
echo   3. Celery Worker
echo   4. Celery Beat (Scheduler) - CRITICAL!
echo   5. React Frontend
echo ============================================================
echo.
echo Press any key to see detailed instructions...
pause >nul

echo.
echo ============================================================
echo   STEP 1: START REDIS
echo ============================================================
echo.
echo If you have Redis installed:
echo   Open Terminal 1 and run: redis-server
echo.
echo If you have Docker:
echo   docker run -d -p 6379:6379 redis:latest
echo.
echo If you DON'T have Redis:
echo   Download from: https://github.com/microsoftarchive/redis/releases
echo   Or install via: choco install redis-64
echo.
pause

echo.
echo ============================================================
echo   STEP 2: START DJANGO BACKEND
echo ============================================================
echo.
echo Open Terminal 2 and run:
echo   cd backend
echo   python manage.py runserver
echo.
pause

echo.
echo ============================================================
echo   STEP 3: START CELERY WORKER
echo ============================================================
echo.
echo Open Terminal 3 and run:
echo   cd backend
echo   celery -A config worker --loglevel=info --pool=solo
echo.
echo NOTE: --pool=solo is required for Windows
echo.
pause

echo.
echo ============================================================
echo   STEP 4: START CELERY BEAT (SCHEDULER) - MOST IMPORTANT!
echo ============================================================
echo.
echo Open Terminal 4 and run:
echo   cd backend
echo   celery -A config beat --loglevel=info
echo.
echo THIS IS CRITICAL! Without Celery Beat, scheduled jobs will NOT run!
echo.
echo You should see output like:
echo   Configuration -^>
echo     . check-scheduled-jobs-every-minute: * * * * *
echo.
pause

echo.
echo ============================================================
echo   STEP 5: START REACT FRONTEND
echo ============================================================
echo.
echo Open Terminal 5 and run:
echo   cd frontend
echo   npm start
echo.
pause

echo.
echo ============================================================
echo   ALL DONE!
echo ============================================================
echo.
echo Now open: http://localhost:3000/time-scheduler
echo.
echo Your scheduled job should start automatically (it's overdue!)
echo.
echo To verify everything is working, run:
echo   cd backend
echo   python check_scheduler.py
echo.
pause
