from django.urls import path
from . import views
from .delete_views import delete_photo, delete_person

urlpatterns = [
    path('health/', views.health_check, name='health-check'),
    path('upload/', views.upload_image, name='upload-image'),
    path('photos/', views.list_photos, name='list-photos'),
    path('photos/<int:photo_id>/', delete_photo, name='delete-photo'),
    path('persons/', views.list_persons, name='list-persons'),
    path('persons/<int:person_id>/', delete_person, name='delete-person'),
    path('persons/<int:person_id>/photos/', views.get_person_photos, name='person-photos'),
]
