# Django Backend API Specification for Electron App

This document specifies the required Django REST API endpoints to support the Electron desktop application with signed URL authentication.

---

## Security Model

**Service Account Credentials:**
- ✅ Stored on Django backend only
- ✅ Never exposed to Electron app
- ✅ Used to generate signed URLs server-side

**Authentication:**
- Electron app authenticates with backend using API key (Bearer token)
- Backend generates short-lived signed URLs (15 minutes)
- Signed URLs cached in Electron app (encrypted)

---

## Required Endpoints

### 1. Authentication & Connection

#### `GET /api/gcs/test-connection`

Test backend connection and GCS bucket access.

**Authentication:** Required (Bearer token)

**Response:**
```json
{
  "success": true,
  "bucketName": "your-image-bucket",
  "hasAccess": true,
  "timestamp": 1706457600000
}
```

**Implementation:**
```python
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from google.cloud import storage
from django.conf import settings

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def test_connection(request):
    try:
        storage_client = storage.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=settings.GCP_CREDENTIALS
        )
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)

        # Test bucket access
        exists = bucket.exists()

        return Response({
            'success': True,
            'bucketName': settings.GCS_BUCKET_NAME,
            'hasAccess': exists,
            'timestamp': int(time.time() * 1000)
        })
    except Exception as e:
        return Response({
            'success': False,
            'error': str(e)
        }, status=500)
```

---

### 2. Signed URL Generation

#### `POST /api/gcs/get-signed-download-url`

Generate signed download URL for a single file.

**Authentication:** Required

**Request:**
```json
{
  "gcsPath": "uploads/event-123/user-456/2026-01-28/IMG_001.jpg"
}
```

**Response:**
```json
{
  "signedUrl": "https://storage.googleapis.com/...",
  "expiresAt": 1706458500,
  "gcsPath": "uploads/event-123/user-456/2026-01-28/IMG_001.jpg"
}
```

**Implementation:**
```python
from datetime import timedelta
from google.cloud import storage
import time

@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_signed_download_url(request):
    gcs_path = request.data.get('gcsPath')

    if not gcs_path:
        return Response({'error': 'gcsPath is required'}, status=400)

    try:
        storage_client = storage.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=settings.GCP_CREDENTIALS
        )
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)

        # Generate signed URL (15 minutes)
        signed_url = blob.generate_signed_url(
            version='v4',
            expiration=timedelta(minutes=15),
            method='GET'
        )

        expires_at = int(time.time()) + (15 * 60)

        return Response({
            'signedUrl': signed_url,
            'expiresAt': expires_at,
            'gcsPath': gcs_path
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

---

#### `POST /api/gcs/get-signed-download-urls-batch`

Generate signed download URLs for multiple files (batch operation).

**Authentication:** Required

**Request:**
```json
{
  "gcsPaths": [
    "uploads/event-123/user-456/2026-01-28/IMG_001.jpg",
    "uploads/event-123/user-456/2026-01-28/IMG_002.jpg"
  ]
}
```

**Response:**
```json
{
  "signedUrls": [
    {
      "gcsPath": "uploads/event-123/user-456/2026-01-28/IMG_001.jpg",
      "signedUrl": "https://storage.googleapis.com/...",
      "expiresAt": 1706458500
    },
    {
      "gcsPath": "uploads/event-123/user-456/2026-01-28/IMG_002.jpg",
      "signedUrl": "https://storage.googleapis.com/...",
      "expiresAt": 1706458500
    }
  ]
}
```

**Implementation:**
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_signed_download_urls_batch(request):
    gcs_paths = request.data.get('gcsPaths', [])

    if not gcs_paths or not isinstance(gcs_paths, list):
        return Response({'error': 'gcsPaths array is required'}, status=400)

    try:
        storage_client = storage.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=settings.GCP_CREDENTIALS
        )
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)

        signed_urls = []
        expires_at = int(time.time()) + (15 * 60)

        for gcs_path in gcs_paths:
            blob = bucket.blob(gcs_path)
            signed_url = blob.generate_signed_url(
                version='v4',
                expiration=timedelta(minutes=15),
                method='GET'
            )

            signed_urls.append({
                'gcsPath': gcs_path,
                'signedUrl': signed_url,
                'expiresAt': expires_at
            })

        return Response({'signedUrls': signed_urls})
    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

---

#### `POST /api/gcs/get-signed-upload-url`

Generate signed upload URL (for uploading processed results back to GCS).

**Authentication:** Required

**Request:**
```json
{
  "gcsPath": "processed/event-123/results.json",
  "contentType": "application/json"
}
```

**Response:**
```json
{
  "signedUrl": "https://storage.googleapis.com/...",
  "expiresAt": 1706458500
}
```

**Implementation:**
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def get_signed_upload_url(request):
    gcs_path = request.data.get('gcsPath')
    content_type = request.data.get('contentType', 'application/octet-stream')

    if not gcs_path:
        return Response({'error': 'gcsPath is required'}, status=400)

    try:
        storage_client = storage.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=settings.GCP_CREDENTIALS
        )
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)
        blob = bucket.blob(gcs_path)

        # Generate signed URL for upload (15 minutes)
        signed_url = blob.generate_signed_url(
            version='v4',
            expiration=timedelta(minutes=15),
            method='PUT',
            content_type=content_type
        )

        expires_at = int(time.time()) + (15 * 60)

        return Response({
            'signedUrl': signed_url,
            'expiresAt': expires_at
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

---

### 3. File Listing

#### `POST /api/gcs/list-files`

List files in GCS bucket.

**Authentication:** Required

**Request:**
```json
{
  "prefix": "uploads/",
  "delimiter": null,
  "maxResults": 1000,
  "pageToken": null
}
```

**Response:**
```json
{
  "files": [
    {
      "name": "uploads/event-123/user-456/2026-01-28/IMG_001.jpg",
      "size": 2048576,
      "contentType": "image/jpeg",
      "md5Hash": "5d41402abc4b2a76b9719d911017c592",
      "updated": "2026-01-28T10:00:00Z",
      "metadata": {
        "eventId": "event-123",
        "userId": "user-456"
      }
    }
  ],
  "nextPageToken": null
}
```

**Implementation:**
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def list_files(request):
    prefix = request.data.get('prefix', 'uploads/')
    delimiter = request.data.get('delimiter')
    max_results = request.data.get('maxResults', 1000)
    page_token = request.data.get('pageToken')

    try:
        storage_client = storage.Client(
            project=settings.GCP_PROJECT_ID,
            credentials=settings.GCP_CREDENTIALS
        )
        bucket = storage_client.bucket(settings.GCS_BUCKET_NAME)

        blobs = bucket.list_blobs(
            prefix=prefix,
            delimiter=delimiter,
            max_results=max_results,
            page_token=page_token
        )

        files = []
        for blob in blobs:
            files.append({
                'name': blob.name,
                'size': blob.size,
                'contentType': blob.content_type,
                'md5Hash': blob.md5_hash,
                'updated': blob.updated.isoformat(),
                'metadata': blob.metadata or {}
            })

        return Response({
            'files': files,
            'nextPageToken': blobs.next_page_token
        })
    except Exception as e:
        return Response({'error': str(e)}, status=500)
```

---

### 4. Processing Results Sync

#### `POST /api/processing/sync-results`

Sync processing results from Electron app to backend.

**Authentication:** Required

**Request:**
```json
{
  "results": [
    {
      "imageId": 123,
      "gcsPath": "uploads/event-123/user-456/2026-01-28/IMG_001.jpg",
      "facesDetected": 3,
      "faceData": [
        {
          "x": 100,
          "y": 150,
          "width": 80,
          "height": 80,
          "confidence": 0.95
        }
      ],
      "classifications": [
        { "label": "outdoor", "confidence": 0.87 },
        { "label": "daytime", "confidence": 0.92 }
      ],
      "processingTimeMs": 1250
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "synced": 1,
  "failed": 0
}
```

**Implementation:**
```python
@api_view(['POST'])
@permission_classes([IsAuthenticated])
def sync_processing_results(request):
    results = request.data.get('results', [])

    synced = 0
    failed = 0

    for result in results:
        try:
            # Save to database
            ProcessingResult.objects.update_or_create(
                image_id=result['imageId'],
                defaults={
                    'faces_detected': result.get('facesDetected', 0),
                    'face_data': result.get('faceData', []),
                    'classifications': result.get('classifications', []),
                    'processing_time_ms': result.get('processingTimeMs')
                }
            )
            synced += 1
        except Exception as e:
            failed += 1
            print(f"Failed to sync result: {e}")

    return Response({
        'success': True,
        'synced': synced,
        'failed': failed
    })
```

---

### 5. Sync Status

#### `GET /api/sync/status`

Get overall sync status.

**Authentication:** Required

**Response:**
```json
{
  "lastSyncTime": 1706457600000,
  "totalImages": 1247,
  "processedImages": 842,
  "pendingImages": 405
}
```

---

### 6. Events & Collections

#### `GET /api/events`

Get all events.

**Authentication:** Required

**Response:**
```json
{
  "events": [
    {
      "id": "event-123",
      "name": "Wedding 2026",
      "date": "2026-01-28",
      "imageCount": 247
    }
  ]
}
```

---

## Django Settings Configuration

Add to `settings.py`:

```python
# GCP Configuration
import os
from google.oauth2 import service_account

GCP_PROJECT_ID = os.getenv('GCP_PROJECT_ID', 'your-project-id')
GCS_BUCKET_NAME = os.getenv('GCS_BUCKET_NAME', 'your-bucket-name')

# Load service account credentials
GCP_SERVICE_ACCOUNT_FILE = os.getenv(
    'GCP_SERVICE_ACCOUNT_FILE',
    '/path/to/service-account-key.json'
)

GCP_CREDENTIALS = service_account.Credentials.from_service_account_file(
    GCP_SERVICE_ACCOUNT_FILE,
    scopes=['https://www.googleapis.com/auth/cloud-platform']
)
```

---

## URL Configuration

Add to `urls.py`:

```python
from django.urls import path
from . import gcs_views, processing_views

urlpatterns = [
    # GCS endpoints
    path('gcs/test-connection', gcs_views.test_connection),
    path('gcs/get-signed-download-url', gcs_views.get_signed_download_url),
    path('gcs/get-signed-download-urls-batch', gcs_views.get_signed_download_urls_batch),
    path('gcs/get-signed-upload-url', gcs_views.get_signed_upload_url),
    path('gcs/list-files', gcs_views.list_files),

    # Processing endpoints
    path('processing/sync-results', processing_views.sync_processing_results),

    # Sync endpoints
    path('sync/status', gcs_views.get_sync_status),

    # Events endpoints
    path('events', gcs_views.get_events),
    path('events/<str:event_id>', gcs_views.get_event_details),
]
```

---

## Security Considerations

1. **API Authentication:**
   - Use Django REST Framework token authentication
   - Or implement API key authentication
   - Rate limiting recommended

2. **Service Account Permissions:**
   - Read-only for listing files
   - Generate signed URLs capability
   - Never expose service account JSON to client

3. **Signed URL Expiration:**
   - Recommended: 15 minutes
   - Balance between security and usability

4. **CORS Configuration:**
   - Not needed (Electron app is not a browser)
   - But useful if also supporting web uploads

---

## Installation Requirements

```bash
pip install google-cloud-storage
pip install djangorestframework
```

---

## Testing

Use curl to test endpoints:

```bash
# Test connection
curl -X GET http://localhost:8000/api/gcs/test-connection \
  -H "Authorization: Bearer YOUR_API_KEY"

# Get signed URL
curl -X POST http://localhost:8000/api/gcs/get-signed-download-url \
  -H "Authorization: Bearer YOUR_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"gcsPath": "uploads/test.jpg"}'
```

---

**End of API Specification**
