@echo off
echo ============================================================
echo  Time Scheduler Diagnostic Tool
echo ============================================================
echo.

REM Check if virtual environment exists
if exist "venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call venv\Scripts\activate.bat
) else if exist "..\venv\Scripts\activate.bat" (
    echo Activating virtual environment...
    call ..\venv\Scripts\activate.bat
) else (
    echo WARNING: Virtual environment not found.
    echo Please activate it manually before running this script.
    echo.
)

echo Running diagnostic tool...
echo.
python check_scheduler_status.py

echo.
echo ============================================================
echo.
pause
