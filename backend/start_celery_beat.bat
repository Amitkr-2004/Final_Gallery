@echo off
echo ============================================================
echo   Starting Celery Beat (Scheduler)
echo ============================================================
echo.
echo THIS IS THE CRITICAL SERVICE FOR TIME SCHEDULER!
echo Without this, scheduled jobs will NOT execute automatically.
echo.

cd /d %~dp0

echo Checking Python environment...
python --version
echo.

echo Starting Celery Beat...
echo You should see periodic task schedule output below.
echo.

celery -A config beat --loglevel=info

pause
