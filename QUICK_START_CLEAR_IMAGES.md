# Quick Start: Clear All Images

## TL;DR - Run This Command

### Windows

```bash
cd D:\Gallery_VSCode\backend
safe_clear_all.bat
```

### Linux/Mac

```bash
cd /path/to/Gallery_VSCode/backend
./safe_clear_all.sh
```

This will:
1. ✅ Create a backup automatically
2. ✅ Ask for confirmation before deletion
3. ✅ Delete all images and data
4. ✅ Verify the cleanup

---

## Manual Method (Step by Step)

If you prefer to run commands manually:

### 1. Create Backup (CRITICAL - Do this first!)

```bash
cd backend
python backup_before_clear.py
```

**Backup Location**: `backend/backups/backup_YYYY-MM-DD_HH-MM-SS/`

### 2. Clear All Data

**With confirmation prompt:**
```bash
python manage.py clear_all_data
```

**Skip confirmation (use with caution):**
```bash
python manage.py clear_all_data --yes
```

### 3. Verify

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

All should show `0`.

---

## What Gets Deleted

### Database Records
- ❌ All photos (Photo table)
- ❌ All persons/collections (Person table)
- ❌ All person-photo associations (PersonPhoto table)
- ❌ All daily statistics (DailyStatistics table)

### Files
- ❌ All images in `backend/media/images/`
- ❌ All face crops in `backend/media/faces/`
- ❌ All cover images in `backend/media/covers/`
- ❌ FAISS index files (`faiss_index.bin`, `faiss_id_map.npy`)

---

## What Stays Intact

✅ **Database Schema**: All tables, columns, indexes
✅ **Migrations**: All migration files
✅ **Code**: Frontend and backend logic unchanged
✅ **API**: All endpoints continue to work
✅ **UI**: Gallery, upload, events, face detection
✅ **Configuration**: All settings preserved

---

## After Deletion

The app will behave as a **fresh installation**:
- Gallery shows empty state
- Upload works normally
- Face detection works normally
- Statistics start from zero
- Collections start from 1, 2, 3...

---

## Need More Details?

Read the comprehensive guide: [CLEAR_ALL_IMAGES_GUIDE.md](CLEAR_ALL_IMAGES_GUIDE.md)

---

## Emergency Restore

If you need to undo the deletion:

```bash
cd backend/backups/backup_YYYY-MM-DD_HH-MM-SS

# Restore database
psql -U postgres -d photogallery -f photogallery_backup.sql

# Restore media files
unzip media_backup.zip -d ../../media/

# Restore FAISS index
cp faiss_index.bin ../../
cp faiss_id_map.npy ../../
```

---

## Safety Checklist

Before running the clear command:

- [ ] Created a backup
- [ ] Stopped Django server
- [ ] Stopped Celery workers
- [ ] Verified backup was successful
- [ ] Double-checked this is what you want

---

## File Reference

| File | Purpose |
|------|---------|
| `safe_clear_all.bat` | Windows automated script (backup + clear) |
| `safe_clear_all.sh` | Linux/Mac automated script (backup + clear) |
| `backup_before_clear.py` | Backup utility script |
| `manage.py clear_all_data` | Django command to clear all data |
| `CLEAR_ALL_IMAGES_GUIDE.md` | Comprehensive guide with all methods |
| `QUICK_START_CLEAR_IMAGES.md` | This quick reference |

---

## Questions?

**Q: Is this reversible?**
A: Yes, if you created a backup first. Restore from `backend/backups/`.

**Q: Will this break my app?**
A: No. The app will work exactly as before, just with zero images.

**Q: Do I need to run migrations after?**
A: No. The database schema is unchanged.

**Q: What about uploaded images in the future?**
A: Upload will work normally. New images will be stored and face detection will run.

**Q: Will person numbers restart from 1?**
A: Yes. The next person detected will be "Person 1".

**Q: Is my code affected?**
A: No. Zero code changes. All frontend/backend logic is preserved.
