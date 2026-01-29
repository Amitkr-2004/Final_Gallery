@echo off
echo ============================================================
echo   Starting Celery Worker
echo ============================================================
echo.

cd /d %~dp0

echo Checking Python environment...
python --version
echo.

echo Starting Celery Worker with solo pool (Windows compatible)...
echo.

celery -A config worker --loglevel=info --pool=solo --concurrency=2

pause
