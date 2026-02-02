# Enhanced Face Scanner API - Postman Testing Guide

## 🚀 Server Running

**Base URL:** http://localhost:3001
**Status:** ✅ Active with GCS collection matching
**Collections:** 116 uploaded to GCS

---

## ⭐ NEW ENDPOINT: Match Face Against Collections

### POST /api/scanner/match

The main endpoint for face recognition - upload an image and find matching collections!

#### Method 1: Upload Image File (Recommended)

**Setup in Postman:**
1. Method: **POST**
2. URL: `http://localhost:3001/api/scanner/match`
3. Body tab → **form-data**
4. Add fields:
   - Key: `image` | Type: **File** | Value: Select your image
   - Key: `threshold` | Type: Text | Value: `0.6` (optional)
   - Key: `limit` | Type: Text | Value: `10` (optional)
5. Click **Send**

**Response:**
```json
{
    "success": true,
    "scanned_face": {
        "confidence": 0.9915,
        "boundingBox": {
            "x": 78.73,
            "y": 497.80,
            "width": 55.55,
            "height": 78.91
        }
    },
    "matches": [
        {
            "collection_id": "abc-123-def-456",
            "collection_name": "Person Name",
            "total_faces": 15,
            "image_ids": ["img1", "img2", "img3"],
            "match": {
                "face_id": "face-xyz",
                "image_id": "img1",
                "distance": 0.42,
                "similarity": 0.58,
                "confidence": 0.95,
                "is_representative": true,
                "matched_at": "2026-02-02T09:43:00.000Z"
            }
        }
    ],
    "stats": {
        "total_collections_scanned": 116,
        "total_matches_found": 3,
        "threshold_used": 0.6,
        "cached": false
    }
}
```

#### Method 2: Use Image Path

**Setup in Postman:**
1. Method: **POST**
2. URL: `http://localhost:3001/api/scanner/match`
3. Headers: `Content-Type: application/json`
4. Body tab → **raw** → **JSON**
5. Paste:
```json
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg",
  "threshold": 0.6,
  "limit": 10
}
```
6. Click **Send**

---

## 📋 Other Endpoints

### 1. Health Check
```
GET http://localhost:3001/health
```

**Response:**
```json
{
    "status": "ok",
    "timestamp": "2026-02-02T09:43:01.397Z",
    "services": {
        "faceScanner": true,
        "gcs": true,
        "collectionsLoaded": true
    }
}
```

---

### 2. API Information
```
GET http://localhost:3001/api/info
```

Shows all available endpoints and features.

---

### 3. List All Collections
```
GET http://localhost:3001/api/collections
```

**Response:**
```json
{
    "success": true,
    "count": 116,
    "cached": false,
    "collections": [
        {
            "collection_id": "abc-123",
            "name": "Person 1",
            "total_faces": 15,
            "image_count": 8,
            "synced_at": "2026-02-02T08:51:00.000Z"
        }
    ]
}
```

---

### 4. Refresh Collections Cache
```
POST http://localhost:3001/api/collections/refresh
```

Use this if you uploaded new collections to GCS and want to reload them.

---

### 5. Scan Face Only (No Matching)
```
POST http://localhost:3001/api/scanner/upload
Body: form-data
  - image: [file]
```

Returns face detection and embedding without searching collections.

---

### 6. Compare Two Embeddings
```
POST http://localhost:3001/api/scanner/compare
Headers: Content-Type: application/json
Body:
{
  "embedding1": [0.1, 0.2, ...], // 128 numbers
  "embedding2": [0.09, 0.19, ...] // 128 numbers
}
```

---

## 🎯 Complete Test Workflow

### Step 1: Verify Server
```
GET http://localhost:3001/health
```
✅ Check: `status: "ok"` and `gcs: true`

### Step 2: Check Collections
```
GET http://localhost:3001/api/collections
```
✅ Verify: Shows 116 collections

### Step 3: Match a Face
```
POST http://localhost:3001/api/scanner/match
Body: form-data
  - image: [select a photo with a face]
  - threshold: 0.6
  - limit: 10
```
✅ See matching collections!

---

## 📊 Understanding Results

### Threshold Values
- **0.4** - Very strict (only exact matches)
- **0.6** - Recommended (same person, different photos)
- **0.8** - Loose (may include similar-looking people)

### Similarity Score
- **> 0.8** - Very likely same person (85%+ match)
- **0.6-0.8** - Probably same person (60-80% match)
- **< 0.6** - Different people

### Distance Score
- **< 0.3** - Extremely similar
- **0.3-0.6** - Similar (same person)
- **> 0.6** - Different people

---

## 🔥 Quick Test (Copy-Paste)

### Test in Browser
Open: http://localhost:3001/health

### Test in Postman
1. **Method:** POST
2. **URL:** `http://localhost:3001/api/scanner/match`
3. **Body:** form-data
   - `image` (File): Select a face photo
4. **Send**

---

## 💡 Tips

### For Best Results:
- ✅ Use clear, frontal face photos
- ✅ Good lighting
- ✅ Face should be main subject
- ✅ Not too far from camera

### Performance:
- First request: ~2-3 seconds (loads 116 collections from GCS)
- Subsequent requests: ~500ms (uses cache)
- Cache duration: 5 minutes

### Troubleshooting:
- **No face detected**: Use clearer photo
- **No matches found**: Try higher threshold (0.7 or 0.8)
- **GCS error**: Check `.env` credentials
- **Timeout**: First request may be slow (loading collections)

---

## 🆚 Two Servers Comparison

| Feature | Port 3000 (Simple) | Port 3001 (Enhanced) |
|---------|-------------------|---------------------|
| Face Detection | ✅ | ✅ |
| Embedding Generation | ✅ | ✅ |
| Compare Embeddings | ✅ | ✅ |
| **Collection Matching** | ❌ | ✅ |
| **Search Collections** | ❌ | ✅ |
| **List Collections** | ❌ | ✅ |
| Database Access | ❌ | ❌ (uses GCS) |

**Use Port 3001 for full features!** ⭐

---

## 📸 Example Test Images

Use these paths for testing (if using imagePath):
```
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265114_1.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265145_10.jpeg
D:\Gallery_VSCode\electron-app\app-data\uploads\2026-01-30_1769775265157_11.jpeg
```

Or upload your own images!

---

## ✅ Success Checklist

- [ ] Server health check passes
- [ ] Collections list shows 116 items
- [ ] Face detection works with uploaded image
- [ ] Match endpoint returns collections
- [ ] Similarity scores make sense
- [ ] Can adjust threshold to get more/fewer results

---

## 🎉 Ready to Test!

**Main endpoint:** `POST http://localhost:3001/api/scanner/match`

**What you need:**
1. Postman open
2. A photo with a face
3. 2 minutes to test

**What you'll get:**
- Face detection results
- Matching collections
- Similarity scores
- Complete match details

---

**Start with the health check, then try the match endpoint!** 🚀

**Server:** http://localhost:3001
**Docs:** http://localhost:3001/api/info
