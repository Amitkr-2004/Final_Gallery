"""
Scheduler Diagnostic Tool

Checks the status of scheduled jobs and identifies issues.
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from api.models import ScheduledJob

def check_celery_running():
    """Check if Celery worker and beat are running."""
    print("\n" + "="*60)
    print("CELERY STATUS CHECK")
    print("="*60)

    # Check if celerybeat-schedule file exists (indicates beat is/was running)
    beat_file = os.path.join(os.path.dirname(__file__), 'celerybeat-schedule.db')
    if os.path.exists(beat_file):
        print("✓ Celery Beat schedule file found")

        # Check file modification time
        import datetime
        mtime = os.path.getmtime(beat_file)
        last_modified = datetime.datetime.fromtimestamp(mtime)
        now = datetime.datetime.now()
        seconds_ago = (now - last_modified).total_seconds()

        if seconds_ago < 120:  # Updated in last 2 minutes
            print(f"✓ Celery Beat is RUNNING (last update: {int(seconds_ago)}s ago)")
        else:
            print(f"⚠ Celery Beat might be STOPPED (last update: {int(seconds_ago)}s ago)")
            print(f"  Last modified: {last_modified}")
    else:
        print("✗ Celery Beat schedule file NOT found")
        print("  This means Celery Beat has never been started.")

    print("\nTo start Celery services:")
    print("  Worker:  celery -A config worker -l info")
    print("  Beat:    celery -A config beat -l info")


def check_scheduled_jobs():
    """Check scheduled jobs in database."""
    print("\n" + "="*60)
    print("SCHEDULED JOBS STATUS")
    print("="*60)

    # Get all active jobs
    jobs = ScheduledJob.objects.filter(is_active=True).order_by('-created_at')

    if not jobs.exists():
        print("\n✗ No active scheduled jobs found")
        print("\nCreate a job via the Time Scheduler page:")
        print("  http://localhost:3000/time-scheduler")
        return

    print(f"\nFound {jobs.count()} active job(s):\n")

    now = timezone.now()

    for job in jobs:
        print(f"Job ID: {job.id}")
        print(f"  Status: {job.status}")
        print(f"  Scheduled Time: {job.scheduled_time}")
        print(f"  Folder Path: {job.folder_path}")
        print(f"  Created: {job.created_at}")

        # Check if job should have executed
        if job.scheduled_time <= now:
            time_passed = (now - job.scheduled_time).total_seconds()
            print(f"  ⏰ Should execute: YES (scheduled {int(time_passed)}s ago)")

            if job.status == 'pending':
                print(f"  ⚠ WARNING: Job is still PENDING!")
                print(f"     This means Celery Beat is NOT running or not working.")
            elif job.status == 'running':
                print(f"  ⏳ Job is currently RUNNING")
            elif job.status == 'completed':
                print(f"  ✓ Job COMPLETED successfully")
                print(f"     Images processed: {job.images_processed}")
                print(f"     Faces detected: {job.faces_detected}")
                print(f"     Event ID: {job.event_id}")
            elif job.status == 'failed':
                print(f"  ✗ Job FAILED")
                if job.error_log:
                    print(f"     Error: {job.error_log[:200]}...")
        else:
            time_until = (job.scheduled_time - now).total_seconds()
            print(f"  ⏰ Will execute in: {int(time_until)}s")

        if job.started_at:
            print(f"  Started: {job.started_at}")
        if job.completed_at:
            print(f"  Completed: {job.completed_at}")

        print()


def check_folder_path(folder_path):
    """Check if folder path is valid."""
    from pathlib import Path

    print("\n" + "="*60)
    print("FOLDER PATH VALIDATION")
    print("="*60)

    if not folder_path:
        print("\n✗ No folder path provided")
        return

    print(f"\nChecking: {folder_path}")

    path = Path(folder_path)

    # Check existence
    if not path.exists():
        print(f"✗ Folder does NOT exist")
        return
    else:
        print(f"✓ Folder exists")

    # Check if directory
    if not path.is_dir():
        print(f"✗ Path is NOT a directory (it's a file)")
        return
    else:
        print(f"✓ Path is a directory")

    # Check permissions
    if not os.access(path, os.R_OK):
        print(f"✗ Folder is NOT readable (permission denied)")
        return
    else:
        print(f"✓ Folder is readable")

    # Count images
    from django.conf import settings
    extensions = settings.ALLOWED_IMAGE_EXTENSIONS

    images = []
    for ext in extensions:
        images.extend(list(path.rglob(f'*{ext}')))
        images.extend(list(path.rglob(f'*{ext.upper()}')))

    image_count = len(set(images))

    if image_count == 0:
        print(f"⚠ No images found in folder")
        print(f"  Supported formats: {', '.join(extensions)}")
    else:
        print(f"✓ Found {image_count} image(s) in folder")


def main():
    print("="*60)
    print("TIME SCHEDULER DIAGNOSTIC TOOL")
    print("="*60)

    # 1. Check Celery status
    check_celery_running()

    # 2. Check scheduled jobs
    check_scheduled_jobs()

    # 3. If there's an active job, check its folder path
    job = ScheduledJob.objects.filter(is_active=True).first()
    if job:
        check_folder_path(job.folder_path)

    print("\n" + "="*60)
    print("DIAGNOSIS COMPLETE")
    print("="*60)

    # Print recommendations
    print("\n📋 RECOMMENDATIONS:\n")

    job = ScheduledJob.objects.filter(is_active=True, status='pending').first()
    if job:
        now = timezone.now()
        if job.scheduled_time <= now:
            print("⚠ You have a PENDING job that should have executed!")
            print("\n  Issue: Celery Beat is not running")
            print("\n  Solution:")
            print("    1. Open a new terminal")
            print("    2. Navigate to backend folder: cd D:\\Gallery_VSCode\\backend")
            print("    3. Activate virtual environment: venv\\Scripts\\activate")
            print("    4. Start Celery Beat: celery -A config beat -l info")
            print("\n  Also make sure Celery Worker is running:")
            print("    1. Open another terminal")
            print("    2. Navigate to backend folder")
            print("    3. Activate virtual environment")
            print("    4. Start Worker: celery -A config worker -l info")

    print("\n✓ If Celery is running and jobs are executing, everything is working!")
    print()


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print(f"\n✗ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
