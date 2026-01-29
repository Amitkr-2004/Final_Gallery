"""
Celery tasks for async photo processing.

Tasks:
- process_photo: Main task that orchestrates thumbnail generation and face detection
- generate_thumbnails: Creates small (200x200) and medium (800x800) thumbnails
- detect_and_match_faces: Runs face detection and FAISS matching
"""

import os
import logging
from pathlib import Path
from datetime import datetime

from celery import shared_task
from django.conf import settings
from django.utils import timezone
from django.db import transaction, IntegrityError
from PIL import Image
import numpy as np

from .models import Photo, Person, PersonPhoto
from .utils import detect_faces_and_extract_embeddings, update_daily_statistics
from .faiss_manager import get_faiss_manager

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=3)
def process_photo(self, photo_id):
    """
    Main task to process a photo asynchronously.

    Steps:
    1. Generate thumbnails (small and medium)
    2. Detect faces and create embeddings
    3. Match faces with existing persons using FAISS
    4. Update photo status to completed

    Args:
        photo_id: ID of the Photo object to process
    """
    try:
        logger.info(f"[Task {self.request.id}] Starting processing for photo {photo_id}")

        # Update status to processing
        photo = Photo.objects.get(id=photo_id)
        photo.status = Photo.STATUS_PROCESSING
        photo.save(update_fields=['status'])

        # Step 1: Generate thumbnails
        logger.info(f"[Task {self.request.id}] Generating thumbnails for photo {photo_id}")
        # Get full path to image
        image_full_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)
        thumbnail_paths = generate_thumbnails(image_full_path)

        if thumbnail_paths:
            photo.thumbnail_small = thumbnail_paths['small']
            photo.thumbnail_medium = thumbnail_paths['medium']
            photo.save(update_fields=['thumbnail_small', 'thumbnail_medium'])
            logger.info(f"[Task {self.request.id}] Thumbnails created: {thumbnail_paths}")

        # Step 2 & 3: Detect and match faces
        logger.info(f"[Task {self.request.id}] Running face detection for photo {photo_id}")
        faces_processed = detect_and_match_faces(photo)
        logger.info(f"[Task {self.request.id}] Detected and matched {faces_processed} faces")

        # Step 4: Update daily statistics
        try:
            update_daily_statistics(photos_count=1, faces_count=faces_processed)
            logger.info(f"[Task {self.request.id}] Updated daily statistics")
        except Exception as stats_error:
            logger.error(f"[Task {self.request.id}] Failed to update statistics: {str(stats_error)}")
            # Continue anyway - don't fail the task due to stats error

        # Step 5: Invalidate persons list cache (new faces may have been added)
        try:
            from django.core.cache import cache
            # settings already imported at module level (line 16)

            # Clear all persons list cache pages
            # Pattern with KEY_PREFIX: gallery:persons_list_page_*, gallery:persons_list_event_*_page_*
            cache_prefix = settings.CACHES['default'].get('KEY_PREFIX', '')
            if cache_prefix:
                pattern = f'{cache_prefix}:persons_list_*'
            else:
                pattern = 'persons_list_*'

            deleted_count = cache.delete_pattern(pattern)
            logger.info(f"[Task {self.request.id}] Invalidated {deleted_count} cache keys matching '{pattern}'")
        except Exception as cache_error:
            logger.error(f"[Task {self.request.id}] Failed to invalidate cache: {str(cache_error)}", exc_info=True)
            # Continue anyway

        # Step 6: Mark as completed
        photo.status = Photo.STATUS_COMPLETED
        photo.processed_at = timezone.now()
        photo.save(update_fields=['status', 'processed_at'])

        logger.info(f"[Task {self.request.id}] Successfully completed processing photo {photo_id}")
        return {
            'photo_id': photo_id,
            'status': 'completed',
            'faces_detected': faces_processed,
            'thumbnails': thumbnail_paths
        }

    except Photo.DoesNotExist:
        logger.error(f"[Task {self.request.id}] Photo {photo_id} not found")
        raise

    except Exception as e:
        logger.error(f"[Task {self.request.id}] Error processing photo {photo_id}: {str(e)}", exc_info=True)

        # Mark photo as failed
        try:
            photo = Photo.objects.get(id=photo_id)
            photo.status = Photo.STATUS_FAILED
            photo.processed_at = timezone.now()
            photo.save(update_fields=['status', 'processed_at'])
        except Photo.DoesNotExist:
            pass

        # Retry with exponential backoff
        raise self.retry(exc=e, countdown=60 * (2 ** self.request.retries))


def generate_thumbnails(image_path):
    """
    Generate thumbnails for an image.

    Creates two thumbnails:
    - Small: 200x200 (for collections page)
    - Medium: 800x800 (for person detail page)

    Args:
        image_path: Absolute path to the original image

    Returns:
        dict: {'small': path, 'medium': path} or None if failed
    """
    try:
        # Ensure image exists
        if not os.path.exists(image_path):
            logger.error(f"Image not found: {image_path}")
            return None

        # Open image
        img = Image.open(image_path)

        # Convert RGBA to RGB if needed
        if img.mode in ('RGBA', 'LA', 'P'):
            background = Image.new('RGB', img.size, (255, 255, 255))
            if img.mode == 'P':
                img = img.convert('RGBA')
            background.paste(img, mask=img.split()[-1] if img.mode in ('RGBA', 'LA') else None)
            img = background

        # Get thumbnail configuration
        sizes = settings.THUMBNAIL_SIZES
        quality = settings.THUMBNAIL_QUALITY
        format_type = settings.THUMBNAIL_FORMAT

        # Create thumbnails directory
        media_root = Path(settings.MEDIA_ROOT)
        thumbnails_dir = media_root / 'thumbnails'
        thumbnails_dir.mkdir(exist_ok=True)

        # Generate file name using image hash (ensures unique thumbnail per photo)
        # File structure: media/images/{hash}.jpg
        # Extract hash from filename (not parent dir)
        original_filename = Path(image_path).stem  # Gets filename without extension

        # Use first 16 chars of hash for shorter but still unique filenames
        image_hash = original_filename[:16] if len(original_filename) >= 16 else original_filename

        thumbnail_paths = {}

        for size_name, (width, height) in sizes.items():
            # Create thumbnail
            img_copy = img.copy()
            img_copy.thumbnail((width, height), Image.Resampling.LANCZOS)

            # Create output path with unique name per photo
            thumb_filename = f"{image_hash}_{size_name}.{format_type.lower()}"
            thumb_path = thumbnails_dir / thumb_filename

            logger.debug(f"Generating thumbnail: {thumb_filename} for {Path(image_path).name}")

            # Save thumbnail
            save_kwargs = {'quality': quality, 'optimize': True}
            if format_type.upper() == 'WEBP':
                save_kwargs['method'] = 6  # Best compression

            img_copy.save(str(thumb_path), format=format_type, **save_kwargs)

            # Store relative path (for database)
            thumbnail_paths[size_name] = str(thumb_path.relative_to(media_root))

            logger.debug(f"Created {size_name} thumbnail: {thumb_path}")

        return thumbnail_paths

    except Exception as e:
        logger.error(f"Error generating thumbnails for {image_path}: {str(e)}", exc_info=True)
        return None


def detect_and_match_faces(photo):
    """
    Detect faces in a photo and match them with existing persons.

    This is the same logic as before, but now runs asynchronously.

    Args:
        photo: Photo model instance

    Returns:
        int: Number of faces detected and processed
    """
    try:
        # Get full path to image
        image_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)

        # Detect faces and extract embeddings with confidence filtering
        face_confidence_threshold = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.5)
        quality_faces = detect_faces_and_extract_embeddings(image_path, min_confidence=face_confidence_threshold)

        if not quality_faces:
            logger.info(f"No quality faces detected in photo {photo.id}")
            return 0

        logger.info(f"Detected {len(quality_faces)} quality faces in photo {photo.id}")

        # Get FAISS manager
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.7)
        faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)

        faces_processed = 0

        for face_index, (embedding, confidence) in enumerate(quality_faces):
            try:
                # Find or create person using FAISS matching
                person, is_new = faiss_manager.find_or_create_person(embedding)

                if is_new:
                    logger.info(f"Created new person {person.person_number} for unmatched face (confidence: {confidence:.3f})")
                else:
                    logger.info(f"Matched face to existing person {person.person_number} (confidence: {confidence:.3f})")

                # Link photo to person with confidence score (avoid duplicates)
                try:
                    person_photo, created = PersonPhoto.objects.get_or_create(
                        person=person,
                        photo=photo,
                        defaults={'confidence': confidence}
                    )

                    # If link already exists but confidence is higher, update it
                    if not created and person_photo.confidence < confidence:
                        logger.info(
                            f"Updating confidence for Person {person.person_number} + Photo {photo.id}: "
                            f"{person_photo.confidence:.3f} → {confidence:.3f}"
                        )
                        person_photo.confidence = confidence
                        person_photo.save(update_fields=['confidence'])

                    # Log cover selection decision
                    if created or person_photo.confidence < confidence:
                        logger.info(
                            f"[COVER] Person {person.person_number}: Photo {photo.id}, "
                            f"Face #{face_index}, Confidence {confidence:.3f}"
                        )

                except IntegrityError:
                    # Handle race condition: if duplicate detected at DB level, get existing record
                    person_photo = PersonPhoto.objects.get(person=person, photo=photo)
                    logger.warning(
                        f"IntegrityError: PersonPhoto link already exists for Person {person.person_number}, "
                        f"Photo {photo.id}"
                    )

                faces_processed += 1

            except Exception as e:
                logger.error(f"Error processing face in photo {photo.id}: {str(e)}", exc_info=True)
                continue

        return faces_processed

    except Exception as e:
        logger.error(f"Error in face detection for photo {photo.id}: {str(e)}", exc_info=True)
        return 0


# ============================================================================
# SCHEDULER TASKS - Time Scheduler Feature
# ============================================================================

@shared_task
def check_and_execute_scheduled_jobs():
    """
    Periodic task to check for scheduled jobs that need execution.

    Runs every minute via Celery Beat.
    Finds all pending jobs where scheduled_time has passed and executes them.
    """
    from .models import ScheduledJob

    logger.info("[Scheduler] Checking for scheduled jobs...")

    now = timezone.now()

    # Find pending jobs that are due for execution
    jobs = ScheduledJob.objects.filter(
        status='pending',
        scheduled_time__lte=now,
        is_active=True
    )

    count = jobs.count()
    if count == 0:
        logger.debug("[Scheduler] No jobs to execute")
        return

    logger.info(f"[Scheduler] Found {count} job(s) to execute")

    # Launch execution task for each job
    for job in jobs:
        logger.info(f"[Scheduler] Launching execution for job {job.id}")
        execute_scheduled_job.delay(job.id)


@shared_task(bind=True, max_retries=0)  # No auto-retry (handled manually in executor)
def execute_scheduled_job(self, job_id):
    """
    Execute a single scheduled job.

    This task orchestrates the complete pipeline:
    1. Fetch images from Google Drive
    2. Create "Student Images" event
    3. Upload and process each image
    4. Trigger face detection
    5. Update statistics

    Args:
        job_id: ID of ScheduledJob to execute

    Returns:
        dict: Execution result with success flag and stats/error
    """
    from .models import ScheduledJob
    from .job_executor import JobExecutor

    logger.info(f"[Task {self.request.id}] Executing scheduled job {job_id}")

    try:
        # Get job instance
        job = ScheduledJob.objects.get(id=job_id, is_active=True)

        # Check if already running (race condition protection)
        if job.status == 'running':
            logger.warning(f"[Task {self.request.id}] Job {job_id} is already running, skipping")
            return {'success': False, 'error': 'Job already running'}

        # Create executor and run
        executor = JobExecutor(job)
        result = executor.execute()

        if result['success']:
            logger.info(
                f"[Task {self.request.id}] Job {job_id} completed successfully. "
                f"Stats: {result.get('stats', {})}"
            )
        else:
            logger.error(
                f"[Task {self.request.id}] Job {job_id} failed. "
                f"Error: {result.get('error', 'Unknown error')}"
            )

        return result

    except ScheduledJob.DoesNotExist:
        logger.error(f"[Task {self.request.id}] Job {job_id} not found or inactive")
        return {'success': False, 'error': 'Job not found'}

    except Exception as e:
        logger.error(
            f"[Task {self.request.id}] Unexpected error executing job {job_id}: {str(e)}",
            exc_info=True
        )
        return {'success': False, 'error': str(e)}
