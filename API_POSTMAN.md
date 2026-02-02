# Face Scanner API - Postman Documentation

REST API wrapper for testing Face Scanner functionality with Postman.

## Server Setup

### 1. Start the API Server

```bash
cd electron-app
node api-server.js
```

Server will start on: **http://localhost:3000**

### 2. Verify Server is Running

Open browser: http://localhost:3000/health

Expected response:
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T10:30:00.000Z",
  "services": {
    "faceScanner": true,
    "database": true,
    "logger": true
  }
}
```

---

## API Endpoints

### Base URL
```
http://localhost:3000
```

---

## 1. Health Check

**GET** `/health`

Check if server and services are running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-02-02T10:30:00.000Z",
  "services": {
    "faceScanner": true,
    "database": true,
    "logger": true
  }
}
```

---

## 2. Get Statistics

**GET** `/api/stats`

Get database statistics.

**Response:**
```json
{
  "success": true,
  "stats": {
    "images": {
      "total": 100,
      "processed": 95,
      "synced": 80
    },
    "faces": {
      "total": 150
    },
    "collections": {
      "total": 50
    }
  }
}
```

---

## 3. List Images

**GET** `/api/images?limit=10&offset=0`

List all images in the database.

**Query Parameters:**
- `limit` (optional): Number of results (default: 10)
- `offset` (optional): Pagination offset (default: 0)

**Response:**
```json
{
  "success": true,
  "total": 100,
  "limit": 10,
  "offset": 0,
  "images": [
    {
      "image_id": "abc-123",
      "file_name": "photo.jpg",
      "file_path": "D:\\...\\uploads\\photo.jpg",
      "processing_status": "completed",
      "sync_status": "completed",
      "created_at": "2026-02-02T10:00:00.000Z"
    }
  ]
}
```

---

## 4. List Collections

**GET** `/api/collections`

List all face collections.

**Response:**
```json
{
  "success": true,
  "count": 50,
  "collections": [
    {
      "collection_id": "collection-abc",
      "name": "Person 1",
      "total_faces": 15,
      "created_at": "2026-02-01T10:00:00.000Z",
      "updated_at": "2026-02-02T10:00:00.000Z"
    }
  ]
}
```

---

## 5. Get Collection Details

**GET** `/api/collections/:id`

Get detailed information about a specific collection.

**Example:**
```
GET /api/collections/collection-abc
```

**Response:**
```json
{
  "success": true,
  "collection": {
    "collection_id": "collection-abc",
    "name": "Person 1",
    "total_faces": 15,
    "created_at": "2026-02-01T10:00:00.000Z",
    "faces": [
      {
        "face_id": "face-123",
        "image_id": "img-456",
        "confidence": 0.98,
        "similarity_score": 0.85,
        "is_representative": 1
      }
    ]
  }
}
```

---

## 6. Scan Face

**POST** `/api/scanner/scan`

Scan a face from an image file path and generate embedding.

**Request Body:**
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
    "confidence": 0.98,
    "boundingBox": {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 250
    },
    "landmarks": [
      { "x": 120, "y": 180 },
      { "x": 180, "y": 185 }
    ]
  }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "No face detected in the image"
}
```

---

## 7. Scan and Match (Complete Workflow)

**POST** `/api/scanner/match`

Scan a face and match against collections in one request.

**Request Body:**
```json
{
  "imagePath": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg",
  "threshold": 0.6,
  "limit": 10,
  "searchMode": "local"
}
```

**Parameters:**
- `imagePath` (required): Absolute path to image file
- `threshold` (optional): Similarity threshold 0-1 (default: 0.6)
- `limit` (optional): Max results (default: 10)
- `searchMode` (optional): "local" or "gcs" (default: "local")

**Response:**
```json
{
  "success": true,
  "scanned_face": {
    "confidence": 0.98,
    "boundingBox": {
      "x": 100,
      "y": 150,
      "width": 200,
      "height": 250
    }
  },
  "matches": [
    {
      "collection_id": "collection-abc",
      "collection_name": "Person 1",
      "total_faces": 15,
      "image_ids": ["img1", "img2", "img3"],
      "match": {
        "face_id": "face-xyz",
        "image_id": "img1",
        "distance": 0.42,
        "similarity": 0.58,
        "confidence": 0.95,
        "is_representative": true,
        "matched_at": "2026-02-02T10:30:00.000Z"
      }
    }
  ],
  "stats": {
    "total_collections_scanned": 50,
    "total_matches_found": 3,
    "threshold_used": 0.6,
    "search_mode": "local"
  }
}
```

---

## 8. Upload and Scan

**POST** `/api/scanner/upload`

Upload an image file and scan in one request.

**Request Type:** `multipart/form-data`

**Form Data:**
- `image` (file): Image file to upload
- `threshold` (optional): Similarity threshold (default: 0.6)
- `limit` (optional): Max results (default: 10)
- `searchMode` (optional): "local" or "gcs" (default: "local")

**Postman Setup:**
1. Select **POST** method
2. URL: `http://localhost:3000/api/scanner/upload`
3. Go to **Body** tab
4. Select **form-data**
5. Add key `image` with type **File**
6. Choose your image file
7. Add optional parameters: `threshold`, `limit`, `searchMode`

**Response:** Same as `/api/scanner/match`

---

## 9. Search with Embedding

**POST** `/api/scanner/search`

Search collections using a pre-computed embedding.

**Request Body:**
```json
{
  "embedding": [0.123, -0.456, ...], // 128-dim array
  "threshold": 0.6,
  "limit": 10,
  "searchMode": "local"
}
```

**Response:**
```json
{
  "success": true,
  "matches": [
    {
      "collection_id": "collection-abc",
      "collection_name": "Person 1",
      "total_faces": 15,
      "match": {
        "similarity": 0.85,
        "distance": 0.15
      }
    }
  ],
  "stats": {
    "total_collections_scanned": 50,
    "total_matches_found": 2,
    "threshold_used": 0.6,
    "search_mode": "local"
  }
}
```

---

## Postman Collection

### Import this JSON into Postman:

```json
{
  "info": {
    "name": "Face Scanner API",
    "schema": "https://schema.getpostman.com/json/collection/v2.1.0/collection.json"
  },
  "variable": [
    {
      "key": "baseUrl",
      "value": "http://localhost:3000"
    },
    {
      "key": "imagePath",
      "value": "D:\\Gallery_VSCode\\electron-app\\app-data\\uploads\\2026-01-30_1769775265114_1.jpeg"
    }
  ],
  "item": [
    {
      "name": "Health Check",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/health",
          "host": ["{{baseUrl}}"],
          "path": ["health"]
        }
      }
    },
    {
      "name": "Get Stats",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/stats",
          "host": ["{{baseUrl}}"],
          "path": ["api", "stats"]
        }
      }
    },
    {
      "name": "List Collections",
      "request": {
        "method": "GET",
        "header": [],
        "url": {
          "raw": "{{baseUrl}}/api/collections",
          "host": ["{{baseUrl}}"],
          "path": ["api", "collections"]
        }
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
          "raw": "{\n  \"imagePath\": \"{{imagePath}}\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/scanner/scan",
          "host": ["{{baseUrl}}"],
          "path": ["api", "scanner", "scan"]
        }
      }
    },
    {
      "name": "Scan and Match",
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
          "raw": "{\n  \"imagePath\": \"{{imagePath}}\",\n  \"threshold\": 0.6,\n  \"limit\": 5,\n  \"searchMode\": \"local\"\n}"
        },
        "url": {
          "raw": "{{baseUrl}}/api/scanner/match",
          "host": ["{{baseUrl}}"],
          "path": ["api", "scanner", "match"]
        }
      }
    }
  ]
}
```

---

## Testing Workflow

### 1. Basic Test Flow

```
1. GET /health               → Verify server is running
2. GET /api/stats            → Check database has data
3. GET /api/collections      → Get collection list
4. GET /api/images?limit=1   → Get a test image path
5. POST /api/scanner/match   → Scan and match the image
```

### 2. Quick Test in Postman

**Step 1:** Health Check
- Method: GET
- URL: `http://localhost:3000/health`
- Expected: `status: "ok"`

**Step 2:** Get Test Image
- Method: GET
- URL: `http://localhost:3000/api/images?limit=1`
- Copy `file_path` from response

**Step 3:** Scan and Match
- Method: POST
- URL: `http://localhost:3000/api/scanner/match`
- Body (JSON):
```json
{
  "imagePath": "<paste file_path here>",
  "threshold": 0.6,
  "limit": 5,
  "searchMode": "local"
}
```

---

## Threshold Guidelines

- **0.4** - Very strict (same photo, slight variations)
- **0.6** - Recommended (same person, different photos)
- **0.8** - Loose (may include similar-looking people)

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad Request (missing parameters) |
| 404 | Not Found (image/collection not found) |
| 500 | Internal Server Error |

---

## Common Errors

### "Image file not found"
- Check the `imagePath` is correct
- Use absolute path (e.g., `D:\\...\\image.jpg`)
- Ensure file exists on the server machine

### "No face detected"
- Try a different image with clear face
- Check image is not corrupted
- Face should be frontal and well-lit

### "Services not initialized"
- Server may still be starting up
- Wait 5 seconds and try again
- Check server console for errors

---

## Performance Notes

- **Local search**: ~500ms for 50 collections
- **GCS search**: ~5s for 50 collections (network dependent)
- **Face detection**: ~500ms per image
- **Upload**: Limited to 10MB file size

---

## Tips

1. **Use Variables** in Postman:
   - Set `baseUrl` = `http://localhost:3000`
   - Set `imagePath` = your test image path

2. **Save Responses**:
   - Save embedding from `/scan` endpoint
   - Reuse in `/search` endpoint

3. **Test Different Thresholds**:
   - Start with 0.6
   - Adjust based on results

---

**Server must be running** for these endpoints to work!

Start with: `node api-server.js`
