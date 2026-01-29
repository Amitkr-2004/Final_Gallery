# Time Scheduler Testing Checklist

## Pre-Testing Setup

- [ ] Run database migration: `python manage.py migrate`
- [ ] Restart Django server
- [ ] Restart Celery worker
- [ ] Restart Celery beat
- [ ] Clear browser cache

## Basic Functionality Tests

### 1. Folder Path Validation
- [ ] Enter valid absolute path → Should accept
- [ ] Enter non-existent path → Should show error
- [ ] Enter file path (not directory) → Should show error
- [ ] Enter path without permissions → Should show error
- [ ] Enter relative path → Should convert to absolute

### 2. Job Scheduling
- [ ] Schedule job with future time → Should create job
- [ ] Schedule job with past time → Should show error
- [ ] Schedule job without folder path → Should show error
- [ ] Schedule job without time → Should show error

### 3. Job Execution
- [ ] Job starts at scheduled time → Status: Pending → Running
- [ ] Progress updates during execution → Images processed count increases
- [ ] Job completes successfully → Status: Completed
- [ ] Event created: "Student Images" with timestamp
- [ ] Photos uploaded to media directory
- [ ] Face detection triggered for each photo

### 4. Frontend Display
- [ ] Current folder path shown below input
- [ ] Job status badge updates (Pending/Running/Completed/Failed)
- [ ] Progress bar shows during execution
- [ ] Completion stats displayed (images processed, event ID)
- [ ] Error log shown if job fails

### 5. Edge Cases
- [ ] Empty folder → Job fails with "No images found"
- [ ] Folder with only non-image files → Job fails
- [ ] Very large folder (1000+ images) → Processes successfully
- [ ] Folder with subdirectories → All images scanned recursively
- [ ] Schedule same folder twice → Duplicates skipped

### 6. Duplicate Handling
- [ ] Upload same images twice → Second run skips duplicates
- [ ] `duplicates_skipped` counter increments
- [ ] Only new images are processed
- [ ] Existing photos not re-processed

### 7. Integration Tests
- [ ] Check "My Events" page → New event appears
- [ ] Check Collections page → New face collections created
- [ ] Check Statistics page → Counts updated
- [ ] Check event gallery → Images visible

### 8. Error Handling
- [ ] Folder deleted after scheduling → Job fails gracefully
- [ ] Permission changed after scheduling → Job fails with clear error
- [ ] Corrupted image file → Skipped, job continues
- [ ] Celery not running → Job stays pending

## Performance Tests

- [ ] 10 images → Processes in <30 seconds
- [ ] 100 images → Processes successfully
- [ ] 1000+ images → Processes successfully (may take longer)
- [ ] No memory leaks during processing
- [ ] Temp files cleaned up after execution

## Cleanup
- [ ] Test job cancellation → Job cancelled successfully
- [ ] Temp directory empty after execution
- [ ] No orphaned database records

## Notes

**Test Environment:**
- OS: Windows / Linux / macOS
- Python Version: ___
- Django Version: ___
- Celery Version: ___

**Test Results:**
- Date: ___
- Tester: ___
- Status: Pass / Fail
- Issues Found: ___
