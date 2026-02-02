// Auto-process pending images and sync to GCS
// Run this after uploading images

const { app } = require('electron');

// Wait for app to be ready, then trigger processing
app.whenReady().then(async () => {
  const { ipcMain } = require('electron');

  console.log('Triggering auto-processing...');

  // Trigger batch face processing
  try {
    const result = await ipcMain.handle('core:face:batch-process');
    console.log('Face processing triggered');

    // Wait for processing to complete
    setTimeout(async () => {
      // Trigger batch GCS sync
      const syncResult = await ipcMain.handle('core:gcs:batch-sync', {});
      console.log('GCS sync triggered');

      console.log('Auto-processing complete!');
      app.quit();
    }, 30000); // Wait 30 seconds for face processing

  } catch (error) {
    console.error('Error:', error.message);
    app.quit();
  }
});
