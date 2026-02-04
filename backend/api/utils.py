"""
Utility functions for the API app using InsightFace.
"""

import os
import cv2
import numpy as np
import logging
from PIL import Image
from django.conf import settings
from insightface.app import FaceAnalysis

logger = logging.getLogger(__name__)

# Initialize InsightFace once (global object)
# This loads the model only once and reuses it for all requests
face_app = FaceAnalysis(name="buffalo_l")
face_app.prepare(ctx_id=0, det_size=(640, 640))  # ctx_id=0 → CPU, use -1 if GPU issues


# Thumbnail configuration from settings or defaults
THUMBNAIL_SIZES = getattr(settings, 'THUMBNAIL_SIZES', {
    'small': (200, 200),
    'medium': (800, 800),
})
THUMBNAIL_QUALITY = getattr(settings, 'THUMBNAIL_QUALITY', 85)
THUMBNAIL_FORMAT = getattr(settings, 'THUMBNAIL_FORMAT', 'JPEG')


def get_image_upload_path(filename):
    """
    Returns the full path where an image should be stored.
    All images are stored in backend/media/images/
    """
    return os.path.join(settings.MEDIA_ROOT, "images", filename)


def get_image_url(file_path):
    """
    Returns the URL for accessing an image.
    """
    if file_path.startswith(settings.MEDIA_ROOT):
        relative_path = os.path.relpath(file_path, settings.MEDIA_ROOT)
        return f"{settings.MEDIA_URL}{relative_path}".replace("\\", "/")

    if not os.path.isabs(file_path):
        return f"{settings.MEDIA_URL}{file_path}".replace("\\", "/")

    return file_path


def detect_faces_and_extract_embeddings(image_path, min_confidence=0.5):
    """
    Detect all faces in an image and extract embedding vectors using InsightFace.
    Only returns embeddings for faces detected with sufficient confidence/clarity.

    Args:
        image_path: Path to the image file
        min_confidence: Minimum detection confidence score (0.0 to 1.0)
                       Only faces with confidence >= min_confidence are processed
                       This avoids creating collections for unclear/blurry faces

    Returns:
        List of dicts: [{'embedding': [...], 'confidence': float, 'bbox': {...}}, ...]
        Where embedding is a list of floats, confidence is detection score,
        and bbox contains {x, y, width, height} of face in image
    """
    img = cv2.imread(image_path)

    if img is None:
        return []

    faces = face_app.get(img)

    # Filter faces by detection confidence to only process clear faces
    # face.det_score indicates how confident the detection is (higher = clearer face)
    quality_faces = []
    for face in faces:
        det_score = getattr(face, 'det_score', 1.0)  # Default to 1.0 if not available

        # Only process faces with sufficient confidence/clarity
        if det_score >= min_confidence:
            embedding = face.embedding.tolist() if hasattr(face.embedding, 'tolist') else face.embedding

            # Extract bounding box (InsightFace returns [x1, y1, x2, y2])
            bbox = None
            if hasattr(face, 'bbox') and face.bbox is not None:
                box = face.bbox.tolist() if hasattr(face.bbox, 'tolist') else list(face.bbox)
                if len(box) >= 4:
                    bbox = {
                        'x': int(box[0]),
                        'y': int(box[1]),
                        'width': int(box[2] - box[0]),
                        'height': int(box[3] - box[1])
                    }

            quality_faces.append({
                'embedding': embedding,
                'confidence': float(det_score),
                'bbox': bbox
            })
        # Skip low-quality/unclear face detections to avoid duplicates

    return quality_faces


def detect_faces_from_file(image_file, min_confidence=0.5):
    """
    Detect faces and extract embeddings from an uploaded file object.
    Only returns embeddings for clearly detected faces.

    Args:
        image_file: Django UploadedFile object
        min_confidence: Minimum detection confidence score (0.0 to 1.0)

    Returns:
        List of dicts: [{'embedding': [...], 'confidence': float, 'bbox': {...}}, ...]
        Only includes faces detected with confidence >= min_confidence
    """
    import tempfile

    image_file.seek(0)

    with tempfile.NamedTemporaryFile(delete=False, suffix=".jpg") as tmp_file:
        for chunk in image_file.chunks():
            tmp_file.write(chunk)
        tmp_file_path = tmp_file.name

    try:
        quality_faces = detect_faces_and_extract_embeddings(tmp_file_path, min_confidence=min_confidence)
        return quality_faces
    finally:
        if os.path.exists(tmp_file_path):
            os.unlink(tmp_file_path)


def update_daily_statistics(photos_count=1, faces_count=0):
    """
    Update daily statistics for photo uploads and face detections.

    This function should be called for EVERY successfully uploaded image.
    It increments the daily counter, creating a new record if needed.

    Args:
        photos_count: Number of photos uploaded (default: 1)
        faces_count: Number of faces detected (default: 0)

    Returns:
        DailyStatistics object

    Note:
        - Uses get_or_create to handle concurrent requests safely
        - One record per date (YYYY-MM-DD)
        - If date exists: increments counters
        - If not: creates new record with initial counts
    """
    from datetime import date
    from django.db import transaction
    from django.db.models import F
    from .models import DailyStatistics
    import logging

    logger = logging.getLogger(__name__)
    today = date.today()

    try:
        with transaction.atomic():
            # Use get_or_create to safely handle concurrent requests
            stats, created = DailyStatistics.objects.get_or_create(
                date=today,
                defaults={
                    'photos_uploaded': photos_count,
                    'faces_detected': faces_count
                }
            )

            if not created:
                # Record exists, increment the counters atomically
                # Using F() expressions to avoid race conditions
                stats.photos_uploaded = F('photos_uploaded') + photos_count
                stats.faces_detected = F('faces_detected') + faces_count
                stats.save(update_fields=['photos_uploaded', 'faces_detected', 'updated_at'])

                # Refresh from database to get actual values (F() expressions need refresh)
                stats.refresh_from_db()

            logger.info(
                f"[STATISTICS] Updated stats for {today}: "
                f"+{photos_count} photos, +{faces_count} faces. "
                f"Total today: {stats.photos_uploaded} photos, {stats.faces_detected} faces"
            )

            return stats

    except Exception as e:
        logger.error(f"[STATISTICS] Failed to update statistics: {str(e)}")
        raise


def generate_thumbnail(source_path, dest_path, size, quality=THUMBNAIL_QUALITY):
    """
    Generate a thumbnail from an image.

    Args:
        source_path: Path to the original image
        dest_path: Path where thumbnail will be saved
        size: Tuple (width, height) for the thumbnail
        quality: JPEG quality (1-100)

    Returns:
        dict: {success: bool, path: str, size: int, error: str}
    """
    try:
        # Open image with PIL
        with Image.open(source_path) as img:
            # Convert to RGB if needed (for PNG with transparency)
            if img.mode in ('RGBA', 'P'):
                img = img.convert('RGB')

            # Calculate aspect ratio preserving resize
            img.thumbnail(size, Image.Resampling.LANCZOS)

            # Ensure directory exists
            os.makedirs(os.path.dirname(dest_path), exist_ok=True)

            # Save thumbnail
            img.save(dest_path, THUMBNAIL_FORMAT, quality=quality, optimize=True)

            file_size = os.path.getsize(dest_path)
            logger.info(f"[THUMBNAIL] Generated: {dest_path} ({file_size} bytes)")

            return {
                'success': True,
                'path': dest_path,
                'size': file_size,
                'error': None
            }

    except Exception as e:
        logger.error(f"[THUMBNAIL] Failed to generate thumbnail: {e}")
        return {
            'success': False,
            'path': None,
            'size': 0,
            'error': str(e)
        }


def generate_thumbnails_for_image(original_path, image_hash):
    """
    Generate small and medium thumbnails for an image.

    Args:
        original_path: Full path to the original image
        image_hash: Hash of the image (used for filename)

    Returns:
        dict: {
            success: bool,
            thumbnail_small: str (relative path),
            thumbnail_medium: str (relative path),
            original_size: int,
            thumbnail_small_size: int,
            thumbnail_medium_size: int,
            error: str
        }
    """
    result = {
        'success': True,
        'thumbnail_small': None,
        'thumbnail_medium': None,
        'original_size': 0,
        'thumbnail_small_size': 0,
        'thumbnail_medium_size': 0,
        'error': None
    }

    try:
        # Get original file size
        result['original_size'] = os.path.getsize(original_path)

        # Define thumbnail paths
        thumbnails_dir = os.path.join(settings.MEDIA_ROOT, 'thumbnails')
        small_dir = os.path.join(thumbnails_dir, 'small')
        medium_dir = os.path.join(thumbnails_dir, 'medium')

        # Ensure directories exist
        os.makedirs(small_dir, exist_ok=True)
        os.makedirs(medium_dir, exist_ok=True)

        # Generate filename
        thumb_filename = f"{image_hash}.jpg"

        # Generate small thumbnail (200x200)
        small_path = os.path.join(small_dir, thumb_filename)
        small_result = generate_thumbnail(
            original_path,
            small_path,
            THUMBNAIL_SIZES['small'],
            quality=70  # Lower quality for small thumbnails
        )

        if small_result['success']:
            result['thumbnail_small'] = f"thumbnails/small/{thumb_filename}"
            result['thumbnail_small_size'] = small_result['size']
        else:
            result['success'] = False
            result['error'] = f"Small thumbnail failed: {small_result['error']}"

        # Generate medium thumbnail (800x800)
        medium_path = os.path.join(medium_dir, thumb_filename)
        medium_result = generate_thumbnail(
            original_path,
            medium_path,
            THUMBNAIL_SIZES['medium'],
            quality=THUMBNAIL_QUALITY
        )

        if medium_result['success']:
            result['thumbnail_medium'] = f"thumbnails/medium/{thumb_filename}"
            result['thumbnail_medium_size'] = medium_result['size']
        else:
            result['success'] = False
            result['error'] = f"Medium thumbnail failed: {medium_result['error']}"

        # Log compression stats
        if result['success']:
            original_kb = result['original_size'] / 1024
            small_kb = result['thumbnail_small_size'] / 1024
            medium_kb = result['thumbnail_medium_size'] / 1024
            logger.info(f"[THUMBNAIL] Stats: Original={original_kb:.1f}KB, Small={small_kb:.1f}KB, Medium={medium_kb:.1f}KB")

    except Exception as e:
        result['success'] = False
        result['error'] = str(e)
        logger.error(f"[THUMBNAIL] Failed to generate thumbnails: {e}")

    return result
