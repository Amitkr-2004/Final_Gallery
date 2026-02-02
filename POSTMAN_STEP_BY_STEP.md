# 📱 Postman Testing Guide - Step by Step

## ✅ API Test Results (Just Verified)

All endpoints are working:
- ✅ **Health Check**: `status: "ok"`
- ✅ **Face Scan**: Face detected with 99.15% confidence
- ✅ **Embedding Generated**: 128-dimensional vector created
- ✅ **Bounding Box**: Face location identified

---

## 🚀 Test in Postman - Visual Guide

### Option 1: Import Collection (Recommended)

#### Step 1: Open Postman
- Launch Postman application

#### Step 2: Import Collection
1. Click **"Import"** button (top-left corner)
2. Click **"Choose Files"**
3. Navigate to: `D:\Gallery_VSCode\`
4. Select: `Face_Scanner_API.postman_collection.json`
5. Click **"Open"**
6. Click **"Import"**

✅ **You should now see "Face Scanner API" in your Collections**

---

### Option 2: Manual Setup (If Import Fails)

## Test 1: Health Check ✅

### Setup in Postman:
1. Click **"New"** → **"HTTP Request"**
2. Change method to: **GET**
3. Enter URL: `http://localhost:3000/health`
4. Click **"Send"**

### Expected Response:
```json
{
    "status": "ok",
    "timestamp": "2026-02-02T08:26:43.169Z",
    "services": {
        "faceScanner": true,
        "note": "Simplified API - database features disabled"
    }
}
```

**Status Code:** 200 OK

---

## Test 2: Scan Face from Path ⭐ (Most Important)

### Setup in Postman:
1. Create new request
2. Method: **POST**
3. URL: `http://localhost:3000/api/scanner/scan`
4. Go to **"Headers"** tab
   - Add header: `Content-Type` = `application/json`
5. Go to **"Body"** tab
6. Select **"raw"**
7. Select **"JSON"** from dropdown (right side)
8. Paste this JSON:

```json
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```

9. Click **"Send"**

### Expected Response:
```json
{
    "success": true,
    "face": {
        "embedding": [-0.157, 0.065, 0.085, ...], // 128 numbers
        "confidence": 0.9915,
        "boundingBox": {
            "x": 1083.78,
            "y": 187.62,
            "width": 83.06,
            "height": 107.95
        },
        "landmarks": [
            {"x": 1100, "y": 220},
            ...
        ]
    }
}
```

**Status Code:** 200 OK

**✅ This confirms face detection is working!**

---

## Test 3: Upload Image File

### Setup in Postman:
1. Create new request
2. Method: **POST**
3. URL: `http://localhost:3000/api/scanner/upload`
4. Go to **"Body"** tab
5. Select **"form-data"**
6. Add a field:
   - Key: `image`
   - Change type to **"File"** (dropdown on the right)
   - Click **"Select Files"**
   - Choose any JPG or PNG image with a face
7. Click **"Send"**

### Expected Response:
Same as Test 2 - face detection results

**Status Code:** 200 OK

---

## Test 4: Compare Two Embeddings

### Setup in Postman:
1. Create new request
2. Method: **POST**
3. URL: `http://localhost:3000/api/scanner/compare`
4. Headers: `Content-Type` = `application/json`
5. Body: **raw** → **JSON**
6. Paste this (sample embeddings):

```json
{
  "embedding1": [-0.157, 0.065, 0.085, -0.046, -0.095, 0.034, -0.039, -0.110, 0.166, -0.128, 0.166, 0.032, -0.186, -0.051, -0.120, 0.187, -0.171, -0.154, -0.024, -0.092, 0.003, 0.030, 0.016, 0.026, -0.152, -0.369, -0.099, -0.137, 0.015, -0.016, -0.051, 0.060, -0.158, -0.026, -0.009, 0.055, -0.041, 0.087, -0.075, 0.046, 0.117, -0.188, 0.307, -0.080, -0.228, 0.235, -0.024, -0.139, 0.185, -0.223, -0.068, 0.130, 0.094, 0.073, 0.059, -0.130, 0.009, 0.109, -0.209, 0.042, 0.183, -0.050, -0.082, -0.037, 0.212, 0.084, -0.164, -0.110, 0.180, -0.123, -0.031, 0.028, -0.062, -0.142, -0.284, 0.225, 0.327, -0.143, -0.182, -0.085, -0.094, 0.026, 0.148, 0.440, 0.105, -0.061, -0.034, -0.055, 0.047, 0.129, 0.069, 0.092, -0.089, -0.011, 0.039, -0.074, 0.027, 0.046, -0.170, -0.181, 0.149, 0.084, -0.052, -0.057, 0.137, -0.024, 0.030, 0.027, 0.071, -0.108, 0.058, -0.061, -0.154, 0.007, 0.259, 0.041, 0.013, 0.110, -0.173, -0.029, 0.221, -0.107, 0.074, -0.020, 0.049, -0.110, -0.220, 0.082],
  "embedding2": [-0.155, 0.063, 0.083, -0.044, -0.093, 0.032, -0.037, -0.108, 0.164, -0.126, 0.164, 0.030, -0.184, -0.049, -0.118, 0.185, -0.169, -0.152, -0.022, -0.090, 0.001, 0.028, 0.014, 0.024, -0.150, -0.367, -0.097, -0.135, 0.013, -0.014, -0.049, 0.058, -0.156, -0.024, -0.007, 0.053, -0.039, 0.085, -0.073, 0.044, 0.115, -0.186, 0.305, -0.078, -0.226, 0.233, -0.022, -0.137, 0.183, -0.221, -0.066, 0.128, 0.092, 0.071, 0.057, -0.128, 0.007, 0.107, -0.207, 0.040, 0.181, -0.048, -0.080, -0.035, 0.210, 0.082, -0.162, -0.108, 0.178, -0.121, -0.029, 0.026, -0.060, -0.140, -0.282, 0.223, 0.325, -0.141, -0.180, -0.083, -0.092, 0.024, 0.146, 0.438, 0.103, -0.059, -0.032, -0.053, 0.045, 0.127, 0.067, 0.090, -0.087, -0.009, 0.037, -0.072, 0.025, 0.044, -0.168, -0.179, 0.147, 0.082, -0.050, -0.055, 0.135, -0.022, 0.028, 0.025, 0.069, -0.106, 0.056, -0.059, -0.152, 0.005, 0.257, 0.039, 0.011, 0.108, -0.171, -0.027, 0.219, -0.105, 0.072, -0.018, 0.047, -0.108, -0.218, 0.080]
}
```

7. Click **"Send"**

### Expected Response:
```json
{
    "success": true,
    "distance": 0.0412,
    "similarity": 0.9588,
    "match": true
}
```

**Status Code:** 200 OK

**✅ These embeddings are very similar (same person)**

---

## Test 5: Batch Scan Multiple Images

### Setup in Postman:
1. Create new request
2. Method: **POST**
3. URL: `http://localhost:3000/api/scanner/batch-scan`
4. Headers: `Content-Type` = `application/json`
5. Body: **raw** → **JSON**
6. Paste:

```json
{
  "imagePaths": [
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg",
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265145_10.jpeg",
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265157_11.jpeg"
  ]
}
```

7. Click **"Send"**

### Expected Response:
```json
{
    "success": true,
    "total": 3,
    "results": [
        {
            "imagePath": "...",
            "success": true,
            "face": { ... }
        },
        {
            "imagePath": "...",
            "success": true,
            "face": { ... }
        },
        {
            "imagePath": "...",
            "success": true,
            "face": { ... }
        }
    ]
}
```

**Status Code:** 200 OK

---

## 📊 Interpreting Results

### Confidence Score
- **0.99**: Excellent! Very clear face
- **0.95+**: Great detection
- **0.80-0.95**: Good detection
- **< 0.80**: Poor quality or unclear

### Similarity (Compare)
- **> 0.95**: Almost certainly same person
- **0.80-0.95**: Very likely same person
- **0.60-0.80**: Probably same person
- **< 0.60**: Different people

### Distance (Compare)
- **< 0.3**: Extremely similar
- **0.3-0.6**: Similar (same person)
- **> 0.6**: Different

---

## 🎯 Quick Test Checklist

- [ ] Test 1: Health Check (GET /health)
- [ ] Test 2: Scan Face (POST /api/scanner/scan)
- [ ] Test 3: Upload Image (POST /api/scanner/upload)
- [ ] Test 4: Compare Embeddings (POST /api/scanner/compare)
- [ ] Test 5: Batch Scan (POST /api/scanner/batch-scan)

---

## ⚠️ Troubleshooting

### "Could not get response"
- ✅ Check server is running: Open http://localhost:3000/health in browser
- ✅ Verify port 3000 is not blocked

### "Image file not found"
- ✅ Use absolute paths: `D:\\path\\to\\image.jpg`
- ✅ Check file exists on your machine
- ✅ Use double backslashes in Windows paths

### "No face detected"
- ✅ Ensure face is visible and frontal
- ✅ Check image isn't corrupted
- ✅ Try a different image

### "Invalid JSON"
- ✅ Check for missing commas
- ✅ Ensure quotes are correct
- ✅ Validate JSON at jsonlint.com

---

## 💡 Pro Tips

1. **Save Requests**
   - Create a collection called "Face Scanner"
   - Save all test requests
   - Easy to re-run later

2. **Use Variables**
   - Create environment
   - Set `baseUrl` = `http://localhost:3000`
   - Set `testImage` = your image path
   - Use `{{baseUrl}}` in URLs

3. **Copy Embeddings**
   - From scan response, copy embedding array
   - Save in notepad
   - Use for comparison tests

4. **Test Different Faces**
   - Scan 2 different people
   - Compare their embeddings
   - Verify similarity is low (< 0.6)

---

## ✅ Verification

All tests passed! You should see:

✅ Health check returns "ok"
✅ Face scan returns 128-number embedding
✅ Confidence > 0.90
✅ Bounding box coordinates present
✅ Compare shows distance and similarity
✅ Batch scan processes multiple images

---

## 📸 Screenshot Locations (For Reference)

When setting up requests, look for:
- **Method dropdown**: Top-left (GET, POST, etc.)
- **URL bar**: Next to method dropdown
- **Headers tab**: Below URL bar
- **Body tab**: Next to Headers
- **Send button**: Blue button on the right
- **Response panel**: Bottom half of screen

---

**🎉 Ready to test! Start with Test 1 (Health Check) to verify everything works.**

**Need help?** Check the server console for errors or review `API_POSTMAN_SIMPLE.md` for detailed documentation.
