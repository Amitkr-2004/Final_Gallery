"""
Django management command to clear all images and data from the database.

Usage:
    python manage.py clear_all_data

This command will:
1. Delete all PersonPhoto mappings
2. Delete all Person records
3. Delete all Photo records
4. Delete all DailyStatistics records
5. Delete all uploaded media files (images, faces, covers)
6. Delete FAISS index files
"""

import os
import shutil
from django.core.management.base import BaseCommand, CommandError
from django.conf import settings
from api.models import Photo, Person, PersonPhoto, DailyStatistics


class Command(BaseCommand):
    help = 'Clears all images and data from the database and media files'

    def add_arguments(self, parser):
        parser.add_argument(
            '--yes',
            action='store_true',
            help='Skip confirmation prompt',
        )

    def handle(self, *args, **options):
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

        image_files = len([f for f in os.listdir(images_dir) if os.path.isfile(os.path.join(images_dir, f))]) if os.path.exists(images_dir) else 0
        face_files = len([f for f in os.listdir(faces_dir) if os.path.isfile(os.path.join(faces_dir, f))]) if os.path.exists(faces_dir) else 0
        cover_files = len([f for f in os.listdir(covers_dir) if os.path.isfile(os.path.join(covers_dir, f))]) if os.path.exists(covers_dir) else 0

        self.stdout.write(f'\nMedia Files:')
        self.stdout.write(f'   - Image files: {image_files}')
        self.stdout.write(f'   - Face files: {face_files}')
        self.stdout.write(f'   - Cover files: {cover_files}')

        # Check FAISS index
        base_dir = settings.BASE_DIR
        faiss_index = os.path.join(base_dir, 'faiss_index.bin')
        faiss_map = os.path.join(base_dir, 'faiss_id_map.npy')
        has_faiss = os.path.exists(faiss_index) or os.path.exists(faiss_map)

        if has_faiss:
            self.stdout.write(f'\nFAISS Index: Found')

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
            self.stdout.write('[1/8] Deleting PersonPhoto mappings...', ending='')
            deleted_mappings = PersonPhoto.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_mappings} deleted)'))

            self.stdout.write('[2/8] Deleting Person records...', ending='')
            deleted_persons = Person.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_persons} deleted)'))

            self.stdout.write('[3/8] Deleting Photo records...', ending='')
            deleted_photos = Photo.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_photos} deleted)'))

            self.stdout.write('[4/8] Deleting DailyStatistics records...', ending='')
            deleted_stats = DailyStatistics.objects.all().delete()[0]
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_stats} deleted)'))

            # Delete media files
            deleted_files = 0

            self.stdout.write('[5/8] Deleting image files...', ending='')
            if os.path.exists(images_dir):
                for filename in os.listdir(images_dir):
                    file_path = os.path.join(images_dir, filename)
                    if os.path.isfile(file_path) and filename != '.gitkeep':
                        os.remove(file_path)
                        deleted_files += 1
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_files} deleted)'))

            deleted_files = 0
            self.stdout.write('[6/8] Deleting face files...', ending='')
            if os.path.exists(faces_dir):
                for filename in os.listdir(faces_dir):
                    file_path = os.path.join(faces_dir, filename)
                    if os.path.isfile(file_path) and filename != '.gitkeep':
                        os.remove(file_path)
                        deleted_files += 1
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_files} deleted)'))

            deleted_files = 0
            self.stdout.write('[7/8] Deleting cover files...', ending='')
            if os.path.exists(covers_dir):
                for filename in os.listdir(covers_dir):
                    file_path = os.path.join(covers_dir, filename)
                    if os.path.isfile(file_path) and filename != '.gitkeep':
                        os.remove(file_path)
                        deleted_files += 1
            self.stdout.write(self.style.SUCCESS(f' DONE ({deleted_files} deleted)'))

            # Delete FAISS index files
            self.stdout.write('[8/8] Deleting FAISS index files...', ending='')
            faiss_deleted = 0
            if os.path.exists(faiss_index):
                os.remove(faiss_index)
                faiss_deleted += 1
            if os.path.exists(faiss_map):
                os.remove(faiss_map)
                faiss_deleted += 1
            self.stdout.write(self.style.SUCCESS(f' DONE ({faiss_deleted} files deleted)'))

            # Summary
            self.stdout.write('\n' + '='*60)
            self.stdout.write(self.style.SUCCESS('SUCCESS: All data cleared successfully!'))
            self.stdout.write('='*60 + '\n')

            self.stdout.write('Summary:')
            self.stdout.write(f'   - Database records deleted: {deleted_mappings + deleted_persons + deleted_photos + deleted_stats}')
            self.stdout.write(f'   - Media files deleted: {image_files + face_files + cover_files}')
            self.stdout.write(f'   - FAISS files deleted: {faiss_deleted}')
            self.stdout.write('\nDatabase is now empty and ready for new uploads!\n')

        except Exception as e:
            raise CommandError(f'Error during cleanup: {str(e)}')
