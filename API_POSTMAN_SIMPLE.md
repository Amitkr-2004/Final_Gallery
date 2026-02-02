# Face Scanner API - Simple Version (Postman Guide)

## 🚀 Quick Start

The API server is already running on: **http://localhost:3000**

---

## 📋 Available Endpoints

### 1. Health Check
**GET** `http://localhost:3000/health`

Test if server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T10:30:00.000Z",
  "services": {
    "faceScanner": true,
    "note": "Simplified API - database features disabled"
  }
}
```

---

### 2. API Information
**GET** `http://localhost:3000/api/info`

Get information about available endpoints.

---

### 3. Scan Face from Path
**POST** `http://localhost:3000/api/scanner/scan`

**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```

**Response:**
```json
{
  "success": true,
  "face": {
    "embedding": [0.123, -0.456, ...], // 128 values
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

---

### 4. Upload and Scan Image
**POST** `http://localhost:3000/api/scanner/upload`

**Body Type:** `form-data`

**Form Data:**
- `image` (File): Select an image file

**Postman Steps:**
1. Select **POST** method
2. URL: `http://localhost:3000/api/scanner/upload`
3. Body tab → select **form-data**
4. Add key `image` and change type to **File**
5. Select your image file
6. Click **Send**

**Response:** Same as `/api/scanner/scan`

---

### 5. Compare Embeddings
**POST** `http://localhost:3000/api/scanner/compare`

**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "embedding1": [0.123, -0.456, ...], // 128 values
  "embedding2": [0.234, -0.567, ...]  // 128 values
}
```

**Response:**
```json
{
  "success": true,
  "distance": 0.42,
  "similarity": 0.58,
  "match": true
}
```

---

### 6. Batch Scan Multiple Images
**POST** `http://localhost:3000/api/scanner/batch-scan`

**Headers:**
- `Content-Type: application/json`

**Body (JSON):**
```json
{
  "imagePaths": [
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\image1.jpeg",
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\image2.jpeg",
    "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\image3.jpeg"
  ]
}
```

**Response:**
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
      "success": false,
      "error": "No face detected"
    }
  ]
}
```

---

## 🧪 Quick Test in Postman

### Test 1: Health Check
```
Method: GET
URL: http://localhost:3000/health
```
Expected: `status: "ok"`

### Test 2: Scan a Face
```
Method: POST
URL: http://localhost:3000/api/scanner/scan
Headers: Content-Type: application/json
Body:
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
}
```

Expected: Face embedding with 128 values

### Test 3: Upload Image
```
Method: POST
URL: http://localhost:3000/api/scanner/upload
Body: form-data
  - image: <select a JPG/PNG file>
```

Expected: Face detection result

---

## 📝 Postman Collection JSON

Import this into Postman:

```json
{
  "info": {
    "name": "Face Scanner API - Simple",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "testImagePath",
      "value": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{baseUrl}}/health"
      }
    },
    {
      "name": "API Info",
      "request": {
        "method": "GET",
        "header": [],
        "url": "{{baseUrl}}/api/info"
      }
    },
    {
      "name": "Scan Face",
      "request": {
        "method": "POST",
        "header": [
          {
            "key": "Content-Type",
            "value": "application/json"
          }
        ],
        "body": {
          "mode": "raw",
          "raw": "{\n  \"imagePath\": \"{{testImagePath}}\"\n}"
        },
        "url": "{{baseUrl}}/api/scanner/scan"
      }
    },
    {
      "name": "Upload and Scan",
      "request": {
        "method": "POST",
        "header": [],
        "body": {
          "mode": "formdata",
          "formdata": [
            {
              "key": "image",
              "type": "file",
              "src": ""
            }
          ]
        },
        "url": "{{baseUrl}}/api/scanner/upload"
      }
    }
  ]
}
```

---

## ⚠️ Important Notes

1. **Image Paths**: Must be absolute paths on the server machine
   - ✅ Correct: `D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\image.jpg`
   - ❌ Wrong: `./uploads/image.jpg`

2. **File Upload**: Max 10MB per file

3. **Embedding Format**: Must be array of exactly 128 numbers

4. **Response Time**: Face detection takes ~500ms per image

---

## 🔍 Common Errors

### "Image file not found"
- Check path is absolute
- Verify file exists
- Use double backslashes in Windows paths

### "No face detected"
- Ensure face is visible and frontal
- Check image quality
- Try different image

### "Cannot read property of undefined"
- Check JSON format
- Verify required fields are present

---

## 💡 Tips

1. **Save Variables** in Postman:
   - Set `baseUrl` = `http://localhost:3000`
   - Set `testImagePath` = path to your test image

2. **Save Embeddings**:
   - Copy embedding from scan response
   - Use in compare endpoint

3. **Test Workflow**:
   - Health check → Scan face → Compare embeddings

---

## 🎯 Example Workflow

1. **Health Check**
   ```
   GET /health
   ```

2. **Scan First Image**
   ```
   POST /api/scanner/scan
   Body: { "imagePath": "path/to/image1.jpg" }
   ```
   → Copy embedding from response

3. **Scan Second Image**
   ```
   POST /api/scanner/scan
   Body: { "imagePath": "path/to/image2.jpg" }
   ```
   → Copy embedding from response

4. **Compare Embeddings**
   ```
   POST /api/scanner/compare
   Body: {
     "embedding1": [...],
     "embedding2": [...]
   }
   ```
   → See if they match (similarity > 0.6)

---

## 📊 Understanding Results

### Confidence Score
- **> 0.95**: Excellent face detection
- **0.80 - 0.95**: Good face detection
- **< 0.80**: Poor quality or unclear face

### Similarity Score (in compare)
- **> 0.8**: Very likely same person
- **0.6 - 0.8**: Probably same person
- **0.4 - 0.6**: Maybe same person
- **< 0.4**: Different people

### Distance
- **< 0.4**: Very similar
- **0.4 - 0.6**: Similar (default threshold)
- **> 0.6**: Different

---

**Server Status**: 🟢 Running on http://localhost:3000
