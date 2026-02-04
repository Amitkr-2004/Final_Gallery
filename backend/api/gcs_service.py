"""
Google Cloud Storage Service
Handles automatic upload of images and metadata to GCS.
"""

import os
import json
import logging
from datetime import datetime
from django.conf import settings
from google.cloud import storage
from google.oauth2 import service_account

logger = logging.getLogger(__name__)

# Global GCS client (initialized once)
_gcs_client = None
_gcs_bucket = None


def get_gcs_client():
    """
    Get or create GCS client singleton.

    Returns:
        storage.Client or None if GCS not configured
    """
    global _gcs_client

    if _gcs_client is not None:
        return _gcs_client

    credentials_path = os.getenv('GOOGLE_APPLICATION_CREDENTIALS')

    if not credentials_path or not os.path.exists(credentials_path):
        logger.warning("GCS credentials not found. Cloud sync disabled.")
        return None

    try:
        credentials = service_account.Credentials.from_service_account_file(
            credentials_path,
            scopes=['https://www.googleapis.com/auth/cloud-platform']
        )
        project_id = os.getenv('GCS_PROJECT_ID')
        _gcs_client = storage.Client(credentials=credentials, project=project_id)
        logger.info("GCS client initialized successfully")
        return _gcs_client
    except Exception as e:
        logger.error(f"Failed to initialize GCS client: {e}")
        return None


def get_gcs_bucket():
    """
    Get or create GCS bucket reference.

    Returns:
        storage.Bucket or None if GCS not configured
    """
    global _gcs_bucket

    if _gcs_bucket is not None:
        return _gcs_bucket

    client = get_gcs_client()
    if not client:
        return None

    bucket_name = os.getenv('GCS_BUCKET_NAME')
    if not bucket_name:
        logger.warning("GCS_BUCKET_NAME not configured")
        return None

    try:
        _gcs_bucket = client.bucket(bucket_name)
        return _gcs_bucket
    except Exception as e:
        logger.error(f"Failed to get GCS bucket: {e}")
        return None


def is_gcs_configured():
    """Check if GCS is properly configured."""
    return (
        os.getenv('GOOGLE_APPLICATION_CREDENTIALS') and
        os.path.exists(os.getenv('GOOGLE_APPLICATION_CREDENTIALS', '')) and
        os.getenv('GCS_BUCKET_NAME')
    )


def upload_image_to_gcs(photo, local_image_path):
    """
    Upload an image to Google Cloud Storage.

    Args:
        photo: Photo model instance
        local_image_path: Full path to the local image file

    Returns:
        dict: {success: bool, gcs_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': False, 'gcs_path': None, 'error': 'GCS not configured'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'gcs_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        # Determine GCS path based on event_id or uncategorized
        # Store original in 'originals/' folder
        if photo.event_id:
            gcs_path = f"originals/{photo.event_id}/{photo.image_hash}{os.path.splitext(photo.file_path)[1]}"
        else:
            gcs_path = f"originals/uncategorized/{photo.image_hash}{os.path.splitext(photo.file_path)[1]}"

        # Upload the file
        blob = bucket.blob(gcs_path)

        # Set content type
        content_type = 'image/jpeg'
        if photo.file_path.lower().endswith('.png'):
            content_type = 'image/png'
        elif photo.file_path.lower().endswith('.webp'):
            content_type = 'image/webp'

        blob.upload_from_filename(local_image_path, content_type=content_type)

        logger.info(f"Uploaded original image to GCS: {gcs_path}")
        return {'success': True, 'gcs_path': gcs_path, 'error': None}

    except Exception as e:
        logger.error(f"Failed to upload image to GCS: {e}")
        return {'success': False, 'gcs_path': None, 'error': str(e)}


def upload_thumbnail_to_gcs(photo, thumbnail_type='small'):
    """
    Upload a thumbnail to Google Cloud Storage.

    Args:
        photo: Photo model instance with thumbnail paths
        thumbnail_type: 'small' or 'medium'

    Returns:
        dict: {success: bool, gcs_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': False, 'gcs_path': None, 'error': 'GCS not configured'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'gcs_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        # Get local thumbnail path
        if thumbnail_type == 'small':
            local_path = photo.thumbnail_small
        else:
            local_path = photo.thumbnail_medium

        if not local_path:
            return {'success': False, 'gcs_path': None, 'error': f'No {thumbnail_type} thumbnail path'}

        # Full local path
        full_local_path = os.path.join(settings.MEDIA_ROOT, local_path)
        if not os.path.exists(full_local_path):
            return {'success': False, 'gcs_path': None, 'error': f'Thumbnail file not found: {full_local_path}'}

        # Determine GCS path
        if photo.event_id:
            gcs_path = f"thumbnails/{thumbnail_type}/{photo.event_id}/{photo.image_hash}.jpg"
        else:
            gcs_path = f"thumbnails/{thumbnail_type}/uncategorized/{photo.image_hash}.jpg"

        # Upload the file
        blob = bucket.blob(gcs_path)
        blob.upload_from_filename(full_local_path, content_type='image/jpeg')

        logger.info(f"Uploaded {thumbnail_type} thumbnail to GCS: {gcs_path}")
        return {'success': True, 'gcs_path': gcs_path, 'error': None}

    except Exception as e:
        logger.error(f"Failed to upload thumbnail to GCS: {e}")
        return {'success': False, 'gcs_path': None, 'error': str(e)}


def upload_collection_metadata_to_gcs(person, person_photos):
    """
    Upload collection/person metadata to GCS.

    Args:
        person: Person model instance
        person_photos: QuerySet of PersonPhoto for this person

    Returns:
        dict: {success: bool, gcs_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': False, 'gcs_path': None, 'error': 'GCS not configured'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'gcs_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        # Build collection metadata
        collection_data = {
            'collection_id': person.id,
            'person_number': person.person_number,
            'total_photos': person_photos.count(),
            'embedding_vector': person.embedding_vector,
            'created_at': person.created_at.isoformat() if person.created_at else None,
            'photos': []
        }

        # Add photo references
        for pp in person_photos.select_related('photo'):
            photo = pp.photo
            collection_data['photos'].append({
                'photo_id': photo.id,
                'file_path': photo.file_path,
                'image_hash': photo.image_hash,
                'event_id': photo.event_id,
                'confidence': pp.confidence,
                'uploaded_at': photo.uploaded_at.isoformat() if photo.uploaded_at else None
            })

        collection_data['synced_at'] = datetime.utcnow().isoformat()

        # Upload to GCS
        gcs_path = f"collections/{person.id}.json"
        blob = bucket.blob(gcs_path)
        blob.upload_from_string(
            json.dumps(collection_data, indent=2),
            content_type='application/json'
        )

        logger.info(f"Uploaded collection metadata to GCS: {gcs_path}")
        return {'success': True, 'gcs_path': gcs_path, 'error': None}

    except Exception as e:
        logger.error(f"Failed to upload collection metadata to GCS: {e}")
        return {'success': False, 'gcs_path': None, 'error': str(e)}


def upload_embedding_to_gcs(person):
    """
    Upload face embedding to GCS for vector search.

    Args:
        person: Person model instance with embedding_vector

    Returns:
        dict: {success: bool, gcs_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': False, 'gcs_path': None, 'error': 'GCS not configured'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'gcs_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        embedding_data = {
            'person_id': person.id,
            'person_number': person.person_number,
            'embedding': person.embedding_vector,
            'dimensions': len(person.embedding_vector) if person.embedding_vector else 0,
            'created_at': person.created_at.isoformat() if person.created_at else None,
            'synced_at': datetime.utcnow().isoformat()
        }

        gcs_path = f"embeddings/{person.id}.json"
        blob = bucket.blob(gcs_path)
        blob.upload_from_string(
            json.dumps(embedding_data, indent=2),
            content_type='application/json'
        )

        logger.info(f"Uploaded embedding to GCS: {gcs_path}")
        return {'success': True, 'gcs_path': gcs_path, 'error': None}

    except Exception as e:
        logger.error(f"Failed to upload embedding to GCS: {e}")
        return {'success': False, 'gcs_path': None, 'error': str(e)}


def sync_photo_to_gcs(photo, local_image_path, matched_persons=None):
    """
    Sync a photo and related data to GCS.
    This is the main function to call after image upload and face detection.
    Uploads: original image + thumbnails (small & medium)

    Args:
        photo: Photo model instance
        local_image_path: Full path to the local image
        matched_persons: List of Person instances that were matched/created

    Returns:
        dict: {
            success: bool,
            image_uploaded: bool,
            thumbnails_uploaded: dict,
            collections_synced: int,
            embeddings_synced: int,
            errors: list
        }
    """
    result = {
        'success': True,
        'image_uploaded': False,
        'image_gcs_path': None,
        'thumbnails_uploaded': {'small': False, 'medium': False},
        'thumbnail_gcs_paths': {'small': None, 'medium': None},
        'collections_synced': 0,
        'embeddings_synced': 0,
        'errors': []
    }

    if not is_gcs_configured():
        result['success'] = False
        result['errors'].append('GCS not configured')
        logger.info("GCS sync skipped - not configured")
        return result

    # 1. Upload the original image
    image_result = upload_image_to_gcs(photo, local_image_path)
    if image_result['success']:
        result['image_uploaded'] = True
        result['image_gcs_path'] = image_result['gcs_path']
    else:
        result['errors'].append(f"Image upload failed: {image_result['error']}")

    # 2. Upload thumbnails
    if photo.thumbnail_small:
        small_result = upload_thumbnail_to_gcs(photo, 'small')
        if small_result['success']:
            result['thumbnails_uploaded']['small'] = True
            result['thumbnail_gcs_paths']['small'] = small_result['gcs_path']
        else:
            result['errors'].append(f"Small thumbnail upload failed: {small_result['error']}")

    if photo.thumbnail_medium:
        medium_result = upload_thumbnail_to_gcs(photo, 'medium')
        if medium_result['success']:
            result['thumbnails_uploaded']['medium'] = True
            result['thumbnail_gcs_paths']['medium'] = medium_result['gcs_path']
        else:
            result['errors'].append(f"Medium thumbnail upload failed: {medium_result['error']}")

    # 2. Sync collections and embeddings for matched persons
    if matched_persons:
        from .models import PersonPhoto

        for person in matched_persons:
            # Upload embedding
            embed_result = upload_embedding_to_gcs(person)
            if embed_result['success']:
                result['embeddings_synced'] += 1
            else:
                result['errors'].append(f"Embedding sync failed for person {person.id}: {embed_result['error']}")

            # Upload collection metadata
            person_photos = PersonPhoto.objects.filter(person=person)
            coll_result = upload_collection_metadata_to_gcs(person, person_photos)
            if coll_result['success']:
                result['collections_synced'] += 1
            else:
                result['errors'].append(f"Collection sync failed for person {person.id}: {coll_result['error']}")

    if result['errors']:
        result['success'] = False

    logger.info(f"GCS sync complete for photo {photo.id}: original={result['image_uploaded']}, "
                f"thumbnails={result['thumbnails_uploaded']}, "
                f"collections={result['collections_synced']}, embeddings={result['embeddings_synced']}")

    return result


def delete_image_from_gcs(photo):
    """
    Delete an image and its thumbnails from Google Cloud Storage.

    Args:
        photo: Photo model instance

    Returns:
        dict: {success: bool, deleted_paths: list, error: str}
    """
    if not is_gcs_configured():
        return {'success': True, 'deleted_paths': [], 'error': 'GCS not configured (skip)'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'deleted_paths': [], 'error': 'Failed to get GCS bucket'}

    deleted_paths = []
    errors = []

    try:
        ext = os.path.splitext(photo.file_path)[1] if photo.file_path else '.jpg'
        event_folder = photo.event_id if photo.event_id else 'uncategorized'

        # Paths to delete: original + thumbnails
        paths_to_delete = [
            f"originals/{event_folder}/{photo.image_hash}{ext}",
            f"thumbnails/small/{event_folder}/{photo.image_hash}.jpg",
            f"thumbnails/medium/{event_folder}/{photo.image_hash}.jpg",
            # Legacy path (in case old images were stored here)
            f"images/{event_folder}/{photo.image_hash}{ext}",
        ]

        for gcs_path in paths_to_delete:
            try:
                blob = bucket.blob(gcs_path)
                if blob.exists():
                    blob.delete()
                    deleted_paths.append(gcs_path)
                    logger.info(f"Deleted from GCS: {gcs_path}")
            except Exception as e:
                errors.append(f"{gcs_path}: {str(e)}")

        if deleted_paths:
            return {'success': True, 'deleted_paths': deleted_paths, 'error': None}
        else:
            return {'success': True, 'deleted_paths': [], 'error': 'No files found in GCS'}

    except Exception as e:
        logger.error(f"Failed to delete image from GCS: {e}")
        return {'success': False, 'deleted_paths': deleted_paths, 'error': str(e)}


def delete_collection_from_gcs(person_id):
    """
    Delete collection metadata from Google Cloud Storage.

    Args:
        person_id: ID of the person/collection to delete

    Returns:
        dict: {success: bool, deleted_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': True, 'deleted_path': None, 'error': 'GCS not configured (skip)'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'deleted_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        gcs_path = f"collections/{person_id}.json"
        blob = bucket.blob(gcs_path)

        if blob.exists():
            blob.delete()
            logger.info(f"Deleted collection from GCS: {gcs_path}")
            return {'success': True, 'deleted_path': gcs_path, 'error': None}
        else:
            logger.warning(f"Collection not found in GCS (already deleted?): {gcs_path}")
            return {'success': True, 'deleted_path': gcs_path, 'error': 'File not found in GCS'}

    except Exception as e:
        logger.error(f"Failed to delete collection from GCS: {e}")
        return {'success': False, 'deleted_path': None, 'error': str(e)}


def delete_embedding_from_gcs(person_id):
    """
    Delete embedding from Google Cloud Storage.

    Args:
        person_id: ID of the person whose embedding to delete

    Returns:
        dict: {success: bool, deleted_path: str, error: str}
    """
    if not is_gcs_configured():
        return {'success': True, 'deleted_path': None, 'error': 'GCS not configured (skip)'}

    bucket = get_gcs_bucket()
    if not bucket:
        return {'success': False, 'deleted_path': None, 'error': 'Failed to get GCS bucket'}

    try:
        gcs_path = f"embeddings/{person_id}.json"
        blob = bucket.blob(gcs_path)

        if blob.exists():
            blob.delete()
            logger.info(f"Deleted embedding from GCS: {gcs_path}")
            return {'success': True, 'deleted_path': gcs_path, 'error': None}
        else:
            logger.warning(f"Embedding not found in GCS (already deleted?): {gcs_path}")
            return {'success': True, 'deleted_path': gcs_path, 'error': 'File not found in GCS'}

    except Exception as e:
        logger.error(f"Failed to delete embedding from GCS: {e}")
        return {'success': False, 'deleted_path': None, 'error': str(e)}
