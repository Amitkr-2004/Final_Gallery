"""
Django management command to reprocess existing photos and create Person records.
"""
from django.core.management.base import BaseCommand
from django.conf import settings
from django.db import IntegrityError
from api.models import Photo, Person, PersonPhoto
from api.utils import detect_faces_and_extract_embeddings
from api.faiss_manager import get_faiss_manager
import os


class Command(BaseCommand):
    help = 'Reprocess all existing photos to detect faces and create Person records'

    def add_arguments(self, parser):
        parser.add_argument(
            '--min-confidence',
            type=float,
            default=0.5,
            help='Minimum face detection confidence (default: 0.5)',
        )

    def handle(self, *args, **options):
        """Reprocess all photos."""
        min_confidence = options['min_confidence']
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.7)

        self.stdout.write(f'Reprocessing all photos...')
        self.stdout.write(f'Min confidence: {min_confidence}')
        self.stdout.write(f'Similarity threshold: {similarity_threshold}')
        self.stdout.write('')

        # Get FAISS manager
        faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)

        # Get all photos
        photos = Photo.objects.all()
        total_photos = photos.count()
        self.stdout.write(f'Found {total_photos} photos to process\n')

        stats = {
            'photos_processed': 0,
            'photos_with_faces': 0,
            'total_faces_detected': 0,
            'new_persons_created': 0,
            'existing_persons_matched': 0,
            'person_photos_created': 0,
            'photos_skipped': 0,
        }

        for i, photo in enumerate(photos, 1):
            image_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)

            # Check if file exists
            if not os.path.exists(image_path):
                self.stdout.write(self.style.WARNING(
                    f'[{i}/{total_photos}] Photo {photo.id}: File not found - {image_path}'
                ))
                stats['photos_skipped'] += 1
                continue

            try:
                # Detect faces and extract embeddings
                faces = detect_faces_and_extract_embeddings(image_path, min_confidence=min_confidence)

                if len(faces) == 0:
                    self.stdout.write(f'[{i}/{total_photos}] Photo {photo.id}: No faces detected')
                    stats['photos_processed'] += 1
                    continue

                stats['photos_with_faces'] += 1
                stats['total_faces_detected'] += len(faces)

                self.stdout.write(f'[{i}/{total_photos}] Photo {photo.id}: {len(faces)} face(s) detected')

                # Process each face
                for j, (embedding, confidence) in enumerate(faces, 1):
                    # Find or create person
                    person, is_new = faiss_manager.find_or_create_person(embedding)

                    if is_new:
                        stats['new_persons_created'] += 1
                        self.stdout.write(f'  Face {j}: Created new Person {person.person_number} (confidence: {confidence:.3f})')
                    else:
                        stats['existing_persons_matched'] += 1
                        self.stdout.write(f'  Face {j}: Matched Person {person.person_number} (confidence: {confidence:.3f})')

                    # Create PersonPhoto mapping
                    try:
                        person_photo, created = PersonPhoto.objects.get_or_create(
                            person=person,
                            photo=photo
                        )
                        if created:
                            stats['person_photos_created'] += 1
                    except IntegrityError:
                        # Handle race condition
                        person_photo = PersonPhoto.objects.get(person=person, photo=photo)

                stats['photos_processed'] += 1

            except Exception as e:
                self.stdout.write(self.style.ERROR(
                    f'[{i}/{total_photos}] Photo {photo.id}: Error - {e}'
                ))
                stats['photos_skipped'] += 1
                continue

        # Print summary
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Reprocessing Complete!'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(f'Photos processed: {stats["photos_processed"]}')
        self.stdout.write(f'Photos with faces: {stats["photos_with_faces"]}')
        self.stdout.write(f'Total faces detected: {stats["total_faces_detected"]}')
        self.stdout.write(f'New persons created: {stats["new_persons_created"]}')
        self.stdout.write(f'Existing persons matched: {stats["existing_persons_matched"]}')
        self.stdout.write(f'PersonPhoto mappings created: {stats["person_photos_created"]}')
        self.stdout.write(f'Photos skipped: {stats["photos_skipped"]}')
        self.stdout.write('')
        self.stdout.write(self.style.SUCCESS(f'✓ Total collections: {Person.objects.count()}'))
