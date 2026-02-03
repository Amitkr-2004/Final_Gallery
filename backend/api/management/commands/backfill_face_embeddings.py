"""
Management command to backfill face_embedding in PersonPhoto records.

This is needed for existing records that were created before face-level
embedding storage was added.

Usage:
    python manage.py backfill_face_embeddings
    python manage.py backfill_face_embeddings --rebuild-index
"""
import os
import logging
from django.core.management.base import BaseCommand
from django.conf import settings
from api.models import PersonPhoto, Person
from api.utils import detect_faces_and_extract_embeddings
from api.face_faiss_manager import get_face_faiss_manager
import numpy as np

logger = logging.getLogger(__name__)


class Command(BaseCommand):
    help = 'Backfill face_embedding in PersonPhoto records for face-level matching'

    def add_arguments(self, parser):
        parser.add_argument(
            '--rebuild-index',
            action='store_true',
            help='Rebuild the face FAISS index after backfilling',
        )
        parser.add_argument(
            '--dry-run',
            action='store_true',
            help='Show what would be done without making changes',
        )

    def handle(self, *args, **options):
        rebuild_index = options['rebuild_index']
        dry_run = options['dry_run']

        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(self.style.NOTICE("Backfilling face embeddings in PersonPhoto records"))
        self.stdout.write(self.style.NOTICE("=" * 60))

        if dry_run:
            self.stdout.write(self.style.WARNING("DRY RUN MODE - No changes will be made"))

        # Get all PersonPhoto records without face_embedding
        records_to_update = PersonPhoto.objects.filter(face_embedding__isnull=True)
        total_count = records_to_update.count()

        if total_count == 0:
            self.stdout.write(self.style.SUCCESS("All PersonPhoto records already have face embeddings!"))
            if rebuild_index:
                self._rebuild_index()
            return

        self.stdout.write(f"Found {total_count} PersonPhoto records without face_embedding")

        # Get detection confidence threshold
        min_confidence = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.5)

        updated = 0
        skipped = 0
        errors = 0

        for pp in records_to_update.select_related('photo', 'person'):
            photo = pp.photo
            person = pp.person

            # Get full path to image
            image_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)

            if not os.path.exists(image_path):
                self.stdout.write(
                    self.style.WARNING(f"  Skip PersonPhoto {pp.id}: Image not found at {image_path}")
                )
                skipped += 1
                continue

            try:
                # Detect faces in the image
                faces = detect_faces_and_extract_embeddings(image_path, min_confidence=min_confidence)

                if not faces:
                    self.stdout.write(
                        self.style.WARNING(f"  Skip PersonPhoto {pp.id}: No faces detected in {photo.file_path}")
                    )
                    skipped += 1
                    continue

                # For now, use the first detected face's embedding
                # In a more sophisticated approach, we might try to match the person's
                # existing embedding to the detected faces
                face_data = faces[0]
                embedding = face_data['embedding']
                bbox = face_data.get('bbox')

                # If person has an embedding, try to find the best matching face
                if person.embedding_vector and len(faces) > 1:
                    person_emb = np.array(person.embedding_vector, dtype=np.float32)
                    person_emb = person_emb / np.linalg.norm(person_emb)

                    best_match_idx = 0
                    best_similarity = -1

                    for i, face in enumerate(faces):
                        face_emb = np.array(face['embedding'], dtype=np.float32)
                        face_emb = face_emb / np.linalg.norm(face_emb)
                        similarity = float(np.dot(person_emb, face_emb))

                        if similarity > best_similarity:
                            best_similarity = similarity
                            best_match_idx = i

                    face_data = faces[best_match_idx]
                    embedding = face_data['embedding']
                    bbox = face_data.get('bbox')
                    self.stdout.write(
                        f"  PersonPhoto {pp.id}: Found best match (face #{best_match_idx+1}, similarity: {best_similarity:.4f})"
                    )

                if not dry_run:
                    pp.face_embedding = embedding
                    pp.face_bbox = bbox
                    pp.save(update_fields=['face_embedding', 'face_bbox'])

                updated += 1
                self.stdout.write(
                    self.style.SUCCESS(f"  Updated PersonPhoto {pp.id}: Person #{person.person_number}, Photo {photo.id}")
                )

            except Exception as e:
                self.stdout.write(
                    self.style.ERROR(f"  Error PersonPhoto {pp.id}: {str(e)}")
                )
                errors += 1
                continue

        # Summary
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(self.style.NOTICE("Summary"))
        self.stdout.write(self.style.NOTICE("=" * 60))
        self.stdout.write(f"Total records processed: {total_count}")
        self.stdout.write(f"Updated: {updated}")
        self.stdout.write(f"Skipped: {skipped}")
        self.stdout.write(f"Errors: {errors}")

        if rebuild_index and not dry_run:
            self._rebuild_index()

    def _rebuild_index(self):
        """Rebuild the face FAISS index."""
        self.stdout.write("")
        self.stdout.write(self.style.NOTICE("Rebuilding face FAISS index..."))

        face_faiss_manager = get_face_faiss_manager()
        face_faiss_manager.rebuild_index()

        stats = face_faiss_manager.get_stats()
        self.stdout.write(
            self.style.SUCCESS(f"Face FAISS index rebuilt with {stats['total_face_embeddings']} embeddings")
        )
