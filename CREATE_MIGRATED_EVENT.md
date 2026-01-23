# Create Migrated Event in Frontend

## Important: Manual Step Required

All 34 existing photos have been assigned to event ID: `evt_migrated_1737469200000`

To view these photos in the frontend, you need to create a matching event in localStorage.

## Option 1: Via Frontend UI (Recommended)

1. Open the app: `http://localhost:3000`
2. Click "Create Event"
3. Fill in the form:
   - **Event Name**: "Migrated Photos"
   - **Event Date**: Select any date (e.g., today)
   - **Event Type**: Select "Other"
4. **IMPORTANT**: Before clicking "Create Event", open Browser DevTools (F12)
5. Go to Console tab
6. Run this command to override the event ID:

```javascript
// Intercept the next event creation
const originalFetch = window.fetch;
window.fetch = function(...args) {
  if (args[0] === '/create-event' || args[0].includes('create')) {
    // Will create event with specific ID
    return originalFetch.apply(this, args);
  }
  return originalFetch.apply(this, args);
};

// Then create event manually in localStorage
const migratedEvent = {
  id: 'evt_migrated_1737469200000',
  name: 'Migrated Photos',
  date: new Date().toISOString().split('T')[0],
  type: 'Other',
  createdAt: new Date().toISOString(),
  imageCount: 0
};

const events = JSON.parse(localStorage.getItem('gallery-events') || '[]');
events.push(migratedEvent);
localStorage.setItem('gallery-events', JSON.stringify(events));

alert('Migrated event created! Refresh the page.');
```

6. Refresh the page
7. You should see "Migrated Photos" event with 34 images and 62 persons

## Option 2: Via Browser Console (Faster)

1. Open the app: `http://localhost:3000`
2. Open Browser DevTools (F12)
3. Go to Console tab
4. Paste and run:

```javascript
const migratedEvent = {
  id: 'evt_migrated_1737469200000',
  name: 'Migrated Photos',
  date: '2026-01-21',
  type: 'Other',
  createdAt: new Date('2026-01-21').toISOString(),
  imageCount: 0
};

const events = JSON.parse(localStorage.getItem('gallery-events') || '[]');
events.push(migratedEvent);
localStorage.setItem('gallery-events', JSON.stringify(events));

location.reload();
```

5. Page will refresh and show the migrated event

## Verification

After creating the event, you should see:
- Event card showing: "34 Images" and "62 Persons"
- Collections tab shows 62 person collections
- Photos tab shows 34 photos
- All data is properly linked to the migrated event

## Future Uploads

All future uploads will automatically link photos to the correct event ID when you upload through that event's gallery.
