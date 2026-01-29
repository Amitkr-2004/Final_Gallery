"""
Google Cloud Storage Upload API Views
Provides signed URL generation for Electron app uploads
"""

import os
import logging
import uuid
from datetime import timedelta
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
from google.cloud import storage
from google.oauth2 import service_account

logger = logging.getLogger(__name__)


def get_gcs_client():
    """
    Initialize and return Google Cloud Storage client.

    Returns:
        storage.Client: Authenticated GCS client

    Raises:
        ValueError: If GCS configuration is missing
    """
    # Get service account credentials path from environment
    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

    if not credentials_path or not os.path.exists(credentials_path):
        raise ValueError(
            "Google Cloud credentials not found. "
            "Set GOOGLE_APPLICATION_CREDENTIALS environment variable."
        )

    # Load credentials
    credentials = service_account.Credentials.from_service_account_file(
        credentials_path,
        scopes=['https://www.googleapis.com/auth/cloud-platform']
    )

    # Create and return storage client
    project_id = os.getenv('GCS_PROJECT_ID')
    return storage.Client(credentials=credentials, project=project_id)


def generate_signed_upload_url(
    bucket_name: str,
    blob_name: str,
    content_type: str = 'image/jpeg',
    expiration_minutes: int = 60
):
    """
    Generate a signed URL for uploading a file to GCS.

    Args:
        bucket_name: GCS bucket name
        blob_name: Full path in bucket (e.g., 'uploads/event1/user1/2026-01-28/uuid_image.jpg')
        content_type: MIME type of the file
        expiration_minutes: URL validity duration in minutes

    Returns:
        dict: Contains signed_url, blob_name, expires_at

    Raises:
        Exception: If URL generation fails
    """
    try:
        client = get_gcs_client()
        bucket = client.bucket(bucket_name)
        blob = bucket.blob(blob_name)

        # Generate signed URL for upload (PUT method)
        url = blob.generate_signed_url(
            version="v4",
            expiration=timedelta(minutes=expiration_minutes),
            method="PUT",
            content_type=content_type
        )

        logger.info(f"Generated upload signed URL for: {blob_name}")

        return {
            'signed_url': url,
            'blob_name': blob_name,
            'bucket_name': bucket_name,
            'content_type': content_type,
            'expires_in_minutes': expiration_minutes
        }

    except Exception as e:
        logger.error(f"Failed to generate signed upload URL: {str(e)}")
        raise


@api_view(['POST'])
def get_signed_upload_url(request):
    """
    Generate a single signed URL for file upload.

    Request Body:
    {
        "filename": "image.jpg",
        "content_type": "image/jpeg",
        "event_id": "event123",
        "user_id": "user456",
        "date": "2026-01-28",
        "file_size": 1048576  (optional, for validation)
    }

    Response:
    {
        "signed_url": "https://storage.googleapis.com/...",
        "gcs_path": "uploads/event123/user456/2026-01-28/uuid_image.jpg",
        "blob_name": "uploads/event123/user456/2026-01-28/uuid_image.jpg",
        "expires_in_minutes": 60
    }
    """
    try:
        # Extract parameters
        filename = request.data.get('filename')
        content_type = request.data.get('content_type', 'image/jpeg')
        event_id = request.data.get('event_id')
        user_id = request.data.get('user_id')
        date = request.data.get('date')
        file_size = request.data.get('file_size', 0)

        # Validate required fields
        if not all([filename, event_id, user_id, date]):
            return Response({
                'error': 'Missing required fields',
                'required': ['filename', 'event_id', 'user_id', 'date']
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate file size (optional, if provided)
        max_size_mb = getattr(settings, 'MAX_IMAGE_SIZE_MB', 50)
        max_size_bytes = max_size_mb * 1024 * 1024

        if file_size > max_size_bytes:
            return Response({
                'error': f'File size exceeds maximum allowed size of {max_size_mb}MB',
                'file_size': file_size,
                'max_size': max_size_bytes
            }, status=status.HTTP_400_BAD_REQUEST)

        # Generate unique filename with UUID to prevent collisions
        file_extension = os.path.splitext(filename)[1] or '.jpg'
        unique_filename = f"{uuid.uuid4()}{file_extension}"

        # Construct GCS blob path: uploads/{eventId}/{userId}/{date}/{uuid_filename}
        blob_name = f"uploads/{event_id}/{user_id}/{date}/{unique_filename}"

        # Get bucket name from settings
        bucket_name = os.getenv('GCS_BUCKET_NAME')
        if not bucket_name:
            return Response({
                'error': 'GCS bucket not configured'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Generate signed URL
        result = generate_signed_upload_url(
            bucket_name=bucket_name,
            blob_name=blob_name,
            content_type=content_type,
            expiration_minutes=60
        )

        return Response({
            'signed_url': result['signed_url'],
            'gcs_path': blob_name,
            'blob_name': blob_name,
            'bucket_name': bucket_name,
            'original_filename': filename,
            'unique_filename': unique_filename,
            'content_type': content_type,
            'expires_in_minutes': result['expires_in_minutes']
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({
            'error': 'Configuration error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"Error generating signed upload URL: {str(e)}")
        return Response({
            'error': 'Failed to generate upload URL',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def get_signed_upload_urls_batch(request):
    """
    Generate multiple signed URLs for batch file upload.

    Request Body:
    {
        "files": [
            {
                "filename": "image1.jpg",
                "content_type": "image/jpeg",
                "event_id": "event123",
                "user_id": "user456",
                "date": "2026-01-28",
                "file_size": 1048576
            },
            ...
        ]
    }

    Response:
    {
        "urls": [
            {
                "signed_url": "https://storage.googleapis.com/...",
                "gcs_path": "uploads/...",
                "original_filename": "image1.jpg",
                "unique_filename": "uuid_image1.jpg"
            },
            ...
        ],
        "total": 10,
        "successful": 9,
        "failed": 1,
        "errors": [...]
    }
    """
    try:
        files = request.data.get('files', [])

        if not files or not isinstance(files, list):
            return Response({
                'error': 'Invalid request',
                'details': 'Expected "files" array in request body'
            }, status=status.HTTP_400_BAD_REQUEST)

        # Validate batch size
        max_batch_size = getattr(settings, 'MAX_UPLOAD_BATCH_SIZE', 100)
        if len(files) > max_batch_size:
            return Response({
                'error': f'Batch size exceeds maximum of {max_batch_size} files'
            }, status=status.HTTP_400_BAD_REQUEST)

        bucket_name = os.getenv('GCS_BUCKET_NAME')
        if not bucket_name:
            return Response({
                'error': 'GCS bucket not configured'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        results = []
        errors = []
        successful = 0

        for idx, file_info in enumerate(files):
            try:
                # Extract file info
                filename = file_info.get('filename')
                content_type = file_info.get('content_type', 'image/jpeg')
                event_id = file_info.get('event_id')
                user_id = file_info.get('user_id')
                date = file_info.get('date')
                file_size = file_info.get('file_size', 0)

                # Validate required fields
                if not all([filename, event_id, user_id, date]):
                    errors.append({
                        'index': idx,
                        'filename': filename,
                        'error': 'Missing required fields'
                    })
                    continue

                # Validate file size
                max_size_mb = getattr(settings, 'MAX_IMAGE_SIZE_MB', 50)
                max_size_bytes = max_size_mb * 1024 * 1024

                if file_size > max_size_bytes:
                    errors.append({
                        'index': idx,
                        'filename': filename,
                        'error': f'File size exceeds {max_size_mb}MB'
                    })
                    continue

                # Generate unique filename
                file_extension = os.path.splitext(filename)[1] or '.jpg'
                unique_filename = f"{uuid.uuid4()}{file_extension}"

                # Construct GCS path
                blob_name = f"uploads/{event_id}/{user_id}/{date}/{unique_filename}"

                # Generate signed URL
                result = generate_signed_upload_url(
                    bucket_name=bucket_name,
                    blob_name=blob_name,
                    content_type=content_type,
                    expiration_minutes=60
                )

                results.append({
                    'signed_url': result['signed_url'],
                    'gcs_path': blob_name,
                    'blob_name': blob_name,
                    'original_filename': filename,
                    'unique_filename': unique_filename,
                    'content_type': content_type,
                    'file_size': file_size,
                    'index': idx
                })

                successful += 1

            except Exception as e:
                logger.error(f"Failed to generate URL for file {idx}: {str(e)}")
                errors.append({
                    'index': idx,
                    'filename': file_info.get('filename', 'unknown'),
                    'error': str(e)
                })

        return Response({
            'urls': results,
            'total': len(files),
            'successful': successful,
            'failed': len(errors),
            'errors': errors if errors else None
        }, status=status.HTTP_200_OK)

    except Exception as e:
        logger.error(f"Error generating batch signed URLs: {str(e)}")
        return Response({
            'error': 'Failed to generate upload URLs',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['POST'])
def register_upload(request):
    """
    Register uploaded image in backend database.
    Called by Electron app after successful upload to GCS.

    Request Body:
    {
        "gcs_path": "uploads/event123/user456/2026-01-28/uuid_image.jpg",
        "original_filename": "vacation.jpg",
        "file_size": 1048576,
        "content_type": "image/jpeg",
        "md5_hash": "abc123...",
        "event_id": "event123",
        "user_id": "user456",
        "upload_date": "2026-01-28T10:30:00Z"
    }

    Response:
    {
        "success": true,
        "image_id": 123,
        "message": "Image registered successfully"
    }
    """
    try:
        # Extract parameters
        gcs_path = request.data.get('gcs_path')
        original_filename = request.data.get('original_filename')
        file_size = request.data.get('file_size')
        content_type = request.data.get('content_type')
        md5_hash = request.data.get('md5_hash')
        event_id = request.data.get('event_id')
        user_id = request.data.get('user_id')
        upload_date = request.data.get('upload_date')

        # Validate required fields
        if not all([gcs_path, original_filename, file_size, md5_hash]):
            return Response({
                'error': 'Missing required fields',
                'required': ['gcs_path', 'original_filename', 'file_size', 'md5_hash']
            }, status=status.HTTP_400_BAD_REQUEST)

        # TODO: Store in your database (Photo model or similar)
        # This is a placeholder - implement based on your Photo model
        # Example:
        # from .models import Photo
        # photo = Photo.objects.create(
        #     gcs_path=gcs_path,
        #     original_filename=original_filename,
        #     file_size=file_size,
        #     content_type=content_type,
        #     image_hash=md5_hash,
        #     event_id=event_id,
        #     user_id=user_id,
        #     upload_date=upload_date,
        #     status='uploaded'
        # )

        logger.info(f"Registered upload: {gcs_path}")

        return Response({
            'success': True,
            'image_id': None,  # TODO: Return actual photo.id
            'message': 'Image registered successfully',
            'gcs_path': gcs_path
        }, status=status.HTTP_201_CREATED)

    except Exception as e:
        logger.error(f"Error registering upload: {str(e)}")
        return Response({
            'error': 'Failed to register upload',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def test_gcs_connection(request):
    """
    Test GCS connection and credentials.

    Response:
    {
        "success": true,
        "bucket": "your-bucket-name",
        "message": "GCS connection successful"
    }
    """
    try:
        bucket_name = os.getenv('GCS_BUCKET_NAME')

        if not bucket_name:
            return Response({
                'success': False,
                'error': 'GCS_BUCKET_NAME not configured'
            }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

        # Test connection
        client = get_gcs_client()
        bucket = client.bucket(bucket_name)

        # Check if bucket exists
        if not bucket.exists():
            return Response({
                'success': False,
                'error': f'Bucket "{bucket_name}" does not exist'
            }, status=status.HTTP_404_NOT_FOUND)

        return Response({
            'success': True,
            'bucket': bucket_name,
            'project_id': os.getenv('GCS_PROJECT_ID'),
            'message': 'GCS connection successful'
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        return Response({
            'success': False,
            'error': 'Configuration error',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)

    except Exception as e:
        logger.error(f"GCS connection test failed: {str(e)}")
        return Response({
            'success': False,
            'error': 'GCS connection failed',
            'details': str(e)
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
