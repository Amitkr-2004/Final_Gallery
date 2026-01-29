#!/usr/bin/env python
"""
Diagnostic script to check Time Scheduler setup.

Run this to verify:
- Database connectivity
- Scheduled jobs in database
- Celery configuration
- Drive credentials

Usage:
    cd backend
    python check_scheduler.py
"""

import os
import sys
import django

# Setup Django
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from django.utils import timezone
from api.models import ScheduledJob
from datetime import datetime

def check_database():
    """Check database connectivity and scheduled jobs."""
    print("=" * 60)
    print("1. DATABASE CHECK")
    print("=" * 60)

    try:
        # Count total jobs
        total_jobs = ScheduledJob.objects.count()
        active_jobs = ScheduledJob.objects.filter(is_active=True).count()
        pending_jobs = ScheduledJob.objects.filter(status='pending', is_active=True).count()

        print(f"[OK] Database connected successfully")
        print(f"  - Total jobs (all time): {total_jobs}")
        print(f"  - Active jobs: {active_jobs}")
        print(f"  - Pending jobs: {pending_jobs}")

        # Show all active jobs
        if active_jobs > 0:
            print("\n  Active Jobs:")
            for job in ScheduledJob.objects.filter(is_active=True):
                print(f"    - Job {job.id}: {job.status}")
                print(f"      Scheduled: {job.scheduled_time}")
                print(f"      Drive Link: {job.drive_link[:50]}...")

                # Check if job is overdue
                now = timezone.now()
                if job.status == 'pending' and job.scheduled_time <= now:
                    delay = (now - job.scheduled_time).total_seconds()
                    print(f"      WARNING: OVERDUE by {delay:.0f} seconds!")
                    print(f"      -> This means Celery Beat is NOT running or NOT checking!")

        return True

    except Exception as e:
        print(f"[FAIL] Database error: {e}")
        return False


def check_celery_config():
    """Check Celery configuration."""
    print("\n" + "=" * 60)
    print("2. CELERY CONFIGURATION CHECK")
    print("=" * 60)

    try:
        from config.celery import app

        print("[OK] Celery app loaded successfully")

        # Check Beat schedule
        if hasattr(app.conf, 'beat_schedule'):
            schedule = app.conf.beat_schedule
            print(f"[OK] Beat schedule configured: {len(schedule)} task(s)")

            if 'check-scheduled-jobs-every-minute' in schedule:
                task_config = schedule['check-scheduled-jobs-every-minute']
                print(f"  [OK] Scheduler task found:")
                print(f"    - Task: {task_config['task']}")
                print(f"    - Schedule: Every minute")
                print(f"    - Expires: {task_config.get('options', {}).get('expires', 'N/A')}s")
            else:
                print("  [FAIL] Scheduler task NOT found in beat_schedule!")
                print("    Expected: 'check-scheduled-jobs-every-minute'")
                return False
        else:
            print("[FAIL] Beat schedule NOT configured!")
            return False

        # Check broker
        broker = app.conf.broker_url
        print(f"[OK] Broker URL: {broker}")

        return True

    except Exception as e:
        print(f"[FAIL] Celery config error: {e}")
        import traceback
        traceback.print_exc()
        return False


def check_redis():
    """Check Redis connectivity."""
    print("\n" + "=" * 60)
    print("3. REDIS CHECK")
    print("=" * 60)

    try:
        import redis
        r = redis.Redis(host='localhost', port=6379, db=0)
        r.ping()
        print("[OK] Redis is running and accessible")
        return True
    except ImportError:
        print("[FAIL] Redis package not installed (pip install redis)")
        return False
    except Exception as e:
        print(f"[FAIL] Cannot connect to Redis: {e}")
        print("  Make sure Redis is running: redis-server")
        return False


def check_drive_credentials():
    """Check Google Drive credentials."""
    print("\n" + "=" * 60)
    print("4. GOOGLE DRIVE CREDENTIALS CHECK")
    print("=" * 60)

    creds_path = os.path.join(os.path.dirname(__file__), 'drive_credentials.json')

    if os.path.exists(creds_path):
        print(f"[OK] Credentials file found: {creds_path}")

        try:
            import json
            with open(creds_path, 'r') as f:
                creds = json.load(f)

            if 'client_email' in creds:
                print(f"  Service Account: {creds['client_email']}")
                print("  Remember to share Drive folders with this email!")
            else:
                print("  [FAIL] Invalid credentials format (missing client_email)")
                return False

            return True

        except Exception as e:
            print(f"  [FAIL] Error reading credentials: {e}")
            return False
    else:
        print(f"[FAIL] Credentials file NOT found: {creds_path}")
        print("  Download from Google Cloud Console and save as drive_credentials.json")
        return False


def check_celery_processes():
    """Check if Celery processes are running."""
    print("\n" + "=" * 60)
    print("5. CELERY PROCESSES CHECK")
    print("=" * 60)

    print("Checking for running Celery processes...")
    print("(This check may not work on all systems)")

    try:
        import subprocess

        # Check for celery processes (Unix/Linux/Mac)
        if sys.platform != 'win32':
            result = subprocess.run(['ps', 'aux'], capture_output=True, text=True)
            celery_lines = [line for line in result.stdout.split('\n') if 'celery' in line.lower()]

            worker_running = any('worker' in line for line in celery_lines)
            beat_running = any('beat' in line for line in celery_lines)

            if worker_running:
                print("[OK] Celery Worker appears to be running")
            else:
                print("[FAIL] Celery Worker NOT detected")
                print("  Run: celery -A config worker --loglevel=info")

            if beat_running:
                print("[OK] Celery Beat appears to be running")
            else:
                print("[FAIL] Celery Beat NOT detected")
                print("  Run: celery -A config beat --loglevel=info")
                print("  WARNING: WITHOUT CELERY BEAT, SCHEDULED JOBS WILL NOT RUN!")

            return worker_running and beat_running
        else:
            # Windows - use tasklist
            result = subprocess.run(['tasklist'], capture_output=True, text=True)
            celery_running = 'celery' in result.stdout.lower()

            if celery_running:
                print("[OK] Celery process detected (worker or beat)")
                print("  Note: Cannot distinguish between worker and beat on Windows")
                print("  Make sure BOTH are running in separate terminals!")
            else:
                print("[FAIL] No Celery processes detected")
                print("  Terminal 1: celery -A config worker --loglevel=info")
                print("  Terminal 2: celery -A config beat --loglevel=info")

            return celery_running

    except Exception as e:
        print(f"WARNING: Could not check processes: {e}")
        print("  Manually verify:")
        print("  - Terminal with 'celery worker' should show [tasks] list")
        print("  - Terminal with 'celery beat' should show periodic task schedule")
        return None


def main():
    """Run all diagnostic checks."""
    print("\n")
    print("=" * 60)
    print(" TIME SCHEDULER DIAGNOSTIC".center(60))
    print("=" * 60)
    print()

    checks = {
        'Database': check_database(),
        'Celery Config': check_celery_config(),
        'Redis': check_redis(),
        'Drive Credentials': check_drive_credentials(),
        'Celery Processes': check_celery_processes(),
    }

    print("\n" + "=" * 60)
    print("SUMMARY")
    print("=" * 60)

    for name, status in checks.items():
        if status is True:
            print(f"[OK] {name}")
        elif status is False:
            print(f"[FAILED] {name}")
        else:
            print(f"[UNKNOWN] {name}")

    all_passed = all(s is True for s in checks.values())

    print("\n" + "=" * 60)
    if all_passed:
        print("*** ALL CHECKS PASSED! ***")
        print("\nYour scheduler should be working correctly.")
        print("If jobs still don't run:")
        print("  1. Check Django server logs")
        print("  2. Check Celery Beat terminal output")
        print("  3. Check Celery Worker terminal output")
    else:
        print("*** SOME CHECKS FAILED ***")
        print("\nPlease fix the issues above, then:")
        print("  1. Restart Django server")
        print("  2. Restart Celery Worker")
        print("  3. Restart Celery Beat")
        print("  4. Try scheduling a job again")

    print("=" * 60)
    print()


if __name__ == '__main__':
    main()
