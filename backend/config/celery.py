"""
Celery configuration for async task processing.

This module configures Celery for background image processing tasks:
- Thumbnail generation
- Face detection
- FAISS matching
- Person creation

Workers can be scaled horizontally for better performance.
"""

import os
from celery import Celery

# Set default Django settings module
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Create Celery app
app = Celery('gallery')

# Load config from Django settings with 'CELERY' namespace
# This means all celery-related settings should start with 'CELERY_'
app.config_from_object('django.conf:settings', namespace='CELERY')

# Auto-discover tasks from all installed apps
# This will look for 'tasks.py' in each Django app
app.autodiscover_tasks()

# Configure Celery Beat schedule for periodic tasks
from celery.schedules import crontab

app.conf.beat_schedule = {
    'check-scheduled-jobs-every-minute': {
        'task': 'api.tasks.check_and_execute_scheduled_jobs',
        'schedule': crontab(minute='*/1'),  # Run every minute
        'options': {
            'expires': 50,  # Task expires after 50 seconds (before next run)
        }
    },
}


@app.task(bind=True, ignore_result=True)
def debug_task(self):
    """Debug task for testing Celery workers."""
    print(f'Request: {self.request!r}')
