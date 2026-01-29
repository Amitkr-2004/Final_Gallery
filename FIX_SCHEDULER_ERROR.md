# Fix: "Failed to create scheduled job" Error

## Problem
When trying to schedule a job with a local folder path like `C:\Users\AMIT\Downloads\Images`, you get the error: **"Failed to create scheduled job"**

## Root Cause
The database migration that renames the `drive_link` column to `folder_path` hasn't been applied yet. The database still has the old column name, but the code expects the new name.

---

## Solution: Apply the Migration

### Option 1: Automated Fix (Recommended) ✅

**For Windows:**

1. Open Command Prompt or PowerShell
2. Navigate to the backend folder:
   ```cmd
   cd D:\Gallery_VSCode\backend
   ```

3. Activate your virtual environment:
   ```cmd
   venv\Scripts\activate
   ```

4. Run the fix script:
   ```cmd
   FIX_MIGRATION.bat
   ```

   This will:
   - Check your database state
   - Apply the migration if needed
   - Verify the migration was successful

**For Linux/Mac:**

1. Navigate to the backend folder:
   ```bash
   cd D:\Gallery_VSCode\backend
   ```

2. Activate your virtual environment:
   ```bash
   source venv/bin/activate
   ```

3. Run the migration helper:
   ```bash
   python apply_migration.py
   ```

---

### Option 2: Manual Migration

If the automated script doesn't work, manually run the migration:

1. **Activate virtual environment:**
   ```cmd
   cd D:\Gallery_VSCode\backend
   venv\Scripts\activate
   ```

2. **Check migration status:**
   ```cmd
   python manage.py showmigrations api
   ```

   Look for migration `0008_rename_drivelink_to_folderpath`. If it's unchecked `[ ]`, it needs to be applied.

3. **Apply the migration:**
   ```cmd
   python manage.py migrate api 0008
   ```

4. **Verify it worked:**
   ```cmd
   python manage.py showmigrations api
   ```

   The migration should now be checked `[X]`.

---

## After Applying Migration

1. **Restart Django server:**
   - Stop the server (Ctrl+C)
   - Restart: `python manage.py runserver`

2. **Clear browser cache:**
   - Chrome/Edge: Ctrl+Shift+Delete → Clear cache
   - Or just do a hard refresh: Ctrl+Shift+R

3. **Try scheduling again:**
   - Go to: http://localhost:3000/time-scheduler
   - Enter folder path: `C:\Users\AMIT\Downloads\Images`
   - Select a future time
   - Click "Save Schedule"

---

## Verify It's Fixed

After applying the migration, the error message should now be more detailed if something else is wrong.

### If you still get an error:

The updated error message will show:
```json
{
  "error": "Failed to create scheduled job: <actual error>",
  "detail": "<error details>",
  "type": "<error type>"
}
```

This will help identify the exact problem:

#### Common Issues After Migration:

1. **Folder doesn't exist:**
   ```
   "Folder path does not exist: C:\Users\AMIT\Downloads\Images"
   ```
   **Fix:** Check the path is correct and the folder exists.

2. **Permission denied:**
   ```
   "Folder is not readable (permission denied)"
   ```
   **Fix:** Ensure the backend server has permission to read the folder.

3. **Not a directory:**
   ```
   "Path must be a directory, not a file"
   ```
   **Fix:** Make sure you're providing a folder path, not a file path.

4. **Time validation error:**
   ```
   "Scheduled time must be in the future"
   ```
   **Fix:** Select a time at least 1 minute in the future.

---

## Check Backend Logs

For detailed error information, check the Django console output where you ran `python manage.py runserver`.

Look for lines starting with:
```
ERROR: Error creating scheduled job: ...
```

---

## Test Path

To verify your folder path is correct, try this in Command Prompt:

```cmd
dir "C:\Users\AMIT\Downloads\Images"
```

If you see files listed, the path is correct.

---

## Still Having Issues?

1. **Check if Celery is running** (for job execution):
   ```cmd
   celery -A config worker -l info
   celery -A config beat -l info
   ```

2. **Check database file exists:**
   ```cmd
   dir D:\Gallery_VSCode\backend\db.sqlite3
   ```

3. **Verify model changes:**
   - Open `backend/api/models.py`
   - Line 210 should say `folder_path = models.CharField(...)`
   - NOT `drive_link = models.URLField(...)`

4. **Check serializer:**
   - Open `backend/api/serializers.py`
   - Line 66 should say `'folder_path'` in the fields list
   - NOT `'drive_link'`

---

## Quick Verification Checklist

- [ ] Virtual environment activated
- [ ] Migration 0008 applied (check with `python manage.py showmigrations`)
- [ ] Django server restarted
- [ ] Browser cache cleared
- [ ] Folder path exists and is readable
- [ ] Time is in the future
- [ ] Error message is now detailed (if still failing)

---

## Summary

**The main issue:** Database column name mismatch.

**The fix:** Run the migration to rename `drive_link` → `folder_path`.

**Commands:**
```cmd
cd D:\Gallery_VSCode\backend
venv\Scripts\activate
python manage.py migrate api 0008
python manage.py runserver
```

Then try scheduling again with a valid folder path!
