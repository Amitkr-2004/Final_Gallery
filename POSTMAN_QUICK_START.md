# 🚀 Face Scanner API - Postman Quick Start

## ✅ Server Status

✅ **API Server is RUNNING** on `http://localhost:3000`

---

## 📥 Import Postman Collection

### Method 1: Import JSON File
1. Open Postman
2. Click **Import** button (top left)
3. Select **File** tab
4. Choose: `Face_Scanner_API.postman_collection.json`
5. Click **Import**

### Method 2: Manual Setup
Create these requests manually in Postman:

---

## 🧪 Test Endpoints

### 1️⃣ Health Check (Verify Server)
```
Method: GET
URL: http://localhost:3000/health
```

**Expected Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T...",
  "services": {
    "faceScanner": true
  }
}
```

---

### 2️⃣ Scan Face (Main Feature)
```
Method: POST
URL: http://localhost:3000/api/scanner/scan
Headers: Content-Type: application/json
Body (raw JSON):
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```

**Expected Response:**
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
    }
  }
}
```

---

### 3️⃣ Upload Image (Alternative)
```
Method: POST
URL: http://localhost:3000/api/scanner/upload
Body: form-data
```

**Postman Steps:**
1. Select **POST**
2. URL: `http://localhost:3000/api/scanner/upload`
3. Body → **form-data**
4. Add key: `image` (change type to **File**)
5. Click **Select Files** and choose an image
6. Click **Send**

---

### 4️⃣ Compare Embeddings
```
Method: POST
URL: http://localhost:3000/api/scanner/compare
Headers: Content-Type: application/json
Body (raw JSON):
{
  "embedding1": [0.1, 0.2, ...], // 128 numbers
  "embedding2": [0.09, 0.19, ...] // 128 numbers
}
```

---

## 📝 Available Image Paths (Use These for Testing)

```
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265114_1.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265145_10.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265157_11.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265169_12.jpeg
```

---

## 🎯 Complete Test Workflow

### Step 1: Health Check
```
GET http://localhost:3000/health
```
✅ Verify: `status: "ok"`

### Step 2: Scan First Face
```
POST http://localhost:3000/api/scanner/scan
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```
✅ Verify: `success: true` and `embedding` array has 128 values

### Step 3: Scan Second Face
```
POST http://localhost:3000/api/scanner/scan
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265145_10.jpeg"
}
```
✅ Save both embeddings

### Step 4: Compare Faces
```
POST http://localhost:3000/api/scanner/compare
{
  "embedding1": [paste first embedding],
  "embedding2": [paste second embedding]
}
```
✅ Verify: Returns `distance`, `similarity`, and `match` boolean

---

## 📊 Understanding Results

### Confidence Score
- **> 0.95**: ⭐⭐⭐ Excellent face detection
- **0.80 - 0.95**: ⭐⭐ Good face detection
- **< 0.80**: ⭐ Poor quality

### Similarity (in compare)
- **> 0.8**: 🟢 Very likely same person
- **0.6 - 0.8**: 🟡 Probably same person
- **< 0.6**: 🔴 Different people

### Distance
- Lower = More similar
- **< 0.4**: Same person (strict)
- **0.4 - 0.6**: Same person (recommended)
- **> 0.6**: Different people

---

## ⚠️ Common Issues

### "Image file not found"
- ✅ Use **absolute** path: `D:\\...\\image.jpg`
- ❌ Don't use relative: `./image.jpg`
- Check file actually exists

### "No face detected"
- Use clear, frontal face photo
- Ensure good lighting
- Face should be visible (not profile/side view)

### "Cannot connect"
- Verify server is running: `GET http://localhost:3000/health`
- Check console for errors
- Restart server if needed

---

## 🔧 Server Management

### Check Server Status
```bash
curl http://localhost:3000/health
```

### View Server Logs
Check the console where `node api-server-simple.js` is running

### Restart Server
1. Stop: Press `Ctrl+C` in server console
2. Start: `node api-server-simple.js`

---

## 📚 All Available Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check |
| `/api/info` | GET | API information |
| `/api/scanner/scan` | POST | Scan from path |
| `/api/scanner/upload` | POST | Upload and scan |
| `/api/scanner/compare` | POST | Compare embeddings |
| `/api/scanner/batch-scan` | POST | Scan multiple images |

---

## 💡 Pro Tips

1. **Save Postman Variables:**
   - `baseUrl` = `http://localhost:3000`
   - `testImagePath` = your most-used test image

2. **Save Responses:**
   - Copy embeddings from responses
   - Reuse in compare requests

3. **Use Environment:**
   - Create Postman environment
   - Store base URL and test paths

---

## ✅ Verification Checklist

- [ ] Server running (`GET /health` returns 200)
- [ ] Face scan working (`POST /api/scanner/scan`)
- [ ] Image upload working (`POST /api/scanner/upload`)
- [ ] Compare working (`POST /api/scanner/compare`)
- [ ] Batch scan working (`POST /api/scanner/batch-scan`)

---

## 🎉 Quick Test (Copy-Paste Ready)

### Test in Browser
Open: http://localhost:3000/health

### Test with cURL
```bash
curl http://localhost:3000/health
```

### Test Face Scan
Use Postman with this JSON body:
```json
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```

---

**🟢 Ready to test!** Import the Postman collection and start scanning faces.

**Documentation:**
- Full API docs: `API_POSTMAN_SIMPLE.md`
- Face Scanner guide: `FACE_SCANNER_API.md`
- Postman collection: `Face_Scanner_API.postman_collection.json`
