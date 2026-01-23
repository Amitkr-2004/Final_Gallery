#!/bin/bash

# Safe script to backup and clear all images from the Photo Gallery
# This script will:
# 1. Create a backup of database and media files
# 2. Clear all data using Django management command
# 3. Verify the cleanup

echo ""
echo "============================================================"
echo "PHOTO GALLERY - SAFE CLEAR ALL DATA"
echo "============================================================"
echo ""
echo "This script will:"
echo "  1. Create a backup of your database and media files"
echo "  2. Clear all photos, persons, and statistics"
echo "  3. Delete all image files from storage"
echo ""
echo "IMPORTANT: This is a DESTRUCTIVE operation!"
echo ""

# Check if we're in the backend directory
if [ ! -f "manage.py" ]; then
    echo "ERROR: Please run this script from the backend directory"
    echo "Current directory: $(pwd)"
    echo "Expected: .../Gallery_VSCode/backend"
    exit 1
fi

# Step 1: Create backup
echo "[STEP 1/3] Creating backup..."
echo ""
python backup_before_clear.py
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Backup failed. Aborting cleanup."
    echo "Please fix backup errors before proceeding."
    exit 1
fi

echo ""
echo "============================================================"
echo "Backup completed successfully!"
echo "============================================================"
echo ""
echo "[STEP 2/3] Ready to clear all data..."
echo ""

# Step 2: Clear all data
python manage.py clear_all_data
if [ $? -ne 0 ]; then
    echo ""
    echo "ERROR: Data cleanup failed."
    echo "Your backup is safe in backend/backups/"
    exit 1
fi

echo ""
echo "[STEP 3/3] Verifying cleanup..."
echo ""

# Step 3: Verify (simple check)
python -c "from api.models import Photo, Person; print(f'Remaining photos: {Photo.objects.count()}'); print(f'Remaining persons: {Person.objects.count()}')" 2>/dev/null
if [ $? -ne 0 ]; then
    echo "WARNING: Could not verify cleanup. Please check manually."
else
    echo ""
    echo "============================================================"
    echo "SUCCESS: All data cleared successfully!"
    echo "============================================================"
    echo ""
    echo "Your backup is stored in: backend/backups/"
    echo ""
    echo "The application is now ready for new uploads."
fi

echo ""
