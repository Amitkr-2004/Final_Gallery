"""
Helper script to apply the folder_path migration.

This script checks the database state and applies the migration if needed.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.core.management import call_command
from django.db import connection

def check_database_column():
    """Check if the database has the correct column."""
    with connection.cursor() as cursor:
        # For SQLite, use PRAGMA table_info
        # For PostgreSQL/MySQL, this would need different query
        try:
            cursor.execute("PRAGMA table_info(api_scheduledjob)")
            columns = [row[1] for row in cursor.fetchall()]
        except:
            # If PRAGMA doesn't work, try querying the table directly
            try:
                cursor.execute("SELECT * FROM api_scheduledjob LIMIT 0")
                columns = [desc[0] for desc in cursor.description]
            except Exception as e:
                print(f"Error checking columns: {e}")
                return False, False

        print("Current columns in api_scheduledjob table:")
        for col in columns:
            print(f"  - {col}")

        has_drive_link = 'drive_link' in columns
        has_folder_path = 'folder_path' in columns

        print(f"\nHas 'drive_link' column: {has_drive_link}")
        print(f"Has 'folder_path' column: {has_folder_path}")

        return has_drive_link, has_folder_path

def main():
    print("=" * 60)
    print("Migration Helper Script")
    print("=" * 60)
    print()

    try:
        # Check current state
        print("Step 1: Checking database state...")
        has_drive_link, has_folder_path = check_database_column()
        print()

        if has_folder_path and not has_drive_link:
            print("✓ Database is already up to date!")
            print("  The 'folder_path' column exists.")
            print()
            print("If you're still getting errors, try:")
            print("  1. Restart Django server")
            print("  2. Clear browser cache")
            print("  3. Check backend logs for detailed error")
            return 0

        if has_drive_link and not has_folder_path:
            print("⚠ Database needs migration!")
            print("  The old 'drive_link' column exists but 'folder_path' doesn't.")
            print()

            # Apply migration
            print("Step 2: Applying migration...")
            call_command('migrate', 'api', '0008')
            print("✓ Migration applied successfully!")
            print()

            # Verify
            print("Step 3: Verifying migration...")
            has_drive_link, has_folder_path = check_database_column()

            if has_folder_path and not has_drive_link:
                print("✓ Migration verified! Database is now up to date.")
                print()
                print("Next steps:")
                print("  1. Restart Django server")
                print("  2. Refresh browser")
                print("  3. Try scheduling a job again")
            else:
                print("✗ Migration verification failed. Please check manually.")
            return 0

        elif not has_drive_link and not has_folder_path:
            print("✗ Error: Neither column exists. Database may not be initialized.")
            print()
            print("Please run: python manage.py migrate")
            return 1

        else:
            print("⚠ Warning: Both columns exist. This is unexpected.")
            print("  You may need to manually resolve this.")
            return 1

    except Exception as e:
        print(f"✗ Error: {e}")
        import traceback
        traceback.print_exc()
        print()
        print("If you see 'ModuleNotFoundError', activate your virtual environment:")
        print("  Windows: .\\venv\\Scripts\\activate")
        print("  Linux/Mac: source venv/bin/activate")
        return 1

if __name__ == '__main__':
    sys.exit(main())
