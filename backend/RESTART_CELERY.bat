@echo off
color 0C
title IMPORTANT - Restart Celery Services
cls

echo.
echo  =========================================================================
echo    CELERY CONFIGURATION FIXED!
echo  =========================================================================
echo.
echo  The RabbitMQ error has been fixed.
echo  Celery now uses the filesystem broker (no external services needed).
echo.
echo  =========================================================================
echo    ACTION REQUIRED
echo  =========================================================================
echo.
echo  Please CLOSE the Celery windows that are showing errors, then:
echo.
echo  1. Close the Celery Worker window (if open)
echo  2. Close the Celery Beat window (if open)
echo.
pause
cls

echo.
echo  =========================================================================
echo    STARTING CELERY SERVICES WITH NEW CONFIGURATION
echo  =========================================================================
echo.
echo  Starting Celery Worker in a new window...
echo.

start "Celery Worker" cmd /k "cd /d %~dp0 && venv\Scripts\activate && celery -A config worker --loglevel=info --pool=solo --concurrency=2"

timeout /t 3 /nobreak > nul

echo  Starting Celery Beat in a new window...
echo.

start "Celery Beat" cmd /k "cd /d %~dp0 && venv\Scripts\activate && celery -A config beat --loglevel=info"

timeout /t 3 /nobreak > nul

echo.
echo  =========================================================================
echo    SERVICES STARTED
echo  =========================================================================
echo.
echo  Two new windows should have opened:
echo    - Celery Worker
echo    - Celery Beat
echo.
echo  Check those windows for:
echo    - NO "Cannot connect to amqp://" errors
echo    - "celery@YourPC v5.x.x is starting"
echo    - "beat: Starting..." (in Beat window)
echo.
echo  If you see errors, press any key to view troubleshooting...
echo.
pause
cls

echo.
echo  =========================================================================
echo    VERIFY SERVICES ARE RUNNING
echo  =========================================================================
echo.

if exist "venv\Scripts\activate.bat" (
    call venv\Scripts\activate.bat
)

echo  Running diagnostic tool...
echo.
python check_scheduler_status.py

echo.
echo  =========================================================================
echo    NEXT STEPS
echo  =========================================================================
echo.
echo  If you see "Celery Beat is RUNNING" above:
echo    SUCCESS! Go to http://localhost:3000/time-scheduler and test!
echo.
echo  If you see "Celery Beat is STOPPED":
echo    Check the Celery Beat window for errors.
echo.
echo  =========================================================================
echo.
pause
