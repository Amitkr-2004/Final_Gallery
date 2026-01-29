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
  }
});

/**
 * Log that preload script is loaded
 */
console.log('✓ Preload script loaded successfully');
console.log('✓ electronAPI exposed to renderer');
