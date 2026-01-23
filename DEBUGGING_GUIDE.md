# Debugging Guide - Upload & Collections Issues

## Issues Fixed

### 1. ✅ Collections Page: `data.filter is not a function`

**Root Cause**: API response format changed from array to object with pagination.

**Old Response**:
```json
[
  {"id": 1, "person_number": 1},
  {"id": 2, "person_number": 2}
]
```

**New Response**:
```json
{
  "results": [...],
  "pagination": {...}
}
```

**Fix**: Updated `Collections.js` to handle both formats with defensive checks.

**Location**: `frontend/src/components/gallery/Collections.js:43-57`

---

### 2. ✅ Phantom Image Uploads

**Root Cause**: No backend validation for multiple files in single request.

**Fix**: Added strict validation to reject requests with multiple files.

**Location**: `backend/api/views.py:49-94`

**New Validations**:
- ✅ Rejects requests with 0 files
- ✅ Rejects requests with > 1 file
- ✅ Validates 'image' field name
- ✅ Logs all file operations

---

## How to Debug Upload Issues

### Step 1: Check Browser Console

**Before Upload**:
```
[FILE SELECT] Mode: files, Files received: 3
[FILE SELECT] Valid image files: 3
[FILE SELECT] File names: ["photo1.jpg", "photo2.jpg", "photo3.jpg"]
[FILE SELECT] Inputs cleared, selected files set to 3 items
```

**During Upload**:
```
=== UPLOAD START ===
Total files to upload: 3
File names: ["photo1.jpg", "photo2.jpg", "photo3.jpg"]

[1/3] Uploading: photo1.jpg
  FormData entry: image = photo1.jpg
  Response status: 201
  Success! Photo ID: 612, Task ID: abc123...

[2/3] Uploading: photo2.jpg
  FormData entry: image = photo2.jpg
  Response status: 201
  Success! Photo ID: 613, Task ID: def456...

[3/3] Uploading: photo3.jpg
  FormData entry: image = photo3.jpg
  Response status: 201
  Success! Photo ID: 614, Task ID: ghi789...

=== UPLOAD COMPLETE ===
Results: {total: 3, success: 3, failed: 0}
```

**What to Look For**:
- ✅ Each file has exactly ONE FormData entry
- ✅ Each upload gets unique photo_id and task_id
- ❌ If you see multiple FormData entries → PROBLEM
- ❌ If same photo_id appears twice → Backend duplicate detection working

---

### Step 2: Check Django Server Logs

**Terminal where Django is running**:

**Good Upload**:
```
[INFO] [UPLOAD] Received 1 file(s) in request
[INFO] [UPLOAD] Processing single file: photo1.jpg (2458234 bytes)
[INFO] [UPLOAD] Created new photo_id=612, hash=2d817543..., event_id=test_event
[INFO] [UPLOAD] Enqueued task abc123... for photo_id=612
[INFO] "POST /api/upload/ HTTP/1.1" 201 342
```

**Bad Upload (Multiple Files)**:
```
[INFO] [UPLOAD] Received 3 file(s) in request
[WARNING] [UPLOAD] Multiple files rejected: ['image', 'image', 'image']
[INFO] "POST /api/upload/ HTTP/1.1" 400 150
```

**What to Look For**:
- ✅ "Received 1 file(s)" for each upload
- ✅ Unique photo_id for each file
- ❌ "Received N file(s)" where N > 1 → Frontend sending multiple files
- ❌ "Multiple files rejected" → Backend correctly blocking

---

### Step 3: Check Celery Worker Logs

**Terminal where Celery is running**:

```
[INFO] Task api.tasks.process_photo[abc123...] received
[INFO] [Task abc123...] Starting processing for photo 612
[INFO] [Task abc123...] Generating thumbnails for photo 612
[INFO] [Task abc123...] Thumbnails created: {'small': '...', 'medium': '...'}
[INFO] [Task abc123...] Running face detection for photo 612
[INFO] [Task abc123...] Detected and matched 1 faces
[INFO] [Task abc123...] Successfully completed processing photo 612
```

**What to Look For**:
- ✅ Each task processes one photo_id
- ✅ Thumbnails generated successfully
- ❌ Multiple tasks with same photo_id → Duplicate upload triggered

---

### Step 4: Check Database

```bash
cd backend
.\venv\Scripts\activate
python manage.py shell
```

```python
from api.models import Photo
from django.db.models import Count

# Count photos by event_id
Photo.objects.values('event_id').annotate(count=Count('id')).order_by('-count')

# Recent uploads
Photo.objects.order_by('-uploaded_at')[:10].values('id', 'file_path', 'image_hash', 'event_id', 'uploaded_at')

# Check for duplicate hashes
Photo.objects.values('image_hash').annotate(count=Count('id')).filter(count__gt=1)

# Photos by status
Photo.objects.values('status').annotate(count=Count('id'))
```

**Expected Results**:
- Each unique image should have ONE Photo record
- Duplicate uploads of same image should have same `image_hash`
- All recent photos should have `status='completed'`

---

## How to Test for Phantom Uploads

### Test 1: Single File Upload

1. Open Upload page
2. Click "Select Files"
3. Choose 1 image
4. Check console: Should show "Files received: 1"
5. Click Upload
6. Check console: Should show exactly 1 upload
7. Check Django logs: "Received 1 file(s) in request"

**Expected**: 1 photo created

---

### Test 2: Multiple Files Upload

1. Open Upload page
2. Click "Select Files"
3. Choose 5 images
4. Check console: Should show "Files received: 5"
5. Click Upload
6. Check console: Should show 5 separate uploads (1/5, 2/5, etc.)
7. Check Django logs: 5 separate "Received 1 file(s)" messages

**Expected**: 5 photos created

---

### Test 3: Folder Upload

1. Open Upload page
2. Click "Select Folder"
3. Choose folder with 10 images
4. Check console: Should show "Files received: 10"
5. Click Upload
6. Check console: Should show 10 separate uploads
7. Check Django logs: 10 separate "Received 1 file(s)" messages

**Expected**: 10 photos created, NO extra photos

---

### Test 4: Duplicate Upload (Same File Twice)

1. Upload photo1.jpg → Note photo_id (e.g., 612)
2. Upload photo1.jpg again
3. Check response: Should return same photo_id (612)
4. Check Django logs: "Photo already exists (duplicate not counted)"

**Expected**: Same photo_id, no new photo created

---

### Test 5: Sequential Uploads

1. Upload 3 files
2. Wait for completion
3. Upload 3 different files
4. Check console: Second batch should start fresh
5. Check Django logs: Each upload should be independent

**Expected**: 6 total photos, no mixing between batches

---

## Common Issues & Solutions

### Issue: Backend receives multiple files

**Symptom**: Django logs show "Received N file(s)" where N > 1

**Possible Causes**:
1. Browser bug appending files
2. FormData being reused (should not happen with current code)
3. Multiple forms submitting simultaneously

**Solution**:
- Check browser console for FormData validation
- Look for error: "Invalid FormData: expected 1 file, found N"
- This indicates frontend issue

**Backend Protection**: ✅ Now rejects multiple files with 400 error

---

### Issue: Same photo uploaded multiple times

**Symptom**: Same filename appears in upload results multiple times

**Possible Causes**:
1. User selected same file multiple times (e.g., from different folders)
2. File input not clearing properly

**Solution**:
- Check console: File selection logs should show unique files
- Check file paths: Same file from different folders will have different paths
- Backend will detect same image_hash and return existing photo

**Expected Behavior**: ✅ Duplicate hash returns existing photo_id

---

### Issue: Collections page shows error

**Symptom**: "Error: data.filter is not a function"

**Root Cause**: Old frontend code expecting array, but getting object

**Solution**: ✅ Fixed in Collections.js (now handles both formats)

**Verify Fix**:
1. Open Collections page
2. Check browser console: No errors
3. Collections should load normally

---

### Issue: Photos not appearing after upload

**Possible Causes**:
1. Celery worker not running
2. Redis not running
3. Processing failed

**Check**:
```bash
# 1. Check Celery worker is running
# Terminal 2 should show: "celery@HOSTNAME ready"

# 2. Check Redis is running
docker ps | grep redis

# 3. Check photo status
# In Django shell:
Photo.objects.filter(status='failed').count()
```

**Solution**:
- If Celery stopped: Restart with `celery -A config worker --loglevel=info --pool=solo`
- If Redis stopped: `docker start gallery_redis`
- If status=failed: Check Celery logs for error details

---

## Network Tab Debugging

### Check Upload Request

1. Open DevTools → Network tab
2. Upload a file
3. Find POST request to `/api/upload/`
4. Click on it

**Request Headers**:
```
Content-Type: multipart/form-data; boundary=----WebKitFormBoundary...
```

**Request Payload** (Form Data):
```
image: (binary)
```

**Should see**:
- ✅ Exactly ONE file in Form Data
- ✅ Field name: "image"
- ❌ Multiple "image" entries → PROBLEM

**Response**:
```json
{
  "photo_id": 612,
  "message": "Photo uploaded successfully and queued for processing",
  "status": "pending",
  "task_id": "abc123..."
}
```

---

## Validation Checklist

Before reporting phantom upload issue:

- [ ] Check browser console logs (file selection)
- [ ] Check browser console logs (upload process)
- [ ] Check FormData validation (should see 1 entry per upload)
- [ ] Check Django server logs (should see "Received 1 file(s)")
- [ ] Check Celery worker logs (each task processes 1 photo)
- [ ] Check database for duplicate photo_ids
- [ ] Check if duplicate hashes are being detected correctly
- [ ] Verify Redis is running
- [ ] Verify Celery worker is running
- [ ] Clear browser cache and retry

---

## Performance Monitoring

### Expected Upload Times

**Single File**:
- Frontend selection: < 100ms
- Network upload: 100-500ms (depends on file size)
- Backend processing: < 200ms
- Total: < 1 second

**Background Processing** (async):
- Thumbnail generation: 0.5-1 second
- Face detection: 1-2 seconds per face
- Total: 2-5 seconds per photo

### Check Upload Performance

```javascript
// In browser console during upload:
console.time('upload');
// ... upload happens ...
console.timeEnd('upload');
```

**Good**: < 1 second per file
**Slow**: > 3 seconds → Check network, file size, or backend logs

---

## Emergency Reset

If uploads are completely broken:

```bash
# 1. Stop all services
# Ctrl+C in Django terminal
# Ctrl+C in Celery terminal
docker stop gallery_redis

# 2. Clear browser cache
# DevTools → Application → Clear storage → Clear site data

# 3. Restart services
docker start gallery_redis
# Terminal 1: Start Django
cd backend
.\venv\Scripts\activate
python manage.py runserver

# Terminal 2: Start Celery
cd backend
.\venv\Scripts\activate
celery -A config worker --loglevel=info --pool=solo

# 4. Hard refresh frontend
# Ctrl+Shift+R (or Cmd+Shift+R on Mac)
```

---

## Success Indicators

**Upload Working Correctly**:
- ✅ Each file shows in console logs
- ✅ FormData has exactly 1 entry
- ✅ Django logs "Received 1 file(s)"
- ✅ Each upload gets unique photo_id
- ✅ Celery processes each task
- ✅ Collections page loads without errors
- ✅ No phantom photos created

**Collections Working Correctly**:
- ✅ Page loads without JavaScript errors
- ✅ Persons display in grid
- ✅ No "data.filter is not a function" error
- ✅ Pagination works (if > 30 persons)

---

## Contact Points for Issues

If issues persist after following this guide:

1. **Check console errors**: Look for red errors in DevTools console
2. **Check Django errors**: Look for tracebacks in Django terminal
3. **Check Celery errors**: Look for task failures in Celery terminal
4. **Check Redis**: `docker logs gallery_redis`
5. **Database check**: Use Django shell to inspect Photo records

All validation and logging has been added to help pinpoint the exact failure point!
