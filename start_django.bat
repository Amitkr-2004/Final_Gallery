@echo off
echo ================================================
echo  Starting Django Server for Gallery App
echo ================================================
echo.

cd backend

echo Activating virtual environment...
call venv\Scripts\activate.bat

echo.
echo Starting Django development server...
echo Server will be available at: http://localhost:8000
echo (Press Ctrl+C to stop)
echo.

python manage.py runserver

pause
