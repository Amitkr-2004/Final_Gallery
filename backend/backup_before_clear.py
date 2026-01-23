"""
Backup script to create a database dump and media files archive before clearing all data.

Usage:
    python backup_before_clear.py

This will create:
1. A PostgreSQL database dump file
2. A compressed archive of all media files
3. A backup of FAISS index files

All backups are stored in: backend/backups/backup_YYYY-MM-DD_HH-MM-SS/
"""

import os
import subprocess
import shutil
from datetime import datetime
from pathlib import Path

# Configuration
BASE_DIR = Path(__file__).resolve().parent
BACKUP_ROOT = BASE_DIR / 'backups'
MEDIA_ROOT = BASE_DIR / 'media'

# Database settings (read from environment or use defaults)
DB_NAME = os.getenv('DB_NAME', 'photogallery')
DB_USER = os.getenv('DB_USER', 'postgres')
DB_HOST = os.getenv('DB_HOST', 'localhost')
DB_PORT = os.getenv('DB_PORT', '5432')

def create_backup():
    """Create a full backup of database and media files."""

    # Create backup directory with timestamp
    timestamp = datetime.now().strftime('%Y-%m-%d_%H-%M-%S')
    backup_dir = BACKUP_ROOT / f'backup_{timestamp}'
    backup_dir.mkdir(parents=True, exist_ok=True)

    print(f"\n{'='*60}")
    print(f"Creating backup in: {backup_dir}")
    print(f"{'='*60}\n")

    # 1. Backup PostgreSQL database
    print("[1/3] Backing up PostgreSQL database...", end='')
    db_backup_file = backup_dir / f'{DB_NAME}_backup.sql'

    try:
        # Set password environment variable for pg_dump
        env = os.environ.copy()
        db_password = os.getenv('DB_PASSWORD', '')
        if db_password:
            env['PGPASSWORD'] = db_password

        # Run pg_dump
        cmd = [
            'pg_dump',
            '-h', DB_HOST,
            '-p', DB_PORT,
            '-U', DB_USER,
            '-d', DB_NAME,
            '-f', str(db_backup_file),
            '--clean',  # Include DROP statements
            '--if-exists',  # Use IF EXISTS for drops
        ]

        result = subprocess.run(cmd, env=env, capture_output=True, text=True)

        if result.returncode == 0:
            size_mb = db_backup_file.stat().st_size / (1024 * 1024)
            print(f" DONE ({size_mb:.2f} MB)")
        else:
            print(f" FAILED")
            print(f"Error: {result.stderr}")
            return False

    except FileNotFoundError:
        print(" FAILED")
        print("Error: pg_dump not found. Please install PostgreSQL client tools.")
        print("On Windows: Add PostgreSQL bin directory to PATH")
        print("On Linux: sudo apt-get install postgresql-client")
        return False
    except Exception as e:
        print(f" FAILED")
        print(f"Error: {str(e)}")
        return False

    # 2. Backup media files
    print("[2/3] Backing up media files...", end='')

    if MEDIA_ROOT.exists():
        try:
            # Count files before backup
            total_files = sum([len(files) for _, _, files in os.walk(MEDIA_ROOT)])

            # Create compressed archive
            media_backup = backup_dir / 'media_backup'
            shutil.make_archive(
                str(media_backup),
                'zip',
                str(MEDIA_ROOT)
            )

            size_mb = (media_backup.with_suffix('.zip')).stat().st_size / (1024 * 1024)
            print(f" DONE ({total_files} files, {size_mb:.2f} MB)")
        except Exception as e:
            print(f" FAILED")
            print(f"Error: {str(e)}")
            return False
    else:
        print(" SKIPPED (no media files)")

    # 3. Backup FAISS index files
    print("[3/3] Backing up FAISS index...", end='')

    faiss_index = BASE_DIR / 'faiss_index.bin'
    faiss_map = BASE_DIR / 'faiss_id_map.npy'
    faiss_backed_up = 0

    try:
        if faiss_index.exists():
            shutil.copy2(faiss_index, backup_dir / 'faiss_index.bin')
            faiss_backed_up += 1

        if faiss_map.exists():
            shutil.copy2(faiss_map, backup_dir / 'faiss_id_map.npy')
            faiss_backed_up += 1

        if faiss_backed_up > 0:
            print(f" DONE ({faiss_backed_up} files)")
        else:
            print(" SKIPPED (no FAISS index)")
    except Exception as e:
        print(f" FAILED")
        print(f"Error: {str(e)}")
        return False

    # Summary
    print(f"\n{'='*60}")
    print("SUCCESS: Backup completed successfully!")
    print(f"{'='*60}\n")
    print(f"Backup location: {backup_dir}")
    print(f"\nTo restore this backup:")
    print(f"1. Database: psql -h {DB_HOST} -U {DB_USER} -d {DB_NAME} -f \"{db_backup_file}\"")
    print(f"2. Media: Extract media_backup.zip to backend/media/")
    print(f"3. FAISS: Copy faiss_index.bin and faiss_id_map.npy to backend/")
    print()

    return True

if __name__ == '__main__':
    print("\n" + "="*60)
    print("BACKUP UTILITY - Photo Gallery Database & Media")
    print("="*60)

    # Check if database exists
    print(f"\nDatabase: {DB_NAME} (user: {DB_USER}, host: {DB_HOST}:{DB_PORT})")

    confirm = input("\nProceed with backup? (yes/no): ")
    if confirm.lower() != 'yes':
        print("Backup cancelled.")
    else:
        success = create_backup()
        if not success:
            print("\nBackup failed. Please fix errors and try again.")
            exit(1)
