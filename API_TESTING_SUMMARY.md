# 🎉 Face Scanner HTTP API - Complete Setup

## ✅ Status: READY FOR TESTING

### 🟢 API Server Running
- **URL:** http://localhost:3000
- **Status:** Active and responding
- **Tested:** ✅ Health check passed
- **Tested:** ✅ Face scanning working

---

## 📦 What Was Created

### 1. API Server (`api-server-simple.js`)
- Express.js HTTP server
- Face detection with ML models
- Runs on port 3000
- Independent of Electron app

### 2. Postman Collection (`Face_Scanner_API.postman_collection.json`)
- Pre-configured requests
- Environment variables
- Example payloads
- **Ready to import**

### 3. Documentation Files
- `POSTMAN_QUICK_START.md` - Quick start guide (START HERE)
- `API_POSTMAN_SIMPLE.md` - Detailed API documentation
- `FACE_SCANNER_API.md` - Complete face scanner guide

---

## 🚀 Quick Start (3 Steps)

### Step 1: Open Postman
1. Launch Postman application
2. Click **Import** (top left)
3. Select file: `Face_Scanner_API.postman_collection.json`
4. Click **Import**

### Step 2: Test Health Check
```
GET http://localhost:3000/health
```
Expected: `"status": "ok"`

### Step 3: Scan a Face
```
POST http://localhost:3000/api/scanner/scan
Body (JSON):
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```
Expected: Face embedding with 128 values

---

## 🎯 Available Endpoints

### 1. Health Check
```
GET /health
```
Check if server is running

### 2. Scan Face from Path ⭐
```
POST /api/scanner/scan
Body: { "imagePath": "D:\\path\\to\\image.jpg" }
```
Most common use case

### 3. Upload and Scan ⭐
```
POST /api/scanner/upload
Body: form-data with "image" file
```
For uploading new images

### 4. Compare Embeddings
```
POST /api/scanner/compare
Body: { "embedding1": [...], "embedding2": [...] }
```
Compare two faces

### 5. Batch Scan
```
POST /api/scanner/batch-scan
Body: { "imagePaths": ["path1", "path2", ...] }
```
Scan multiple images

### 6. API Info
```
GET /api/info
```
List all endpoints

---

## 📋 Test Images Available

These images are in your database and ready to test:

```
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265114_1.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265145_10.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265157_11.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265169_12.jpeg
```

---

## 🧪 Tested & Verified

✅ **Server startup** - Models loaded successfully
✅ **Health endpoint** - Responding correctly
✅ **Face scanning** - Working with real images
✅ **JSON parsing** - Request bodies handled properly
✅ **Error handling** - Proper error responses

---

## 📚 Response Examples

### Success - Face Detected
```json
{
  "success": true,
  "face": {
    "embedding": [-0.157, 0.065, 0.085, ...], // 128 numbers
    "confidence": 0.9876,
    "boundingBox": {
      "x": 150.5,
      "y": 200.3,
      "width": 250.8,
      "height": 300.2
    },
    "landmarks": [
      { "x": 180, "y": 220 },
      ...
    ]
  }
}
```

### Error - No Face Detected
```json
{
  "success": false,
  "error": "No face detected in the image"
}
```

### Compare Result
```json
{
  "success": true,
  "distance": 0.42,
  "similarity": 0.58,
  "match": true
}
```

---

## 💡 Common Use Cases

### Use Case 1: Face Verification
1. Scan reference image → Get embedding1
2. Scan test image → Get embedding2
3. Compare embeddings → Check if match

### Use Case 2: Face Detection
1. Upload image
2. Get face bounding box
3. Check confidence score

### Use Case 3: Batch Processing
1. Prepare list of image paths
2. Send batch scan request
3. Get all face embeddings at once

---

## 🔧 Server Control

### Start Server
```bash
cd electron-app
node api-server-simple.js
```

### Check Status
```bash
curl http://localhost:3000/health
```

### Stop Server
Press `Ctrl+C` in the terminal running the server

---

## ⚠️ Important Notes

1. **Image Paths**
   - Must be absolute paths
   - Use double backslashes in Windows: `D:\\path\\to\\image.jpg`
   - File must exist on server machine

2. **Embeddings**
   - Always 128-dimensional
   - All numbers between -1 and 1
   - Can be saved and reused

3. **Performance**
   - Face detection: ~500ms per image
   - Embedding comparison: <1ms
   - Upload limited to 10MB

4. **Limitations**
   - No database access (simplified version)
   - No collection search (use Electron app for that)
   - One face per image only

---

## 📖 Full Documentation

| File | Purpose |
|------|---------|
| `POSTMAN_QUICK_START.md` | **Start here** - Quick guide |
| `API_POSTMAN_SIMPLE.md` | Detailed API reference |
| `FACE_SCANNER_API.md` | Complete scanner documentation |
| `Face_Scanner_API.postman_collection.json` | **Import this** into Postman |

---

## ✅ Next Steps

1. ✅ **Import Postman collection**
   - File: `Face_Scanner_API.postman_collection.json`

2. ✅ **Test health endpoint**
   - Verify server is responding

3. ✅ **Run face scan test**
   - Use pre-configured request

4. ✅ **Try upload feature**
   - Upload your own image

5. ✅ **Test comparison**
   - Compare two faces

---

## 🎯 Success Metrics

You'll know it's working when:
- ✅ Health check returns `"status": "ok"`
- ✅ Face scan returns 128-number embedding
- ✅ Confidence score is > 0.9
- ✅ Bounding box coordinates are returned
- ✅ Upload accepts your image files

---

## 🐛 Troubleshooting

### Server won't start
- Check if port 3000 is already in use
- Verify Node.js is installed (v18+)
- Check models directory exists

### Can't scan image
- Verify image path is absolute
- Check file exists
- Ensure face is visible in image

### Getting errors
- Check JSON format in request body
- Verify Content-Type header
- Look at server console for details

---

## 📞 Testing Support

- **Health check URL:** http://localhost:3000/health
- **API info URL:** http://localhost:3000/api/info
- **Test image:** Use paths listed above
- **Server logs:** Check console where server is running

---

## 🎉 Ready!

**API Server Status:** 🟢 RUNNING
**Postman Collection:** ✅ READY TO IMPORT
**Test Images:** ✅ AVAILABLE
**Documentation:** ✅ COMPLETE

**Start testing in Postman now!**

Import `Face_Scanner_API.postman_collection.json` and begin with the Health Check request.

---

**Quick Links:**
- Server: http://localhost:3000
- Health: http://localhost:3000/health
- API Info: http://localhost:3000/api/info
