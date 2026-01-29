#!/usr/bin/env python
"""
Manual test script to execute the scheduled job immediately.

This bypasses Celery Beat and runs the job directly.
Useful for testing without starting all services.

Usage:
    cd backend
    python test_job_manual.py
"""

import os
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import ScheduledJob
from api.tasks import execute_scheduled_job

def main():
    print("=" * 60)
    print("  MANUAL JOB EXECUTION TEST")
    print("=" * 60)
    print()

    # Find pending jobs
    jobs = ScheduledJob.objects.filter(status='pending', is_active=True)

    if not jobs.exists():
        print("No pending jobs found.")
        print()
        print("Check Time Scheduler page and create a job first.")
        return

    print(f"Found {jobs.count()} pending job(s):")
    print()

    for job in jobs:
        print(f"Job ID: {job.id}")
        print(f"Scheduled: {job.scheduled_time}")
        print(f"Drive Link: {job.drive_link}")
        print(f"Status: {job.status}")
        print()

    # Ask for confirmation
    job_id = input("Enter Job ID to execute (or 'q' to quit): ").strip()

    if job_id.lower() == 'q':
        print("Cancelled.")
        return

    try:
        job_id = int(job_id)
    except ValueError:
        print("Invalid job ID.")
        return

    # Execute the job
    print()
    print("=" * 60)
    print(f"  EXECUTING JOB {job_id}")
    print("=" * 60)
    print()

    try:
        result = execute_scheduled_job(job_id)

        print()
        print("=" * 60)
        print("  RESULT")
        print("=" * 60)
        print(f"Success: {result.get('success')}")

        if result.get('success'):
            stats = result.get('stats', {})
            print(f"Images Processed: {stats.get('images_processed', 0)}")
            print(f"Duplicates Skipped: {stats.get('duplicates_skipped', 0)}")
            print(f"Errors: {stats.get('errors', 0)}")
        else:
            print(f"Error: {result.get('error')}")

        print()

        # Refresh and show updated job
        job = ScheduledJob.objects.get(id=job_id)
        print(f"Job Status: {job.status}")
        if job.status == 'completed':
            print(f"Event ID: {job.event_id}")
            print(f"Images: {job.images_processed}")
        elif job.status == 'failed':
            print("Error Log:")
            print(job.error_log)

    except Exception as e:
        print(f"Error executing job: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
