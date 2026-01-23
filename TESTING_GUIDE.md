# Event Isolation Testing Guide

## Prerequisites
✅ Backend running: http://localhost:8000
✅ Frontend running: http://localhost:3000
✅ 34 photos migrated to: `evt_migrated_1737469200000`
✅ 62 persons in database

---

## Quick Test (5 minutes)

### Method 1: Using Test Helper (Easiest)

1. **Open the test helper**:
   ```
   Open: D:\Gallery_VSCode\test_event_isolation.html
   ```

2. **Click buttons in order**:
   - Step 1: "Create Migrated Event"
   - Step 2: "Check Migrated Event Stats" → Should show 34 photos, ~62 persons
   - Step 3: "Create Test Event"
   - Step 3: "Check Test Event Stats" → Should show 0 photos, 0 persons
   - Step 4: "Verify Isolation" → All tests should PASS

3. **Open the app**:
   - Click "Open App in New Tab"
   - You should see both events on "My Events" page

### Method 2: Using Browser Console

1. **Open app**: http://localhost:3000

2. **Open DevTools**: Press F12

3. **Go to Console tab**

4. **Run this script**:
```javascript
// Create migrated event
const migratedEvent = {
  id: 'evt_migrated_1737469200000',
  name: 'Migrated Photos',
  date: '2026-01-21',
  type: 'Other',
  createdAt: new Date('2026-01-21').toISOString(),
  imageCount: 0
};

// Create test event
const testEvent = {
  id: 'evt_test_' + Date.now(),
  name: 'Test Event Isolation',
  date: new Date().toISOString().split('T')[0],
  type: 'Wedding',
  createdAt: new Date().toISOString(),
  imageCount: 0
};

// Add to localStorage
const events = JSON.parse(localStorage.getItem('gallery-events') || '[]');
events.push(migratedEvent);
events.push(testEvent);
localStorage.setItem('gallery-events', JSON.stringify(events));

console.log('✓ Events created!');
console.log('Migrated Event ID:', migratedEvent.id);
console.log('Test Event ID:', testEvent.id);

location.reload();
```

5. **Page will reload** and show both events

---

## Detailed Test (15 minutes)

### Test 1: Verify Migrated Event

1. **Check My Events page**:
   - You should see "Migrated Photos" card
   - Card should show: "34 Images" and "~62 Persons"

2. **Open Migrated Photos**:
   - Click on the event card
   - You'll land on Upload tab

3. **Check Collections tab**:
   - Click "Collections" tab
   - Should see ~62 person avatars
   - Each person should have photos

4. **Open a collection**:
   - Click any person avatar
   - Should see 1-3 photos of that person
   - All photos should display correctly

5. **Check Photos tab**:
   - Go back and click "Photos" tab
   - Should see all 34 photos in masonry grid
   - All images should load

### Test 2: Verify Test Event (Empty)

1. **Go to My Events**: Click sidebar → My Events

2. **Check Test Event card**:
   - Should show "Test Event Isolation"
   - Should show: "0 Images" and "0 Persons"

3. **Open Test Event**:
   - Click on test event card

4. **Check Collections tab**:
   - Should show: "No persons found"
   - Should NOT show the 62 persons from migrated event

5. **Check Photos tab**:
   - Should show: "No photos found"
   - Should NOT show the 34 photos from migrated event

**✅ ISOLATION VERIFIED**: Test event is completely empty and separate from migrated event!

### Test 3: Upload to Test Event

1. **Stay in Test Event**

2. **Go to Upload tab**

3. **Select 3-5 test images** with faces

4. **Upload images**:
   - Watch progress bars
   - Should see "Upload Complete!"
   - Should show success count

5. **Go to My Events**:
   - Test Event should now show: "5 Images" (or however many you uploaded)
   - Migrated Event should STILL show: "34 Images" (unchanged!)

6. **Open Test Event → Collections**:
   - Should see NEW persons from your upload
   - Should NOT see persons from Migrated Event

7. **Open Migrated Event → Collections**:
   - Should STILL see original 62 persons
   - Should NOT see persons from Test Event

**✅ ISOLATION VERIFIED**: Each event maintains its own photos and persons!

### Test 4: Cross-Event Person Recognition

If you have a photo of a known person from Migrated Event:

1. **Upload same person to Test Event**

2. **Check person_number**:
   - Should be same person_number in both events
   - Proves global identity recognition works

3. **Check photos in each event**:
   - Migrated Event: Shows only migrated photos of that person
   - Test Event: Shows only newly uploaded photos of that person

**✅ CROSS-EVENT RECOGNITION VERIFIED**: Same person, different photo sets per event!

---

## API Testing (Advanced)

### Test Backend Endpoints Directly

```bash
# Migrated event statistics
curl http://localhost:8000/api/events/evt_migrated_1737469200000/statistics/ | jq .
# Expected: {"event_id": "...", "total_photos": 34, "total_persons": 62}

# Test event statistics (replace with your test event ID)
curl http://localhost:8000/api/events/evt_test_1737470000000/statistics/ | jq .
# Expected: {"event_id": "...", "total_photos": 0, "total_persons": 0}

# Photos filtered by migrated event
curl "http://localhost:8000/api/photos/?event_id=evt_migrated_1737469200000" | jq '. | length'
# Expected: 34

# Persons filtered by migrated event
curl "http://localhost:8000/api/persons/?event_id=evt_migrated_1737469200000" | jq '. | length'
# Expected: 62

# Photos filtered by test event (before upload)
curl "http://localhost:8000/api/photos/?event_id=evt_test_1737470000000" | jq '. | length'
# Expected: 0

# Persons filtered by test event (before upload)
curl "http://localhost:8000/api/persons/?event_id=evt_test_1737470000000" | jq '. | length'
# Expected: 0
```

---

## Expected Results Summary

| Test | Expected Result | Verification |
|------|----------------|--------------|
| Migrated Event Stats | 34 images, ~62 persons | ✓ Backend calculates from DB |
| Test Event Stats (empty) | 0 images, 0 persons | ✓ Shows empty state |
| Migrated Collections | Shows 62 persons | ✓ Filtered by event_id |
| Test Collections (empty) | Shows 0 persons | ✓ No cross-contamination |
| Upload to Test Event | Adds only to Test Event | ✓ Doesn't affect Migrated Event |
| My Events page | Shows correct counts per event | ✓ No localStorage, uses backend |
| Person in both events | Same person_number | ✓ Global identity |
| Photos per event/person | Different sets per event | ✓ Event-scoped filtering |

---

## Troubleshooting

### Events don't show on My Events page
- **Solution**: Clear localStorage and recreate events
```javascript
localStorage.removeItem('gallery-events');
location.reload();
// Then run the event creation script again
```

### Stats show 0 for migrated event
- **Check backend**: Run `curl http://localhost:8000/api/events/evt_migrated_1737469200000/statistics/`
- **Check photos**: Run `curl http://localhost:8000/api/photos/ | jq '. | length'`
- **Verify event_id**: Run backend script to check photo.event_id values

### Collections show wrong persons
- **Check browser console** for errors
- **Verify URL** includes correct event_id parameter
- **Check Network tab** in DevTools to see API requests

### Upload fails
- **Check backend logs** in terminal
- **Check browser console** for error details
- **Verify event_id** is being sent in FormData

---

## Success Criteria

✅ Migrated event shows 34 photos and ~62 persons
✅ Test event starts empty (0/0)
✅ Collections in each event are different
✅ Photos in each event are different
✅ Uploading to Test Event doesn't affect Migrated Event
✅ Same person recognized across events (same ID)
✅ Person photos filtered correctly per event
✅ Backend statistics are real-time and accurate
✅ No localStorage image counting
✅ Event isolation is complete

---

## Quick Verification Checklist

After setup, verify these in 2 minutes:

- [ ] Open app → See 2 events on My Events page
- [ ] Migrated Photos card: "34 Images, ~62 Persons"
- [ ] Test Event card: "0 Images, 0 Persons"
- [ ] Open Migrated → Collections → See ~62 persons
- [ ] Open Test Event → Collections → See "No persons found"
- [ ] Upload 1 photo to Test Event → Success
- [ ] Go to My Events → Test Event now shows "1 Image"
- [ ] Migrated Event STILL shows "34 Images" (unchanged)

**If all checkmarks pass**: ✅ Event isolation works perfectly!

---

**Ready to test!** Start with the Quick Test method, then move to Detailed Test if you want to verify everything thoroughly.
