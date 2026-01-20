"""
Script to test PostgreSQL database connection.
Run this script to verify database connectivity before running migrations.
"""
import os
import sys
import django

# Setup Django
sys.path.append(os.path.dirname(os.path.abspath(__file__)))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.db import connection
from django.conf import settings

def test_database_connection():
    """Test the database connection."""
    try:
        db_config = settings.DATABASES['default']
        print("=" * 60)
        print("Testing PostgreSQL Database Connection")
        print("=" * 60)
        print(f"Database Name: {db_config['NAME']}")
        print(f"Database User: {db_config['USER']}")
        print(f"Database Host: {db_config['HOST']}")
        print(f"Database Port: {db_config['PORT']}")
        print("-" * 60)
        
        # Test connection
        with connection.cursor() as cursor:
            cursor.execute("SELECT version();")
            version = cursor.fetchone()
            print(f"✓ Connection successful!")
            print(f"✓ PostgreSQL Version: {version[0]}")
            
            # Test database exists
            cursor.execute("SELECT current_database();")
            current_db = cursor.fetchone()
            print(f"✓ Connected to database: {current_db[0]}")
            
        print("=" * 60)
        print("Database connection test PASSED!")
        print("=" * 60)
        return True
        
    except Exception as e:
        print("=" * 60)
        print("Database connection test FAILED!")
        print("=" * 60)
        print(f"Error: {str(e)}")
        print("\nTroubleshooting:")
        print("1. Make sure PostgreSQL is running")
        print("2. Verify database 'photogallery' exists")
        print("3. Check DB_USER and DB_PASSWORD in .env file")
        print("4. Verify DB_HOST and DB_PORT are correct")
        print("=" * 60)
        return False

if __name__ == '__main__':
    success = test_database_connection()
    sys.exit(0 if success else 1)
