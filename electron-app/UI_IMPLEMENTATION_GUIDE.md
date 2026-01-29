# UI Implementation Guide - Task #8

## Overview

Task #8 implements a complete React-based user interface for the Image Processor application. The UI provides an intuitive interface for managing downloads, processing images, browsing the gallery, and managing persons/faces.

---

## What Has Been Implemented

### ✅ Core Structure

#### 1. **Application Shell**
- `src/renderer/App.jsx` - Main app with React Router
- `src/renderer/index.html` - HTML entry point
- `src/renderer/layouts/MainLayout.jsx` - Sidebar navigation layout
- `src/renderer/styles/global.css` - Design system and theme

#### 2. **Reusable Components**
- `Button.jsx` - Button with variants (primary, secondary, success, warning, error, ghost, text)
- `Card.jsx` - Content container with header/body/footer
- `StatusCard.jsx` - Stat display card with icon, label, value, trend
- `ProgressBar.jsx` - Progress indicator with percentage

#### 3. **Pages**
- `Dashboard.jsx` - Overview with stats and quick actions
- `Downloads.jsx` - Download management with real-time progress
- `Processing.jsx` - Processing control with status monitoring
- `Gallery.jsx` - Image browser (placeholder structure)
- `People.jsx` - Person management (placeholder structure)
- `Storage.jsx` - Storage management and cleanup
- `Settings.jsx` - Configuration viewer

### ✅ Features Implemented

#### Real-Time Updates
- Event listeners for download progress
- Event listeners for processing progress
- Automatic UI updates via electronAPI events

#### Statistics Dashboard
- Total images, processed images, faces detected
- Storage usage with visual indicators
- System health status
- Quick action buttons

#### Download Manager
- Start/Pause/Resume/Cancel controls
- Real-time progress with speed indicator
- Download statistics
- Failed downloads tracking

#### Processing Manager
- Start/Pause/Resume/Cancel controls
- Real-time queue status
- Processing statistics
- Face detection info

#### Storage Management
- Disk space monitoring
- Cleanup actions
- Storage breakdown by category
- Low space warnings

#### Settings Viewer
- Display all configuration
- Storage path management
- System information
- About section

---

## Design System

### Color Palette
```css
Primary: #3b82f6 (Blue)
Success: #10b981 (Green)
Warning: #f59e0b (Orange)
Error: #ef4444 (Red)
Info: #3b82f6 (Blue)

Background:
- Primary: #ffffff (White)
- Secondary: #f9fafb (Light Gray)
- Tertiary: #f3f4f6 (Gray)

Text:
- Primary: #111827 (Dark Gray)
- Secondary: #6b7280 (Gray)
- Tertiary: #9ca3af (Light Gray)

Sidebar: #1f2937 (Dark Gray)
```

### Typography
```css
Font Family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto'
Base Size: 16px
Sizes: xs(12px), sm(14px), base(16px), lg(18px), xl(20px), 2xl(24px), 3xl(30px)
Weights: normal(400), medium(500), semibold(600), bold(700)
```

### Spacing
```css
xs: 4px
sm: 8px
md: 16px
lg: 24px
xl: 32px
2xl: 48px
```

### Border Radius
```css
sm: 4px
md: 8px
lg: 12px
xl: 16px
full: 9999px (circle)
```

---

## What Needs To Be Completed

### 1. **Gallery Page Enhancement**

**Current State:** Placeholder structure only

**TODO:**
```jsx
// Implement image grid with thumbnails
- Fetch images from electronAPI.database.getImagesByStatus('completed')
- Display image thumbnails in a responsive grid
- Implement lightbox for full-size viewing
- Show face detection overlays on images
- Add filtering by event, date, person
- Add sorting options
- Implement infinite scroll or pagination
```

**API Usage:**
```javascript
// Get images
const images = await window.electronAPI.database.getImagesByStatus('completed', {
  limit: 100,
  offset: 0
});

// Get faces for image
const faces = await window.electronAPI.processing.getFaces(imageId);

// Display face bounding boxes as overlays
faces.forEach(face => {
  const { x, y, width, height } = face.bounding_box;
  // Draw rectangle over face region
});
```

### 2. **People Page Enhancement**

**Current State:** Loads persons and unassigned faces, but no UI for management

**TODO:**
```jsx
// Person Management UI
- Display person cards with face thumbnails
- Add "Create Person" modal with name input
- Add "Edit Person" functionality
- Add "Delete Person" confirmation dialog
- Show person's face gallery
- Implement face assignment UI:
  - Click unassigned face → Select person → Assign
- Show face count per person
- Add search/filter persons
```

**API Usage:**
```javascript
// Create person
await window.electronAPI.processing.createPerson("John Doe", { notes: "..." });

// Assign face to person
await window.electronAPI.processing.assignFace(faceId, personId);

// Update person
await window.electronAPI.processing.updatePerson(personId, { name: "New Name" });

// Delete person
await window.electronAPI.processing.deletePerson(personId);
```

### 3. **Advanced Features**

#### Image Viewer (Lightbox)
```jsx
// Component: ImageViewer.jsx
- Full-screen image display
- Previous/Next navigation
- Zoom in/out
- Face detection overlay toggle
- Image metadata panel
- Face list with person names
- Quick assign faces to persons
```

#### Face Assignment Modal
```jsx
// Component: FaceAssignModal.jsx
- Show face thumbnail
- List of existing persons
- Search persons
- Create new person inline
- Assign and close
```

#### Filters & Search
```jsx
// Component: FilterPanel.jsx
- Filter by event
- Filter by date range
- Filter by person
- Filter by has/no faces
- Search by filename
```

#### Statistics Charts
```jsx
// Optional: Add charts library (e.g., recharts)
import { LineChart, BarChart } from 'recharts';

// Display trends:
- Images downloaded over time
- Faces detected per day
- Storage usage over time
- Processing speed trends
```

### 4. **Error Handling & Loading States**

**TODO:**
- Add error boundaries
- Show error notifications
- Loading skeletons for data fetching
- Retry failed operations
- Connection status indicator

### 5. **Notifications System**

**TODO:**
```jsx
// Component: NotificationProvider.jsx
- Toast notifications for:
  - Download completed
  - Processing completed
  - Errors
  - Low disk space
  - Face detection complete
```

---

## Component Examples

### Image Grid Component
```jsx
function ImageGrid({ images }) {
  return (
    <div className="image-grid">
      {images.map(image => (
        <div key={image.id} className="image-card" onClick={() => openImage(image)}>
          <img src={`file://${image.thumbnail_path}`} alt={image.filename} />
          <div className="image-overlay">
            <span className="image-faces">{image.face_count} faces</span>
          </div>
        </div>
      ))}
    </div>
  );
}
```

### Face Overlay Component
```jsx
function FaceOverlay({ imagePath, faces }) {
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  return (
    <div className="face-overlay-container">
      <img
        src={`file://${imagePath}`}
        onLoad={(e) => setImageSize({
          width: e.target.naturalWidth,
          height: e.target.naturalHeight
        })}
      />
      {faces.map(face => {
        const { x, y, width, height } = face.bounding_box;
        return (
          <div
            key={face.id}
            className="face-box"
            style={{
              left: `${(x / imageSize.width) * 100}%`,
              top: `${(y / imageSize.height) * 100}%`,
              width: `${(width / imageSize.width) * 100}%`,
              height: `${(height / imageSize.height) * 100}%`
            }}
          >
            {face.person_id && (
              <span className="face-label">{face.person_name}</span>
            )}
          </div>
        );
      })}
    </div>
  );
}
```

---

## Development Workflow

### 1. **Install Dependencies**
```bash
cd electron-app
npm install
```

### 2. **Run Development Server**
```bash
npm run dev
```

This will:
- Start Webpack dev server for renderer process (hot reload)
- Start Electron with main process
- Watch for file changes

### 3. **Build for Production**
```bash
npm run build      # Build renderer and main
npm run package    # Package as distributable
```

---

## File Organization

```
src/renderer/
├── App.jsx                      # Main app component
├── index.html                   # HTML entry point
│
├── layouts/
│   ├── MainLayout.jsx          # Sidebar + content layout
│   └── MainLayout.css
│
├── pages/
│   ├── Dashboard.jsx           # Dashboard page
│   ├── Dashboard.css
│   ├── Downloads.jsx           # Downloads page
│   ├── Processing.jsx          # Processing page
│   ├── Gallery.jsx             # Gallery page (TODO)
│   ├── People.jsx              # People page (TODO)
│   ├── Storage.jsx             # Storage page
│   ├── Settings.jsx            # Settings page
│   └── Page.css                # Shared page styles
│
├── components/
│   ├── Button.jsx              # Button component
│   ├── Button.css
│   ├── Card.jsx                # Card container
│   ├── Card.css
│   ├── StatusCard.jsx          # Stat card
│   ├── StatusCard.css
│   ├── ProgressBar.jsx         # Progress bar
│   └── ProgressBar.css
│
└── styles/
    └── global.css              # Global styles & design system
```

---

## API Integration

### Available electronAPI Methods

All methods are available via `window.electronAPI.*`

#### **Config**
```javascript
await electronAPI.config.get(key)
await electronAPI.config.getAll()
await electronAPI.config.set(key, value)
```

#### **Download**
```javascript
await electronAPI.download.startDownloadSync(options)
await electronAPI.download.pause()
await electronAPI.download.resume()
await electronAPI.download.cancel()
await electronAPI.download.getStatus()
await electronAPI.download.getStats()

// Event listeners (return cleanup function)
const cleanup = electronAPI.download.onProgress((data) => {
  console.log(data.completedCount, data.totalCount);
});
cleanup(); // Remove listener
```

#### **Processing**
```javascript
await electronAPI.processing.start(options)
await electronAPI.processing.pause()
await electronAPI.processing.resume()
await electronAPI.processing.cancel()
await electronAPI.processing.getStatus()
await electronAPI.processing.getStats()

await electronAPI.processing.getFaces(imageId)
await electronAPI.processing.getPersons()
await electronAPI.processing.createPerson(name, metadata)
await electronAPI.processing.updatePerson(id, data)
await electronAPI.processing.deletePerson(id)
await electronAPI.processing.assignFace(faceId, personId)
await electronAPI.processing.getUnassignedFaces(limit)

// Event listeners
const cleanup = electronAPI.processing.onProgress((data) => {
  console.log(data.totalProcessed, data.facesDetected);
});
```

#### **Database**
```javascript
await electronAPI.database.getStats()
await electronAPI.database.getImage(id)
await electronAPI.database.getImagesByStatus(status, options)
await electronAPI.database.getCollections()
await electronAPI.database.createCollection(name, imageIds)
```

#### **Storage**
```javascript
await electronAPI.storage.getStats()
await electronAPI.storage.getDiskSpace()
await electronAPI.storage.cleanup()
await electronAPI.storage.findDuplicates()
await electronAPI.storage.deleteThumbnails()
```

#### **System**
```javascript
await electronAPI.system.getVersion()
await electronAPI.system.getInfo()
await electronAPI.system.getPaths()
await electronAPI.system.openFolder(path)
await electronAPI.system.showNotification(options)
```

---

## Responsive Design

All pages are responsive with breakpoints:
- Desktop: > 1200px (full layout)
- Tablet: 768px - 1200px (adjusted grid)
- Mobile: < 768px (single column)

```css
@media (max-width: 768px) {
  /* Mobile styles */
  .page {
    padding: var(--spacing-lg);
  }
  .dashboard-grid {
    grid-template-columns: 1fr;
  }
}
```

---

## Testing Checklist

### Manual Testing

- [ ] **Dashboard**
  - [ ] Stats cards load correctly
  - [ ] Refresh button updates stats
  - [ ] Quick actions navigate to correct pages
  - [ ] Real-time updates work during download/processing

- [ ] **Downloads**
  - [ ] Start download button triggers download
  - [ ] Pause/Resume/Cancel work correctly
  - [ ] Progress bar updates in real-time
  - [ ] Statistics display correctly

- [ ] **Processing**
  - [ ] Start processing button works
  - [ ] Pause/Resume/Cancel work correctly
  - [ ] Queue size updates in real-time
  - [ ] Statistics display correctly

- [ ] **Gallery**
  - [ ] Images load and display (after implementation)
  - [ ] Face overlays render correctly
  - [ ] Lightbox opens on click
  - [ ] Filtering works

- [ ] **People**
  - [ ] Person list displays correctly
  - [ ] Create person works
  - [ ] Assign face works
  - [ ] Delete person works

- [ ] **Storage**
  - [ ] Storage stats display correctly
  - [ ] Cleanup actions work
  - [ ] Low space warning shows when needed

- [ ] **Settings**
  - [ ] All config values display
  - [ ] Open folder buttons work
  - [ ] System info displays correctly

---

## Next Steps

1. **Complete Gallery Implementation**
   - Image grid with thumbnails
   - Lightbox viewer
   - Face detection overlays

2. **Complete People Management**
   - Person CRUD operations UI
   - Face assignment interface
   - Person face gallery

3. **Add Notifications**
   - Toast notifications for events
   - Error notifications
   - Success confirmations

4. **Error Handling**
   - Error boundaries
   - Retry mechanisms
   - Connection status

5. **Polish & UX**
   - Loading states
   - Animations
   - Empty states
   - Help tooltips

---

## Troubleshooting

### Issue: "electronAPI is not defined"
**Solution:** Make sure preload script is properly configured in main process:
```javascript
webPreferences: {
  preload: path.join(__dirname, '../renderer/preload.js'),
  contextIsolation: true,
  nodeIntegration: false
}
```

### Issue: Images not displaying
**Solution:** Use `file://` protocol for local file paths:
```javascript
<img src={`file://${image.local_path}`} />
```

### Issue: Styles not applying
**Solution:** Ensure CSS imports are in correct order:
1. global.css (theme variables)
2. Component-specific CSS
3. Page-specific CSS

### Issue: React Router not working
**Solution:** Use HashRouter instead of BrowserRouter in Electron:
```javascript
import { HashRouter as Router } from 'react-router-dom';
```

---

## Summary

**Task #8 Status:** 60% Complete

**Completed:**
- ✅ Application structure
- ✅ Design system and theme
- ✅ Core components
- ✅ Layout with sidebar navigation
- ✅ Dashboard with real-time stats
- ✅ Download manager UI
- ✅ Processing manager UI
- ✅ Storage management UI
- ✅ Settings viewer
- ✅ Event-driven updates

**Remaining:**
- ⏳ Gallery implementation (image grid, lightbox)
- ⏳ People management UI (person CRUD, face assignment)
- ⏳ Advanced filtering and search
- ⏳ Notification system
- ⏳ Error handling improvements
- ⏳ Loading states and skeletons

The foundation is complete and functional. The remaining work is primarily UI enhancements and user interaction flows for the Gallery and People pages.
