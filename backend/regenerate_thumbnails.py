"""
Script to regenerate all thumbnails with correct unique filenames.

This fixes the bug where all thumbnails were named "images_small.webp"
and overwrote each other.
"""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Photo
from api.tasks import generate_thumbnails
from django.conf import settings
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

def regenerate_all_thumbnails():
    """Regenerate thumbnails for all photos with unique filenames."""
    photos = Photo.objects.all()
    total = photos.count()

    logger.info(f"Starting thumbnail regeneration for {total} photos...")
    logger.info("=" * 70)

    success_count = 0
    error_count = 0

    for i, photo in enumerate(photos, 1):
        try:
            # Get full path to image
            image_full_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)

            if not os.path.exists(image_full_path):
                logger.warning(f"[{i}/{total}] Photo {photo.id}: Image not found at {image_full_path}")
                error_count += 1
                continue

            # Regenerate thumbnails with new unique naming
            logger.info(f"[{i}/{total}] Photo {photo.id}: Regenerating thumbnails...")
            thumbnail_paths = generate_thumbnails(image_full_path)

            if thumbnail_paths:
                # Update photo record
                old_small = photo.thumbnail_small
                old_medium = photo.thumbnail_medium

                photo.thumbnail_small = thumbnail_paths['small']
                photo.thumbnail_medium = thumbnail_paths['medium']
                photo.save(update_fields=['thumbnail_small', 'thumbnail_medium'])

                logger.info(
                    f"[{i}/{total}] Photo {photo.id}: SUCCESS\n"
                    f"  Old small: {old_small}\n"
                    f"  New small: {thumbnail_paths['small']}\n"
                    f"  Old medium: {old_medium}\n"
                    f"  New medium: {thumbnail_paths['medium']}"
                )
                success_count += 1
            else:
                logger.error(f"[{i}/{total}] Photo {photo.id}: Failed to generate thumbnails")
                error_count += 1

        except Exception as e:
            logger.error(f"[{i}/{total}] Photo {photo.id}: Error - {str(e)}", exc_info=True)
            error_count += 1
            continue

    logger.info("=" * 70)
    logger.info(f"Thumbnail regeneration complete!")
    logger.info(f"  Success: {success_count}/{total}")
    logger.info(f"  Errors:  {error_count}/{total}")

if __name__ == '__main__':
    regenerate_all_thumbnails()
