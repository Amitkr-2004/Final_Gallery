/**
 * Preload Script - Simplified
 * Secure bridge between Main and Renderer processes
 * Exposes only upload and gallery APIs
 */

const { contextBridge, ipcRenderer } = require('electron');

/**
 * Exposed API to renderer process
 */
contextBridge.exposeInMainWorld('electronAPI', {
  // Upload APIs
  upload: {
    selectFiles: () => ipcRenderer.invoke('core:upload:select-files'),
    selectFolder: () => ipcRenderer.invoke('core:upload:select-folder'),
    uploadFiles: (filePaths) => ipcRenderer.invoke('core:upload:upload-files', filePaths),
    getStats: () => ipcRenderer.invoke('core:upload:get-stats')
  },

  // Gallery APIs
  gallery: {
    getAllFiles: (options) => ipcRenderer.invoke('core:gallery:get-all-files', options),
    getRecentFiles: (days) => ipcRenderer.invoke('core:gallery:get-recent-files', days),
    getStats: () => ipcRenderer.invoke('core:gallery:get-stats'),
    searchFiles: (searchTerm) => ipcRenderer.invoke('core:gallery:search-files', searchTerm),
    deleteFile: (fileId) => ipcRenderer.invoke('core:gallery:delete-file', fileId),
    clearAll: () => ipcRenderer.invoke('core:gallery:clear-all')
  },

  // System APIs
  system: {
    getVersion: () => ipcRenderer.invoke('core:system:get-version'),
    getAppName: () => ipcRenderer.invoke('core:system:get-app-name'),
    openFolder: (path) => ipcRenderer.invoke('core:system:open-folder', path)
  },

  // Face & Collection APIs
  face: {
    getCollections: () => ipcRenderer.invoke('core:face:get-collections'),
    getCollectionFaces: (collectionId) => ipcRenderer.invoke('core:face:get-collection-faces', collectionId),
    getPersonImages: (collectionId) => ipcRenderer.invoke('core:face:get-person-images', collectionId),
    renameCollection: (collectionId, newName) => ipcRenderer.invoke('core:face:rename-collection', collectionId, newName),
    deleteCollection: (collectionId) => ipcRenderer.invoke('core:face:delete-collection', collectionId),
    getStats: () => ipcRenderer.invoke('core:face:get-stats'),
    batchProcess: () => ipcRenderer.invoke('core:face:batch-process')
  },

  // Navigation API (for tray menu)
  onNavigate: (callback) => {
    ipcRenderer.on('navigate-to', (event, route) => callback(route));
  }
});

/**
 * Log that preload script is loaded
 */
console.log('✓ Preload script loaded successfully');
console.log('✓ electronAPI exposed to renderer');
