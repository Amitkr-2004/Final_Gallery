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
    getStats: () => ipcRenderer.invoke('core:upload:get-stats'),
    cancel: () => ipcRenderer.invoke('core:upload:cancel'),
    onProgress: (callback) => {
      const handler = (event, progress) => callback(progress);
      ipcRenderer.on('upload:progress', handler);
      // Return cleanup function
      return () => ipcRenderer.removeListener('upload:progress', handler);
    }
  },

  // Gallery APIs
  gallery: {
    getAllFiles: (options) => ipcRenderer.invoke('core:gallery:get-all-files', options),
    getRecentFiles: (days) => ipcRenderer.invoke('core:gallery:get-recent-files', days),
    getStats: () => ipcRenderer.invoke('core:gallery:get-stats'),
    searchFiles: (searchTerm) => ipcRenderer.invoke('core:gallery:search-files', searchTerm),
    deleteFile: (fileId) => ipcRenderer.invoke('core:gallery:delete-file', fileId),
    clearAll: () => ipcRenderer.invoke('core:gallery:clear-all'),
    getImageData: (filepath) => ipcRenderer.invoke('core:gallery:get-image-data', filepath)
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

  // GCP Sync APIs
  gcp: {
    getPendingSync: () => ipcRenderer.invoke('core:gcp:get-pending-sync'),
    prepareUpload: () => ipcRenderer.invoke('core:gcp:prepare-upload'),
    exportMetadata: () => ipcRenderer.invoke('core:gcp:export-metadata'),
    markForSync: (imageIds, faceIds) => ipcRenderer.invoke('core:gcp:mark-for-sync', { imageIds, faceIds })
  },

  // GCS Upload APIs
  gcs: {
    isReady: () => ipcRenderer.invoke('core:gcs:is-ready'),
    syncImage: (imageId) => ipcRenderer.invoke('core:gcs:sync-image', imageId),
    batchSync: (options) => ipcRenderer.invoke('core:gcs:batch-sync', options || {}),
    getSyncStats: () => ipcRenderer.invoke('core:gcs:get-sync-stats'),
    retryFailed: () => ipcRenderer.invoke('core:gcs:retry-failed'),

    // Collection APIs
    uploadCollection: (collectionId) => ipcRenderer.invoke('core:gcs:upload-collection', collectionId),
    syncAllCollections: () => ipcRenderer.invoke('core:gcs:sync-all-collections'),
    fetchCollection: (collectionId) => ipcRenderer.invoke('core:gcs:fetch-collection', collectionId),
    listCollections: () => ipcRenderer.invoke('core:gcs:list-collections')
  },

  // Face Scanner APIs
  scanner: {
    scanFace: (imagePath) => ipcRenderer.invoke('core:scanner:scan-face', imagePath),
    searchCollections: (embedding, threshold, limit) => ipcRenderer.invoke('core:scanner:search-collections', { embedding, threshold, limit }),
    searchCollectionsLocal: (embedding, threshold, limit) => ipcRenderer.invoke('core:scanner:search-collections-local', { embedding, threshold, limit }),
    scanAndMatch: (imagePath, options) => ipcRenderer.invoke('core:scanner:scan-and-match', { imagePath, options }),
    saveTempImage: (dataUrl, filename) => ipcRenderer.invoke('core:scanner:save-temp-image', { dataUrl, filename }),
    cleanupTemp: () => ipcRenderer.invoke('core:scanner:cleanup-temp')
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
