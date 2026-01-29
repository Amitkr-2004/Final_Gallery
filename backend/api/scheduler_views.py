"""
API views for Time Scheduler feature.

Endpoints:
- GET /api/scheduler/job/ - Get current active job
- POST /api/scheduler/job/ - Create or update scheduled job
- DELETE /api/scheduler/job/ - Cancel pending job
"""

import logging
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from django.db import transaction

from .models import ScheduledJob
from .serializers import ScheduledJobSerializer

logger = logging.getLogger(__name__)


class ScheduledJobView(APIView):
    """
    Manage scheduled jobs.

    GET: Retrieve current active job (returns null if none)
    POST: Create or update scheduled job (only one active at a time)
    DELETE: Cancel pending job (soft delete)
    """

    def get(self, request):
        """
        Get the current active scheduled job.

        Returns:
            200: Job data (or null if no active job)
        """
        try:
            # Get the most recent active job
            job = ScheduledJob.objects.filter(is_active=True).first()

            if not job:
                return Response(None, status=status.HTTP_200_OK)

            serializer = ScheduledJobSerializer(job)
            return Response(serializer.data, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching scheduled job: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to fetch scheduled job'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def post(self, request):
        """
        Create or update a scheduled job.

        Only one active job allowed at a time.
        If an active job exists, it will be soft-deleted and replaced.

        Request body:
            {
                "scheduled_time": "2026-01-27T10:30:00Z",
                "folder_path": "C:\\Users\\AMIT\\Downloads\\Images"
            }

        Returns:
            201: Job created successfully
            400: Validation error
        """
        try:
            # Validate input
            serializer = ScheduledJobSerializer(data=request.data)
            if not serializer.is_valid():
                return Response(
                    serializer.errors,
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # Soft-delete any existing active jobs
                existing_jobs = ScheduledJob.objects.filter(is_active=True)
                if existing_jobs.exists():
                    logger.info(f"Soft-deleting {existing_jobs.count()} existing job(s)")
                    existing_jobs.update(is_active=False)

                # Create new job
                job = serializer.save()
                logger.info(f"Created scheduled job {job.id} for {job.scheduled_time}")

            return Response(
                ScheduledJobSerializer(job).data,
                status=status.HTTP_201_CREATED
            )

        except Exception as e:
            logger.error(f"Error creating scheduled job: {e}", exc_info=True)
            # Return detailed error for debugging
            import traceback
            error_detail = str(e)
            error_trace = traceback.format_exc()

            # Log the full trace
            logger.error(f"Full traceback: {error_trace}")

            return Response(
                {
                    'error': f'Failed to create scheduled job: {error_detail}',
                    'detail': str(e),
                    'type': type(e).__name__
                },
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    def delete(self, request):
        """
        Cancel the current scheduled job (soft delete).

        Only pending jobs can be cancelled.
        Running or completed jobs cannot be deleted.

        Returns:
            200: Job cancelled successfully
            400: Job cannot be cancelled (not pending)
            404: No active job found
        """
        try:
            # Get current active job
            job = ScheduledJob.objects.filter(is_active=True).first()

            if not job:
                return Response(
                    {'error': 'No active job found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Check if job can be cancelled
            if job.status != 'pending':
                return Response(
                    {
                        'error': f'Cannot cancel job with status "{job.status}". '
                                 'Only pending jobs can be cancelled.'
                    },
                    status=status.HTTP_400_BAD_REQUEST
                )

            # Soft delete
            with transaction.atomic():
                job.is_active = False
                job.save(update_fields=['is_active'])
                logger.info(f"Cancelled scheduled job {job.id}")

            return Response(
                {'message': 'Job cancelled successfully'},
                status=status.HTTP_200_OK
            )

        except Exception as e:
            logger.error(f"Error cancelling scheduled job: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to cancel scheduled job'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )


class JobStatusView(APIView):
    """
    Get real-time status of current job.

    This endpoint is lightweight and optimized for polling.
    """

    def get(self, request):
        """
        Get minimal status info for current job.

        Returns:
            200: {
                "id": 1,
                "status": "pending",
                "images_processed": 0,
                "faces_detected": 0
            }
            404: No active job
        """
        try:
            job = ScheduledJob.objects.filter(is_active=True).first()

            if not job:
                return Response(
                    {'error': 'No active job found'},
                    status=status.HTTP_404_NOT_FOUND
                )

            # Return minimal data for efficient polling
            return Response({
                'id': job.id,
                'status': job.status,
                'images_processed': job.images_processed,
                'faces_detected': job.faces_detected,
                'error_log': job.error_log if job.status == 'failed' else ''
            }, status=status.HTTP_200_OK)

        except Exception as e:
            logger.error(f"Error fetching job status: {e}", exc_info=True)
            return Response(
                {'error': 'Failed to fetch job status'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )
