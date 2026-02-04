"""
Django management command to clear all images and data from the database AND GCS.

Usage:
    python manage.py clear_all_data              # Clear local only
    python manage.py clear_all_data --include-gcs   # Clear local AND GCS

This command will:
1. Delete all PersonPhoto mappings
2. Delete all Person records
3. Delete all Photo records
4. Delete all DailyStatistics records
5. Delete all uploaded media files (images, faces, covers, thumbnails)
6. Delete FAISS index files
7. (Optional) Delete all files from GCS bucket
"""

import os
import shutil
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from api.models import Photo, Person, PersonPhoto, DailyStatistics
from api.gcs_service import get_gcs_bucket, is_gcs_configured


class Command(BaseCommand):
    help = 'Clears all images and data from the database, media files, and optionally GCS'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt',
        )
        parser.add_argument(
            '--include-gcs',
            action='store_true',
            help='Also delete all files from Google Cloud Storage',
        )

    def handle(self, *args, **options):
        include_gcs = options['include_gcs']

        # Count existing data
        photos_count = Photo.objects.count()
        persons_count = Person.objects.count()
        mappings_count = PersonPhoto.objects.count()
        stats_count = DailyStatistics.objects.count()

        self.stdout.write(self.style.WARNING('\n' + '='*60))
        self.stdout.write(self.style.WARNING('WARNING: This will delete ALL data!'))
        self.stdout.write(self.style.WARNING('='*60))
        self.stdout.write(f'\nCurrent Data:')
        self.stdout.write(f'   - Photos: {photos_count}')
        self.stdout.write(f'   - Persons: {persons_count}')
        self.stdout.write(f'   - Person-Photo Mappings: {mappings_count}')
        self.stdout.write(f'   - Daily Statistics: {stats_count}')

        # Check media files
        media_root = settings.MEDIA_ROOT
        images_dir = os.path.join(media_root, 'images')
        faces_dir = os.path.join(media_root, 'faces')
        covers_dir = os.path.join(media_root, 'covers')
        thumbnails_dir = os.path.join(media_root, 'thumbnails')

        image_files = self._count_files(images_dir)
        face_files = self._count_files(faces_dir)
        cover_files = self._count_files(covers_dir)
        thumbnail_files = self._count_files_recursive(thumbnails_dir)

        self.stdout.write(f'\nMedia Files:')
        self.stdout.write(f'   - Image files: {image_files}')
        self.stdout.write(f'   - Face files: {face_files}')
        self.stdout.write(f'   - Cover files: {cover_files}')
        self.stdout.write(f'   - Thumbnail files: {thumbnail_files}')

        # Check FAISS index
        base_dir = settings.BASE_DIR
        faiss_index = os.path.join(base_dir, 'faiss_index.bin')
        faiss_map = os.path.join(base_dir, 'faiss_id_map.npy')
        face_faiss_index = os.path.join(base_dir, 'face_faiss_index.bin')
        face_faiss_map = os.path.join(base_dir, 'face_faiss_index_id_map.npy')
        has_faiss = any(os.path.exists(f) for f in [faiss_index, faiss_map, face_faiss_index, face_faiss_map])

        if has_faiss:
            self.stdout.write(f'\nFAISS Index: Found')

        # Check GCS
        gcs_files_count = 0
        if include_gcs and is_gcs_configured():
            self.stdout.write(f'\nGCS Sync: ENABLED')
            self.stdout.flush()
            bucket = get_gcs_bucket()
            if bucket:
                # Count files in GCS (limit to avoid timeout)
                self.stdout.write(f'   - Counting GCS files...')
                self.stdout.flush()
                gcs_files_count = sum(1 for _ in bucket.list_blobs(max_results=2000))
                self.stdout.write(f'   - GCS Files: {gcs_files_count}+')
                self.stdout.flush()
        elif include_gcs:
            self.stdout.write(self.style.WARNING('\nGCS Sync: NOT CONFIGURED'))
        else:
            self.stdout.write(f'\nGCS Sync: DISABLED (use --include-gcs to enable)')
        self.stdout.flush()

        self.stdout.write(self.style.WARNING('\n' + '='*60))

        # Confirmation
        if not options['yes']:
            confirm = input('\nAre you sure you want to delete ALL data? (type "yes" to confirm): ')
            if confirm.lower() != 'yes':
                self.stdout.write(self.style.ERROR('Operation cancelled.'))
                return

        self.stdout.write('\nStarting cleanup...\n')

        try:
            # Delete database records
            self.stdout.write('[1/9] Deleting PersonPhoto mappings...', ending='')
            deleted_mappings = PersonPhoto.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_mappings} deleted)'))

            self.stdout.write('[2/9] Deleting Person records...', ending='')
            deleted_persons = Person.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_persons} deleted)'))

            self.stdout.write('[3/9] Deleting Photo records...', ending='')
            deleted_photos = Photo.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_photos} deleted)'))

            self.stdout.write('[4/9] Deleting DailyStatistics records...', ending='')
            deleted_stats = DailyStatistics.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_stats} deleted)'))

            # Delete media files
            self.stdout.write('[5/9] Deleting image files...', ending='')
            deleted_images = self._delete_files_in_dir(images_dir)
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_images} deleted)'))

            self.stdout.write('[6/9] Deleting face files...', ending='')
            deleted_faces = self._delete_files_in_dir(faces_dir)
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_faces} deleted)'))

            self.stdout.write('[7/9] Deleting cover files...', ending='')
            deleted_covers = self._delete_files_in_dir(covers_dir)
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_covers} deleted)'))

            self.stdout.write('[7b/9] Deleting thumbnail files...', ending='')
            deleted_thumbs = self._delete_dir_recursive(thumbnails_dir)
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_thumbs} deleted)'))

            # Delete FAISS index files
            self.stdout.write('[8/9] Deleting FAISS index files...', ending='')
            faiss_deleted = 0
            for faiss_file in [faiss_index, faiss_map, face_faiss_index, face_faiss_map]:
                if os.path.exists(faiss_file):
                    os.remove(faiss_file)
                    faiss_deleted += 1
            self.stdout.write(self.style.SUCCESS(f' DONE ({faiss_deleted} files deleted)'))

            # Delete from GCS
            gcs_deleted = 0
            if include_gcs and is_gcs_configured():
                self.stdout.write('[9/9] Deleting GCS files...', ending='')
                bucket = get_gcs_bucket()
                if bucket:
                    # Delete all blobs in the bucket
                    blobs = list(bucket.list_blobs())
                    for blob in blobs:
                        try:
                            blob.delete()
                            gcs_deleted += 1
                        except Exception as e:
                            self.stdout.write(self.style.WARNING(f'\n  Warning: Could not delete {blob.name}: {e}'))
                self.stdout.write(self.style.SUCCESS(f' DONE ({gcs_deleted} files deleted)'))
            else:
                self.stdout.write('[9/9] Skipping GCS (not enabled)...', ending='')
                self.stdout.write(self.style.SUCCESS(' SKIPPED'))

            # Summary
            self.stdout.write('\n' + '='*60)
            self.stdout.write(self.style.SUCCESS('SUCCESS: All data cleared successfully!'))
            self.stdout.write('='*60 + '\n')

            self.stdout.write('Summary:')
            self.stdout.write(f'   - Database records deleted: {deleted_mappings + deleted_persons + deleted_photos + deleted_stats}')
            self.stdout.write(f'   - Media files deleted: {deleted_images + deleted_faces + deleted_covers + deleted_thumbs}')
            self.stdout.write(f'   - FAISS files deleted: {faiss_deleted}')
            if include_gcs:
                self.stdout.write(f'   - GCS files deleted: {gcs_deleted}')
            self.stdout.write('\nDatabase is now empty and ready for new uploads!\n')

        except Exception as e:
            raise CommandError(f'Error during cleanup: {str(e)}')

    def _count_files(self, directory):
        """Count files in a directory (non-recursive)."""
        if not os.path.exists(directory):
            return 0
        return len([f for f in os.listdir(directory) if os.path.isfile(os.path.join(directory, f)) and f != '.gitkeep'])

    def _count_files_recursive(self, directory):
        """Count all files in a directory recursively."""
        if not os.path.exists(directory):
            return 0
        count = 0
        for root, dirs, files in os.walk(directory):
            count += len([f for f in files if f != '.gitkeep'])
        return count

    def _delete_files_in_dir(self, directory):
        """Delete all files in a directory (non-recursive)."""
        deleted = 0
        if os.path.exists(directory):
            for filename in os.listdir(directory):
                file_path = os.path.join(directory, filename)
                if os.path.isfile(file_path) and filename != '.gitkeep':
                    os.remove(file_path)
                    deleted += 1
        return deleted

    def _delete_dir_recursive(self, directory):
        """Delete all files in a directory recursively."""
        deleted = 0
        if os.path.exists(directory):
            for root, dirs, files in os.walk(directory):
                for filename in files:
                    if filename != '.gitkeep':
                        file_path = os.path.join(root, filename)
                        os.remove(file_path)
                        deleted += 1
        return deleted
