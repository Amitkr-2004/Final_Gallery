# Quick Start Guide - Electron Image Processor

## Problem: Blank Window

If you're seeing a blank Electron window, follow these steps:

---

## Step 1: Install Dependencies

```bash
cd electron-app
npm install
```

This will install all required packages including:
- React & React DOM
- Electron
- Webpack & Babel
- All backend libraries

---

## Step 2: Build the React UI

Since the React app needs to be bundled by Webpack before Electron can display it:

```bash
npm run build:renderer
```

**Note:** If this command fails, run the webpack command directly:
```bash
npx webpack --config webpack.renderer.config.js --mode development
```

This creates `dist/renderer/index.html` and `dist/renderer/renderer.js`.

---

## Step 3: Run in Development Mode

**Option A: Development with Hot Reload (Recommended)**

In Terminal 1, start the Webpack dev server:
```bash
npx webpack serve --config webpack.renderer.config.js --mode development
```

In Terminal 2, start Electron:
```bash
npm start
```

**Option B: Simple Development (No Hot Reload)**

```bash
# Build once
npm run build:renderer

# Start Electron
npm start
```

---

## Step 4: Verify It's Working

You should see:
1. **Electron window opens** with the sidebar navigation
2. **Dashboard page** displaying (even if data is empty)
3. **DevTools open** (in development mode)
4. **No console errors** (some warnings are OK)

---

## Troubleshooting

### Issue: "Cannot find module './storage/config'"

**Solution:** Some utility files are missing. Run this to create a minimal config loader:

```bash
mkdir -p src/main/storage
mkdir -p src/main/utils
```

Then create **src/main/storage/config.js**:
```javascript
const path = require('path');
const fs = require('fs');

class ConfigService {
  constructor() {
    this.config = {};
    this.environment = process.env.NODE_ENV || 'development';
  }

  load() {
    const configPath = path.join(__dirname, '../../config/default.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    this.config = JSON.parse(configData);
    console.log('✓ Config loaded');
  }

  getAll() {
    return this.config;
  }

  get(key) {
    return this.config[key];
  }

  getEnvironment() {
    return this.environment;
  }

  isDevelopment() {
    return this.environment === 'development';
  }
}

let instance = null;

function getConfigService() {
  if (!instance) {
    instance = new ConfigService();
  }
  return instance;
}

module.exports = { getConfigService, ConfigService };
```

### Issue: "Cannot find module './utils/logger'"

**Solution:** Create **src/main/utils/logger.js**:
```javascript
const winston = require('winston');
const path = require('path');

function setupLogger(configService) {
  const logger = winston.createLogger({
    level: 'info',
    format: winston.format.combine(
      winston.format.timestamp(),
      winston.format.json()
    ),
    transports: [
      new winston.transports.Console({
        format: winston.format.simple()
      })
    ]
  });

  return logger;
}

module.exports = { setupLogger };
```

### Issue: "Cannot find module './storage/file-manager'"

**Solution:** Create **src/main/storage/file-manager.js**:
```javascript
const fs = require('fs').promises;
const path = require('path');

async function ensureDirectories(configService) {
  const config = configService.getAll();
  const dirs = [
    config.storage.basePath,
    config.storage.downloadPath,
    config.storage.processedPath,
    config.storage.databasePath,
    config.storage.logsPath,
    config.storage.tempPath
  ];

  for (const dir of dirs) {
    await fs.mkdir(dir, { recursive: true });
  }

  console.log('✓ Directories created');
}

module.exports = { ensureDirectories };
```

### Issue: "Cannot find module './storage/credentials'"

**Solution:** Create **src/main/storage/credentials.js**:
```javascript
async function initializeCredentialStorage(configService) {
  console.log('✓ Credential storage initialized (stub)');
  return true;
}

module.exports = { initializeCredentialStorage };
```

---

## Minimal Startup (Skip Missing Modules)

If you want to skip all backend initialization and just see the UI:

Create **src/main/index-simple.js**:
```javascript
const { app, BrowserWindow } = require('electron');
const path = require('path');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, '../renderer/preload.js')
    }
  });

  // Load from webpack dev server
  mainWindow.loadURL('http://localhost:9000');
  mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
```

Then update **package.json** main field:
```json
"main": "src/main/index-simple.js"
```

---

## Expected Folder Structure

```
electron-app/
├── config/
│   ├── default.json          ✓ (exists)
│   └── dev.json              ✓ (exists)
├── src/
│   ├── main/
│   │   ├── index.js          ✓ (main process)
│   │   ├── storage/
│   │   │   ├── config.js     ⚠ (may need to create)
│   │   │   └── credentials.js ⚠ (may need to create)
│   │   ├── utils/
│   │   │   └── logger.js     ⚠ (may need to create)
│   │   ├── database/
│   │   │   └── schema.js     ✓ (exists)
│   │   └── ipc/
│   │       └── handlers.js   ✓ (exists)
│   └── renderer/
│       ├── App.jsx           ✓ (React app)
│       ├── index.html        ✓ (HTML template)
│       ├── preload.js        ✓ (IPC bridge)
│       ├── pages/            ✓ (7 pages)
│       └── components/       ✓ (14 components)
├── dist/
│   └── renderer/
│       ├── index.html        🔨 (created by webpack)
│       └── renderer.js       🔨 (created by webpack)
├── package.json              ✓
├── webpack.renderer.config.js ✓
└── .babelrc                  ✓
```

---

## Next Steps After UI Loads

Once the UI is displaying:

1. **Download face detection models** (see PROCESSING_SETUP.md)
2. **Configure GCS credentials** (if using Google Cloud Storage)
3. **Test downloads** (will need backend API setup)
4. **Test processing** (will need face models)
5. **View gallery** (need processed images)

---

## Summary

**Minimum to see UI:**
1. `npm install`
2. `npx webpack serve --config webpack.renderer.config.js` (Terminal 1)
3. `npm start` (Terminal 2)

**If errors occur:**
- Create missing utility files (config.js, logger.js, file-manager.js)
- OR use index-simple.js for UI-only testing

The UI will load even without backend services - you'll just see empty states until you process images.
