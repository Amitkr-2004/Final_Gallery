# Upload All Images to GCS - Instructions

## Option 1: Using Electron App DevTools Console (Recommended)

### Step 1: Open Electron App
Make sure your Electron app is running (the one on port 9000)

### Step 2: Open DevTools
Press **F12** or **Ctrl+Shift+I**

### Step 3: Check Current Status
Paste this in the console:
```javascript
// Check sync status
const stats = await window.electronAPI.gcs.getSyncStats();
console.log('📊 Sync Status:');
console.log('  Pending:', stats.stats.pending);
console.log('  Uploading:', stats.stats.uploading);
console.log('  Completed:', stats.stats.completed);
console.log('  Failed:', stats.stats.failed);
console.log('  Total:', stats.stats.total);
```

### Step 4: Upload All Images
Paste this in the console:
```javascript
// Upload all pending images
console.log('🚀 Starting upload...');
const result = await window.electronAPI.gcs.batchSync({});
console.log('✅ Upload complete!');
console.log('  Total:', result.stats.total);
console.log('  Succeeded:', result.stats.succeeded);
console.log('  Failed:', result.stats.failed);
```

### Step 5: Upload All Collections
Paste this in the console:
```javascript
// Upload collection metadata
console.log('📦 Uploading collections...');
const collResult = await window.electronAPI.gcs.syncAllCollections();
console.log('✅ Collections uploaded!');
console.log('  Total:', collResult.stats.total);
console.log('  Succeeded:', collResult.stats.succeeded);
console.log('  Failed:', collResult.stats.failed);
```

### Step 6: Verify Final Status
```javascript
// Check final status
const finalStats = await window.electronAPI.gcs.getSyncStats();
console.log('📊 Final Status:');
console.log('  ✅ Completed:', finalStats.stats.completed);
console.log('  ⏳ Pending:', finalStats.stats.pending);
console.log('  ❌ Failed:', finalStats.stats.failed);
```

---

## Option 2: All-in-One Upload Script

Copy and paste this entire block into the Electron DevTools console:

```javascript
(async () => {
  console.log('\n=== Starting GCS Upload Process ===\n');

  // Step 1: Check status
  console.log('Step 1: Checking current status...');
  const initialStats = await window.electronAPI.gcs.getSyncStats();
  console.log('📊 Initial Status:');
  console.log('  Total images:', initialStats.stats.total);
  console.log('  Already synced:', initialStats.stats.completed);
  console.log('  Pending:', initialStats.stats.pending);
  console.log('  Failed:', initialStats.stats.failed);

  if (initialStats.stats.pending === 0 && initialStats.stats.failed === 0) {
    console.log('\n✅ All images already uploaded!\n');
    return;
  }

  // Step 2: Upload images
  console.log('\nStep 2: Uploading images...');
  const uploadResult = await window.electronAPI.gcs.batchSync({});
  console.log('📤 Image Upload Results:');
  console.log('  Total processed:', uploadResult.stats.total);
  console.log('  ✅ Succeeded:', uploadResult.stats.succeeded);
  console.log('  ❌ Failed:', uploadResult.stats.failed);

  // Step 3: Upload collections
  console.log('\nStep 3: Uploading collections...');
  const collResult = await window.electronAPI.gcs.syncAllCollections();
  console.log('📦 Collection Upload Results:');
  console.log('  Total:', collResult.stats.total);
  console.log('  ✅ Succeeded:', collResult.stats.succeeded);
  console.log('  ❌ Failed:', collResult.stats.failed);

  // Step 4: Final status
  console.log('\nStep 4: Checking final status...');
  const finalStats = await window.electronAPI.gcs.getSyncStats();
  console.log('\n=== Upload Complete ===');
  console.log('📊 Final Status:');
  console.log('  ✅ Synced:', finalStats.stats.completed);
  console.log('  ⏳ Pending:', finalStats.stats.pending);
  console.log('  ❌ Failed:', finalStats.stats.failed);

  if (finalStats.stats.failed > 0) {
    console.log('\n⚠️  Some uploads failed. Retry with:');
    console.log('  await window.electronAPI.gcs.retryFailed()');
  } else {
    console.log('\n🎉 All uploads successful!');
  }
})();
```

---

## Option 3: Retry Failed Uploads

If some uploads failed, retry them:

```javascript
console.log('🔄 Retrying failed uploads...');
const retryResult = await window.electronAPI.gcs.retryFailed();
console.log('Results:', retryResult);
```

---

## Monitoring Progress

While upload is running, you can check progress:

```javascript
// Check status every 5 seconds
setInterval(async () => {
  const stats = await window.electronAPI.gcs.getSyncStats();
  console.log(`Progress: ${stats.stats.completed}/${stats.stats.total} (${stats.stats.uploading} uploading)`);
}, 5000);
```

---

## Understanding Results

### Sync Status Values:
- **Pending**: Not yet uploaded
- **Uploading**: Currently being uploaded
- **Completed**: Successfully uploaded ✅
- **Failed**: Upload failed ❌

### What Gets Uploaded:
1. **Image files** → `images/{collection_id}/{image_id}.jpg`
2. **Face metadata** → `metadata/faces/{face_id}.json`
3. **Embeddings** → `embeddings/{face_id}.json` + Firestore
4. **Collections** → `collections/{collection_id}.json`

---

## Troubleshooting

### "electronAPI is not defined"
- Make sure you're in the Electron app window (not browser)
- Press F12 to open DevTools
- You should see the Electron app UI in the background

### "GCS service not initialized"
- Check your `.env` file has correct credentials
- Verify `GOOGLE_APPLICATION_CREDENTIALS` path is correct
- Restart the Electron app

### Some uploads failing
- Check GCP credentials are valid
- Verify bucket exists and you have write permissions
- Check file paths are correct
- Look at the error messages in the results

---

## Expected Output

When successful, you'll see:

```
=== Starting GCS Upload Process ===

Step 1: Checking current status...
📊 Initial Status:
  Total images: 100
  Already synced: 50
  Pending: 50
  Failed: 0

Step 2: Uploading images...
📤 Image Upload Results:
  Total processed: 50
  ✅ Succeeded: 50
  ❌ Failed: 0

Step 3: Uploading collections...
📦 Collection Upload Results:
  Total: 45
  ✅ Succeeded: 45
  ❌ Failed: 0

Step 4: Checking final status...

=== Upload Complete ===
📊 Final Status:
  ✅ Synced: 100
  ⏳ Pending: 0
  ❌ Failed: 0

🎉 All uploads successful!
```

---

## Quick Commands Reference

```javascript
// Check status
await window.electronAPI.gcs.getSyncStats()

// Upload all pending
await window.electronAPI.gcs.batchSync({})

// Upload specific number
await window.electronAPI.gcs.batchSync({ limit: 10 })

// Upload collections
await window.electronAPI.gcs.syncAllCollections()

// Retry failed
await window.electronAPI.gcs.retryFailed()

// List GCS collections
await window.electronAPI.gcs.listCollections()
```

---

**Recommended:** Use Option 2 (All-in-One script) - copy, paste, run, done! 🚀
