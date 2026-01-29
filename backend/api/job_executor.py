"""
Job Executor for Scheduled Image Processing

Handles the complete execution pipeline:
1. Validate local folder path
2. Scan folder for images
3. Create "Student Images" event
4. Copy and process each image
5. Trigger face detection pipeline
6. Update statistics
7. Update job status
"""

import os
import logging
import traceback
import hashlib
import shutil
from typing import Dict
from pathlib import Path
from django.utils import timezone
from django.db import transaction
from django.core.files import File
from django.conf import settings

from .models import ScheduledJob, Photo
from .folder_scanner import (
    FolderScanner,
    InvalidFolderPathError,
    FolderAccessDeniedError,
    NoImagesFoundError
)
from .utils import update_daily_statistics

logger = logging.getLogger(__name__)


class JobExecutor:
    """
    Executes a scheduled job from start to finish.

    Features:
    - Atomic database operations
    - Graceful error handling
    - Detailed logging
    - Automatic cleanup of temp files
    - Idempotent (duplicate images skipped)
    """

    def __init__(self, job: ScheduledJob):
        """
        Initialize executor for a specific job.

        Args:
            job: ScheduledJob instance to execute
        """
        self.job = job
        self.folder_scanner = FolderScanner(logger=logger)
        self.temp_dir = os.path.join(settings.BASE_DIR, 'temp_processing')
        self.temp_files = []  # Track temp files for cleanup

    def execute(self) -> Dict:
        """
        Main execution pipeline with full error handling.

        Returns:
            Dict with keys:
                - success (bool): Whether job completed successfully
                - stats (dict): Processing statistics (if success)
                - error (str): Error message (if failed)
        """
        logger.info(f"[Job {self.job.id}] Starting execution")

        try:
            # Ensure temp directory exists
            os.makedirs(self.temp_dir, exist_ok=True)

            # Phase 1: Mark job as running
            self._mark_running()

            # Phase 2: Validate folder path
            self._validate_folder_path()

            # Phase 3: Scan folder for images
            image_paths = self._scan_folder_images()

            if not image_paths:
                raise NoImagesFoundError(f"No images found in folder: {self.job.folder_path}")

            # Phase 4: Create event
            event_id = self._create_event()

            # Phase 5: Process all images
            stats = self._process_images(image_paths, event_id)

            # Phase 6: Mark as completed
            self._mark_completed(stats)

            logger.info(
                f"[Job {self.job.id}] Completed successfully. "
                f"Processed {stats['images_processed']} images, "
                f"detected {stats['faces_detected']} faces"
            )

            return {
                'success': True,
                'stats': stats
            }

        except Exception as e:
            # Log and mark job as failed
            error_message = str(e)
            error_trace = traceback.format_exc()
            logger.error(f"[Job {self.job.id}] Failed: {error_message}\n{error_trace}")

            self._mark_failed(error_message, error_trace)

            return {
                'success': False,
                'error': error_message
            }

        finally:
            # Always cleanup temp files
            self._cleanup_temp_files()

    def _mark_running(self):
        """Mark job as running with timestamp."""
        with transaction.atomic():
            self.job.status = 'running'
            self.job.started_at = timezone.now()
            self.job.save(update_fields=['status', 'started_at'])
        logger.info(f"[Job {self.job.id}] Status: RUNNING")

    def _validate_folder_path(self):
        """
        Validate local folder path.

        Raises:
            InvalidFolderPathError: If path does not exist or is not a directory
            FolderAccessDeniedError: If path is not readable
        """
        logger.info(f"[Job {self.job.id}] Validating folder path: {self.job.folder_path}")

        try:
            # Validate folder using FolderScanner
            self.folder_scanner.validate_folder(self.job.folder_path)
            logger.info(f"[Job {self.job.id}] Folder validation successful")

        except (InvalidFolderPathError, FolderAccessDeniedError) as e:
            logger.error(f"[Job {self.job.id}] Folder validation failed: {e}")
            raise

    def _scan_folder_images(self) -> list:
        """
        Scan local folder for images.

        Returns:
            List of absolute image file paths

        Raises:
            NoImagesFoundError: If no images found in folder
        """
        logger.info(f"[Job {self.job.id}] Scanning folder for images")

        try:
            # Use FolderScanner to list all images (recursive)
            image_paths = self.folder_scanner.list_images(
                self.job.folder_path,
                recursive=True  # Scan subdirectories
            )
            logger.info(f"[Job {self.job.id}] Found {len(image_paths)} images in folder")
            return image_paths

        except NoImagesFoundError as e:
            logger.error(f"[Job {self.job.id}] No images found: {e}")
            raise

    def _create_event(self) -> str:
        """
        Create "Student Images" event.

        Returns:
            Event ID string

        Note:
            Currently events are stored in frontend localStorage.
            This creates a consistent event_id that frontend can recognize.
            In future, this should create a backend Event model.
        """
        # Generate unique event ID
        timestamp = int(timezone.now().timestamp())
        event_id = f"student-images-{timestamp}"

        # Store in job record
        self.job.event_id = event_id
        self.job.save(update_fields=['event_id'])

        logger.info(f"[Job {self.job.id}] Created event: {event_id}")
        return event_id

    def _process_images(self, image_paths: list, event_id: str) -> Dict:
        """
        Copy and process each image from local folder.

        Args:
            image_paths: List of absolute file paths to images
            event_id: Event ID to associate photos with

        Returns:
            Dict with processing statistics:
                - images_processed: Number of successfully processed images
                - faces_detected: Total faces detected
                - duplicates_skipped: Number of duplicate images skipped
                - errors: Number of images that failed processing
        """
        stats = {
            'images_processed': 0,
            'faces_detected': 0,
            'duplicates_skipped': 0,
            'errors': 0
        }

        total = len(image_paths)
        logger.info(f"[Job {self.job.id}] Processing {total} images")

        for idx, image_path in enumerate(image_paths, 1):
            try:
                filename = os.path.basename(image_path)
                logger.info(f"[Job {self.job.id}] Processing image {idx}/{total}: {filename}")

                # Compute hash for duplicate detection
                image_hash = self._compute_hash(image_path)

                # Check if already exists (Option C: track processed images)
                if Photo.objects.filter(image_hash=image_hash).exists():
                    logger.info(f"[Job {self.job.id}] Skipping duplicate: {filename}")
                    stats['duplicates_skipped'] += 1
                    continue

                # Validate image file
                if not self.folder_scanner.validate_image_file(image_path):
                    logger.warning(f"[Job {self.job.id}] Invalid image file: {filename}")
                    stats['errors'] += 1
                    continue

                # Create Photo record and copy to media directory
                photo = self._create_photo_from_local(image_path, image_hash, filename, event_id)

                # Trigger face detection task (async via Celery)
                self._trigger_face_detection(photo)

                stats['images_processed'] += 1

                # Update job progress periodically
                if idx % 10 == 0:
                    self._update_progress(stats)

            except Exception as e:
                logger.error(f"[Job {self.job.id}] Error processing {filename}: {e}")
                stats['errors'] += 1
                # Continue with next image (don't abort entire job)

        # Final progress update
        self._update_progress(stats)

        logger.info(
            f"[Job {self.job.id}] Processing complete. "
            f"Success: {stats['images_processed']}, "
            f"Duplicates: {stats['duplicates_skipped']}, "
            f"Errors: {stats['errors']}"
        )

        return stats

    def _compute_hash(self, file_path: str) -> str:
        """
        Compute SHA256 hash of file for duplicate detection.

        Args:
            file_path: Path to file

        Returns:
            Hex digest of SHA256 hash
        """
        sha256 = hashlib.sha256()
        with open(file_path, 'rb') as f:
            for chunk in iter(lambda: f.read(8192), b''):
                sha256.update(chunk)
        return sha256.hexdigest()

    def _create_photo_from_local(self, source_path: str, image_hash: str, original_name: str, event_id: str) -> Photo:
        """
        Create Photo record and copy file from local folder to media directory.

        Args:
            source_path: Path to source image file in local folder
            image_hash: SHA256 hash of image
            original_name: Original filename
            event_id: Event ID to associate with

        Returns:
            Created Photo instance
        """
        # Get file extension
        _, ext = os.path.splitext(original_name)
        if not ext:
            ext = '.jpg'  # Default extension

        # Destination path in media directory
        filename = f"{image_hash}{ext}"
        relative_path = os.path.join('images', filename)
        full_path = os.path.join(settings.MEDIA_ROOT, relative_path)

        # Ensure images directory exists
        os.makedirs(os.path.dirname(full_path), exist_ok=True)

        # Copy file from source to media directory
        shutil.copy2(source_path, full_path)
        logger.debug(f"[Job {self.job.id}] Copied image to: {relative_path}")

        # Create Photo record
        photo = Photo.objects.create(
            file_path=relative_path,
            image_hash=image_hash,
            event_id=event_id,
            status=Photo.STATUS_PENDING  # Will be processed by Celery task
        )

        logger.info(f"[Job {self.job.id}] Created photo record: {photo.id}")
        return photo

    def _trigger_face_detection(self, photo: Photo):
        """
        Trigger face detection Celery task for photo.

        Args:
            photo: Photo instance to process
        """
        try:
            from .tasks import process_photo

            # Queue task with slight delay to avoid overwhelming workers
            process_photo.apply_async(
                (photo.id,),
                countdown=1  # 1 second delay
            )
            logger.debug(f"[Job {self.job.id}] Queued face detection for photo {photo.id}")

        except Exception as e:
            logger.error(f"[Job {self.job.id}] Failed to queue face detection: {e}")
            # Not critical - can be processed later

    def _update_progress(self, stats: Dict):
        """
        Update job record with current progress.

        Args:
            stats: Current statistics dict
        """
        with transaction.atomic():
            self.job.images_processed = stats['images_processed']
            # Note: faces_detected will be updated after async tasks complete
            self.job.save(update_fields=['images_processed'])

    def _mark_completed(self, stats: Dict):
        """
        Mark job as completed with final statistics.

        Args:
            stats: Final processing statistics
        """
        with transaction.atomic():
            self.job.status = 'completed'
            self.job.completed_at = timezone.now()
            self.job.images_processed = stats['images_processed']
            # Note: Faces are detected asynchronously, so this count may be 0 initially
            # It will be updated as face detection tasks complete
            self.job.save(update_fields=['status', 'completed_at', 'images_processed'])

        logger.info(f"[Job {self.job.id}] Status: COMPLETED")

    def _mark_failed(self, error: str, traceback: str):
        """
        Mark job as failed with error details.

        Args:
            error: Error message
            traceback: Full error traceback
        """
        with transaction.atomic():
            self.job.status = 'failed'
            self.job.completed_at = timezone.now()
            self.job.error_log = f"{error}\n\n{traceback}"
            self.job.save(update_fields=['status', 'completed_at', 'error_log'])

        logger.info(f"[Job {self.job.id}] Status: FAILED")

    def _cleanup_temp_files(self):
        """Remove all temporary files."""
        for temp_file in self.temp_files:
            try:
                if os.path.exists(temp_file):
                    os.remove(temp_file)
                    logger.debug(f"[Job {self.job.id}] Cleaned up: {temp_file}")
            except Exception as e:
                logger.warning(f"[Job {self.job.id}] Failed to cleanup {temp_file}: {e}")

    @staticmethod
    def _sanitize_filename(filename: str) -> str:
        """
        Sanitize filename for safe filesystem storage.

        Args:
            filename: Original filename

        Returns:
            Sanitized filename
        """
        # Remove or replace unsafe characters
        import re
        # Keep only alphanumeric, dots, hyphens, underscores
        safe = re.sub(r'[^\w\.\-]', '_', filename)
        # Limit length
        if len(safe) > 100:
            name, ext = os.path.splitext(safe)
            safe = name[:95] + ext
        return safe
