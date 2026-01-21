"""
Django management command to reset the FAISS index.

Usage:
    python manage.py reset_faiss

This command will rebuild the FAISS index from all Person records in the database.
"""

from django.core.management.base import BaseCommand
from api.faiss_manager import get_faiss_manager


class Command(BaseCommand):
    help = 'Reset and rebuild the FAISS index from database'

    def handle(self, *args, **options):
        self.stdout.write('Resetting FAISS index...\n')

        try:
            # Get FAISS manager
            faiss_manager = get_faiss_manager()

            # Rebuild index
            self.stdout.write('Rebuilding index from database...', ending='')
            faiss_manager.rebuild_index()
            self.stdout.write(self.style.SUCCESS(' DONE'))

            # Show stats
            stats = faiss_manager.get_stats()
            self.stdout.write('\nFAISS Index Stats:')
            self.stdout.write(f'   - Total embeddings: {stats["total_embeddings"]}')
            self.stdout.write(f'   - Dimension: {stats["dimension"]}')
            self.stdout.write(f'   - Similarity threshold: {stats["similarity_threshold"]}')

            if stats['total_embeddings'] == 0:
                self.stdout.write(self.style.WARNING('\nWarning: Database is empty. Index will be created on first upload.'))
            else:
                self.stdout.write(self.style.SUCCESS('\nFAISS index rebuilt successfully!'))

        except Exception as e:
            self.stdout.write(self.style.ERROR(f'\nError: {str(e)}'))
            raise
