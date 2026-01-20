"""
Django management command to rebuild FAISS index from Person records.
Usage: python manage.py rebuild_faiss
"""
from django.core.management.base import BaseCommand
from api.faiss_manager import get_faiss_manager
from django.conf import settings


class Command(BaseCommand):
    help = 'Rebuild FAISS index from all Person records in database'

    def handle(self, *args, **options):
        """Rebuild the FAISS index."""
        self.stdout.write('Rebuilding FAISS index...')
        
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.7)
        faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)
        
        # Rebuild index
        faiss_manager.rebuild_index()
        
        # Get stats
        stats = faiss_manager.get_stats()
        
        self.stdout.write(self.style.SUCCESS('✓ FAISS index rebuilt successfully!'))
        self.stdout.write(f'  Total embeddings: {stats["total_embeddings"]}')
        self.stdout.write(f'  Dimension: {stats["dimension"]}')
        self.stdout.write(f'  Similarity threshold: {stats["similarity_threshold"]}')
