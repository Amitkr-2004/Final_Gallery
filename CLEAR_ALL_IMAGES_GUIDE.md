# Guide: Clear All Images from Database and Storage

This guide provides safe methods to delete all images from the database and storage while preserving the application logic and database schema.

---

## Table of Contents

1. [Overview](#overview)
2. [What Will Be Deleted](#what-will-be-deleted)
3. [What Will Be Preserved](#what-will-be-preserved)
4. [Safety Precautions](#safety-precautions)
5. [Method 1: Django Management Command (Recommended)](#method-1-django-management-command-recommended)
6. [Method 2: SQL Queries](#method-2-sql-queries)
7. [Method 3: Manual File Deletion](#method-3-manual-file-deletion)
8. [Verification](#verification)
9. [Restoration](#restoration)

---

## Overview

The application has a built-in Django management command that safely deletes:
- All photo records from the database
- All person/face collections
- All person-photo associations
- All daily statistics
- All image files from storage
- FAISS face recognition index

After deletion, the app will behave as a fresh system ready to accept new uploads.

---

## What Will Be Deleted

### Database Records

| Table | Records Deleted | Effect |
|-------|----------------|--------|
| `Photo` | All photo metadata | All uploaded photos removed |
| `Person` | All person/face collections | All face collections removed |
| `PersonPhoto` | All person-photo associations | All face-to-photo links removed |
| `DailyStatistics` | All upload statistics | Statistics reset to zero |

### Files on Disk

| Location | Files Deleted |
|----------|--------------|
| `backend/media/images/` | All uploaded image files (*.jpg, *.png, etc.) |
| `backend/media/faces/` | All extracted face crops |
| `backend/media/covers/` | All collection cover images |
| `backend/faiss_index.bin` | FAISS similarity search index |
| `backend/faiss_id_map.npy` | FAISS ID mapping file |

---

## What Will Be Preserved

✅ **Database Schema**: All tables, columns, and constraints remain intact
✅ **Migrations**: All migration files unchanged
✅ **Application Code**: Frontend and backend logic untouched
✅ **API Contracts**: All endpoints continue to work (will return empty arrays)
✅ **UI Components**: Gallery, upload, events, face detection all functional
✅ **Configuration**: Settings, environment variables, and configs preserved
✅ **Dependencies**: No changes to packages or libraries

**Result**: The app will function exactly as before, but with zero images (like a fresh installation).

---

## Safety Precautions

### 1. Create a Backup FIRST

**CRITICAL**: Always create a backup before deletion!

```bash
# Navigate to backend directory
cd backend

# Run backup script
python backup_before_clear.py
```

This creates:
- PostgreSQL database dump (`photogallery_backup.sql`)
- Compressed media files archive (`media_backup.zip`)
- FAISS index backups (`faiss_index.bin`, `faiss_id_map.npy`)

Backup location: `backend/backups/backup_YYYY-MM-DD_HH-MM-SS/`

### 2. Stop Running Services

Before deletion, stop all services to avoid conflicts:

```bash
# Stop Django development server (Ctrl+C in terminal)
# Stop Celery workers (Ctrl+C in worker terminal)
# Stop Redis (if running)
```

### 3. Verify Database Connection

Ensure the database credentials in `.env` or environment variables are correct:

```env
DB_NAME=photogallery
DB_USER=postgres
DB_PASSWORD=your_password
DB_HOST=localhost
DB_PORT=5432
```

---

## Method 1: Django Management Command (Recommended)

### Why This Method?

✅ Safest and most reliable
✅ Built-in confirmation prompt
✅ Detailed progress output
✅ Handles all cleanup automatically
✅ Preserves `.gitkeep` files

### Steps

#### 1. Navigate to Backend Directory

```bash
cd D:\Gallery_VSCode\backend
```

#### 2. Activate Virtual Environment (if using)

```bash
# Windows
venv\Scripts\activate

# Linux/Mac
source venv/bin/activate
```

#### 3. Run the Command

**With confirmation prompt (safe):**

```bash
python manage.py clear_all_data
```

You'll see output like:

```
============================================================
WARNING: This will delete ALL data!
============================================================

Current Data:
   - Photos: 1234
   - Persons: 567
   - Person-Photo Mappings: 5678
   - Daily Statistics: 45

Media Files:
   - Image files: 1234
   - Face files: 567
   - Cover files: 123

FAISS Index: Found

============================================================

Are you sure you want to delete ALL data? (type "yes" to confirm):
```

Type `yes` and press Enter to proceed.

**Skip confirmation (use with caution):**

```bash
python manage.py clear_all_data --yes
```

#### 4. Verify Success

Upon completion, you'll see:

```
============================================================
SUCCESS: All data cleared successfully!
============================================================

Summary:
   - Database records deleted: 7524
   - Media files deleted: 1924
   - FAISS files deleted: 2

Database is now empty and ready for new uploads!
```

---

## Method 2: SQL Queries

### When to Use

- Direct database access
- No Django environment available
- Scripting/automation needs

### Prerequisites

- PostgreSQL client (`psql`) installed
- Database credentials

### Steps

#### 1. Connect to Database

```bash
psql -h localhost -U postgres -d photogallery
```

#### 2. Verify Current Data

```sql
-- Check record counts
SELECT 'Photos' as table_name, COUNT(*) as count FROM api_photo
UNION ALL
SELECT 'Persons', COUNT(*) FROM api_person
UNION ALL
SELECT 'PersonPhotos', COUNT(*) FROM api_personphoto
UNION ALL
SELECT 'DailyStatistics', COUNT(*) FROM api_dailystatistics;
```

#### 3. Delete All Records

```sql
-- Start transaction for safety
BEGIN;

-- Delete in correct order (respects foreign key constraints)
DELETE FROM api_personphoto;
DELETE FROM api_person;
DELETE FROM api_photo;
DELETE FROM api_dailystatistics;

-- Verify deletion
SELECT 'Photos' as table_name, COUNT(*) as count FROM api_photo
UNION ALL
SELECT 'Persons', COUNT(*) FROM api_person
UNION ALL
SELECT 'PersonPhotos', COUNT(*) FROM api_personphoto
UNION ALL
SELECT 'DailyStatistics', COUNT(*) FROM api_dailystatistics;

-- If everything looks good, commit
COMMIT;

-- If something is wrong, rollback instead
-- ROLLBACK;
```

#### 4. Reset Auto-Increment Sequences (Optional)

To reset person_number back to 1:

```sql
-- Reset the sequence for person_number
SELECT setval('api_person_id_seq', 1, false);
```

#### 5. Delete Files Manually

After SQL deletion, manually delete files:

```bash
# Navigate to backend directory
cd D:\Gallery_VSCode\backend

# Delete image files (Windows)
del /Q media\images\*.*
del /Q media\faces\*.*
del /Q media\covers\*.*

# Delete FAISS files
del faiss_index.bin
del faiss_id_map.npy

# Linux/Mac
# rm -f media/images/*
# rm -f media/faces/*
# rm -f media/covers/*
# rm -f faiss_index.bin faiss_id_map.npy
```

---

## Method 3: Manual File Deletion

### When to Use

- Testing file cleanup only
- Database already cleared

### Steps

#### Windows

```bash
cd D:\Gallery_VSCode\backend

# Delete image files
del /Q media\images\*.*
del /Q media\faces\*.*
del /Q media\covers\*.*

# Delete FAISS index
del faiss_index.bin
del faiss_id_map.npy
```

#### Linux/Mac

```bash
cd /path/to/backend

# Delete image files
rm -f media/images/*
rm -f media/faces/*
rm -f media/covers/*

# Delete FAISS index
rm -f faiss_index.bin
rm -f faiss_id_map.npy
```

**Note**: This only deletes files, not database records. Use Method 1 or 2 for complete cleanup.

---

## Verification

### 1. Check Database

```bash
python manage.py shell
```

```python
from api.models import Photo, Person, PersonPhoto, DailyStatistics

print(f"Photos: {Photo.objects.count()}")
print(f"Persons: {Person.objects.count()}")
print(f"PersonPhotos: {PersonPhoto.objects.count()}")
print(f"DailyStatistics: {DailyStatistics.objects.count()}")
```

Expected output:
```
Photos: 0
Persons: 0
PersonPhotos: 0
DailyStatistics: 0
```

### 2. Check Media Files

```bash
# Windows
dir backend\media\images
dir backend\media\faces
dir backend\media\covers

# Linux/Mac
ls -la backend/media/images/
ls -la backend/media/faces/
ls -la backend/media/covers/
```

Expected: Empty directories (or only `.gitkeep` files)

### 3. Check FAISS Index

```bash
# Windows
dir backend\faiss_index.bin
dir backend\faiss_id_map.npy

# Linux/Mac
ls -la backend/faiss_index.bin
ls -la backend/faiss_id_map.npy
```

Expected: Files not found

### 4. Test Application

1. Start Django server:
   ```bash
   python manage.py runserver
   ```

2. Open browser and navigate to `http://localhost:8000`

3. Verify:
   - ✅ Gallery page loads (shows empty state)
   - ✅ Upload page works (can select files)
   - ✅ Statistics page shows 0 counts
   - ✅ No errors in console

4. Upload a test image:
   - ✅ Upload succeeds
   - ✅ Face detection runs
   - ✅ Image appears in gallery
   - ✅ Collection created (if face detected)

---

## Restoration

If you need to restore from backup:

### 1. Restore Database

```bash
# Navigate to backup directory
cd backend/backups/backup_YYYY-MM-DD_HH-MM-SS

# Restore database
psql -h localhost -U postgres -d photogallery -f photogallery_backup.sql
```

### 2. Restore Media Files

```bash
# Extract media backup to backend/media/
unzip media_backup.zip -d ../../media/
```

### 3. Restore FAISS Index

```bash
# Copy FAISS files back to backend/
copy faiss_index.bin ..\..\faiss_index.bin
copy faiss_id_map.npy ..\..\faiss_id_map.npy

# Linux/Mac
# cp faiss_index.bin ../../
# cp faiss_id_map.npy ../../
```

### 4. Verify Restoration

```bash
cd ../../
python manage.py shell
```

```python
from api.models import Photo, Person, PersonPhoto, DailyStatistics

print(f"Photos: {Photo.objects.count()}")
print(f"Persons: {Person.objects.count()}")
print(f"PersonPhotos: {PersonPhoto.objects.count()}")
print(f"DailyStatistics: {DailyStatistics.objects.count()}")
```

---

## Quick Reference

### Command Cheat Sheet

| Action | Command |
|--------|---------|
| **Create backup** | `python backup_before_clear.py` |
| **Clear all data** | `python manage.py clear_all_data` |
| **Clear without prompt** | `python manage.py clear_all_data --yes` |
| **Check database** | `python manage.py shell` → `Photo.objects.count()` |
| **Restore database** | `psql -U postgres -d photogallery -f backup.sql` |

### File Locations

| Item | Path |
|------|------|
| **Images** | `backend/media/images/` |
| **Face crops** | `backend/media/faces/` |
| **Cover images** | `backend/media/covers/` |
| **FAISS index** | `backend/faiss_index.bin` |
| **FAISS ID map** | `backend/faiss_id_map.npy` |
| **Backups** | `backend/backups/` |
| **Clear command** | `backend/api/management/commands/clear_all_data.py` |

---

## Troubleshooting

### "Permission denied" when deleting files

**Windows**: Run terminal as Administrator
**Linux/Mac**: Use `sudo` or check file permissions

### "Database connection failed"

- Verify PostgreSQL is running
- Check `.env` file for correct credentials
- Test connection: `psql -U postgres -d photogallery`

### "pg_dump not found" when backing up

**Windows**: Add PostgreSQL bin directory to PATH
**Linux**: `sudo apt-get install postgresql-client`
**Mac**: `brew install postgresql`

### FAISS index errors after clearing

This is normal! The FAISS index will be automatically rebuilt on the first upload with face detection.

### Statistics page shows wrong counts

Clear browser cache or hard refresh (Ctrl+Shift+R)

---

## Summary

**Recommended workflow:**

1. ✅ **Backup**: `python backup_before_clear.py`
2. ✅ **Stop services**: Stop Django, Celery, Redis
3. ✅ **Clear data**: `python manage.py clear_all_data`
4. ✅ **Verify**: Check database and files are empty
5. ✅ **Test**: Upload a new image to confirm system works
6. ✅ **Keep backup**: Store backup safely for 30+ days

**After deletion:**
- Database: Empty (0 records)
- Storage: Empty (0 files)
- Schema: Intact ✅
- Code: Unchanged ✅
- Functionality: Working ✅

The application will behave as a fresh installation, ready to accept new uploads!
