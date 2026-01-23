@echo off
echo ================================================
echo  Starting Celery Worker for Gallery App
echo ================================================
echo.

cd backend

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Starting Celery worker...
echo (Press Ctrl+C to stop)
echo.

celery -A config worker --loglevel=info --pool=solo

pause
