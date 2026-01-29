from django.urls import path
from . import views
from .delete_views import delete_photo, delete_person
from .collection_views import scan_face, get_collection_photos
from .scheduler_views import ScheduledJobView, JobStatusView
from .gcs_views import (
    get_signed_upload_url,
    get_signed_upload_urls_batch,
    register_upload,
    test_gcs_connection
)

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('upload/', views.upload_image, name='upload-image'),
    path('photos/', views.list_photos, name='list-photos'),
    path('photos/<int:photo_id>/', delete_photo, name='delete-photo'),
    path('persons/', views.list_persons, name='list-persons'),
    path('persons/<int:person_id>/', delete_person, name='delete-person'),
    path('persons/<int:person_id>/photos/', views.get_person_photos, name='person-photos'),
    path('statistics/', views.get_statistics, name='statistics'),
    # Your Collection feature
    path('collection/scan-face/', scan_face, name='scan-face'),
    path('collection/<int:person_id>/photos/', get_collection_photos, name='collection-photos'),
    # Time Scheduler feature
    path('scheduler/job/', ScheduledJobView.as_view(), name='scheduled-job'),
    path('scheduler/job/status/', JobStatusView.as_view(), name='job-status'),
    # GCS Upload endpoints (for Electron app)
    path('gcs/get-signed-upload-url/', get_signed_upload_url, name='gcs-signed-upload-url'),
    path('gcs/get-signed-upload-urls-batch/', get_signed_upload_urls_batch, name='gcs-signed-upload-urls-batch'),
    path('gcs/register-upload/', register_upload, name='gcs-register-upload'),
    path('gcs/test-connection/', test_gcs_connection, name='gcs-test-connection'),
]
