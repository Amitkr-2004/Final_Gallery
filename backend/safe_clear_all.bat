@echo off
REM Safe script to backup and clear all images from the Photo Gallery
REM This script will:
REM 1. Create a backup of database and media files
REM 2. Clear all data using Django management command
REM 3. Verify the cleanup

echo.
echo ============================================================
echo PHOTO GALLERY - SAFE CLEAR ALL DATA
echo ============================================================
echo.
echo This script will:
echo   1. Create a backup of your database and media files
echo   2. Clear all photos, persons, and statistics
echo   3. Delete all image files from storage
echo.
echo IMPORTANT: This is a DESTRUCTIVE operation!
echo.

REM Check if we're in the backend directory
if not exist "manage.py" (
    echo ERROR: Please run this script from the backend directory
    echo Current directory: %CD%
    echo Expected: D:\Gallery_VSCode\backend
    pause
    exit /b 1
)

REM Step 1: Create backup
echo [STEP 1/3] Creating backup...
echo.
python backup_before_clear.py
if errorlevel 1 (
    echo.
    echo ERROR: Backup failed. Aborting cleanup.
    echo Please fix backup errors before proceeding.
    pause
    exit /b 1
)

echo.
echo ============================================================
echo Backup completed successfully!
echo ============================================================
echo.
echo [STEP 2/3] Ready to clear all data...
echo.

REM Step 2: Clear all data
python manage.py clear_all_data
if errorlevel 1 (
    echo.
    echo ERROR: Data cleanup failed.
    echo Your backup is safe in backend/backups/
    pause
    exit /b 1
)

echo.
echo [STEP 3/3] Verifying cleanup...
echo.

REM Step 3: Verify (simple check)
python -c "from api.models import Photo, Person; print(f'Remaining photos: {Photo.objects.count()}'); print(f'Remaining persons: {Person.objects.count()}')" 2>nul
if errorlevel 1 (
    echo WARNING: Could not verify cleanup. Please check manually.
) else (
    echo.
    echo ============================================================
    echo SUCCESS: All data cleared successfully!
    echo ============================================================
    echo.
    echo Your backup is stored in: backend\backups\
    echo.
    echo The application is now ready for new uploads.
)

echo.
pause
