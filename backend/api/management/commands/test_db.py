"""
Django management command to test PostgreSQL database connection.
Usage: python manage.py test_db
"""
from django.core.management.base import BaseCommand
from django.db import connection
from django.conf import settings


class Command(BaseCommand):
    help = 'Test PostgreSQL database connection'

    def handle(self, *args, **options):
        """Test the database connection."""
        try:
            db_config = settings.DATABASES['default']
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('Testing PostgreSQL Database Connection'))
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(f"Database Name: {db_config['NAME']}")
            self.stdout.write(f"Database User: {db_config['USER']}")
            self.stdout.write(f"Database Host: {db_config['HOST']}")
            self.stdout.write(f"Database Port: {db_config['PORT']}")
            self.stdout.write('-' * 60)
            
            # Test connection
            with connection.cursor() as cursor:
                cursor.execute("SELECT version();")
                version = cursor.fetchone()
                self.stdout.write(self.style.SUCCESS('✓ Connection successful!'))
                self.stdout.write(self.style.SUCCESS(f'✓ PostgreSQL Version: {version[0]}'))
                
                # Test database exists
                cursor.execute("SELECT current_database();")
                current_db = cursor.fetchone()
                self.stdout.write(self.style.SUCCESS(f'✓ Connected to database: {current_db[0]}'))
                
            self.stdout.write(self.style.SUCCESS('=' * 60))
            self.stdout.write(self.style.SUCCESS('Database connection test PASSED!'))
            self.stdout.write(self.style.SUCCESS('=' * 60))
            
        except Exception as e:
            self.stdout.write(self.style.ERROR('=' * 60))
            self.stdout.write(self.style.ERROR('Database connection test FAILED!'))
            self.stdout.write(self.style.ERROR('=' * 60))
            self.stdout.write(self.style.ERROR(f'Error: {str(e)}'))
            self.stdout.write('\nTroubleshooting:')
            self.stdout.write('1. Make sure PostgreSQL is running')
            self.stdout.write('2. Verify database "photogallery" exists')
            self.stdout.write('3. Check DB_USER and DB_PASSWORD in .env file')
            self.stdout.write('4. Verify DB_HOST and DB_PORT are correct')
            self.stdout.write('5. Create .env file from env.example if it does not exist')
            self.stdout.write(self.style.ERROR('=' * 60))
            raise
