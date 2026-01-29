from rest_framework import serializers
from .models import Photo, Person, DailyStatistics, ScheduledJob
from django.conf import settings
from django.utils import timezone


class ImageUploadSerializer(serializers.Serializer):
    """Serializer for image upload."""
    image = serializers.ImageField(required=True)


class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for Photo model."""
    image_url = serializers.SerializerMethodField()

    class Meta:
        model = Photo
        fields = [
            'id', 'file_path', 'image_hash', 'event_id', 'uploaded_at', 'image_url',
            'status', 'processed_at', 'thumbnail_small', 'thumbnail_medium'
        ]
        read_only_fields = ['id', 'image_hash', 'uploaded_at', 'status', 'processed_at']
    
    def get_image_url(self, obj):
        """Return the full URL for the image."""
        return f"{settings.MEDIA_URL}{obj.file_path}"


class PersonSerializer(serializers.ModelSerializer):
    """Serializer for Person model."""
    photo_count = serializers.SerializerMethodField()
    face_image_url = serializers.SerializerMethodField()

    class Meta:
        model = Person
        fields = ['id', 'person_number', 'created_at', 'photo_count', 'face_image_url']
        read_only_fields = ['id', 'person_number', 'created_at']

    def get_photo_count(self, obj):
        """Return the number of photos linked to this person."""
        return obj.person_photos.count()

    def get_face_image_url(self, obj):
        """Return the URL of the first photo for this person."""
        first_person_photo = obj.person_photos.first()
        if first_person_photo and first_person_photo.photo:
            return f"{settings.MEDIA_URL}{first_person_photo.photo.file_path}"
        return None


class DailyStatisticsSerializer(serializers.ModelSerializer):
    """Serializer for DailyStatistics model."""

    class Meta:
        model = DailyStatistics
        fields = ['id', 'date', 'photos_uploaded', 'faces_detected', 'created_at', 'updated_at']
        read_only_fields = ['id', 'created_at', 'updated_at']


class ScheduledJobSerializer(serializers.ModelSerializer):
    """Serializer for ScheduledJob model."""

    class Meta:
        model = ScheduledJob
        fields = [
            'id', 'scheduled_time', 'folder_path', 'status',
            'created_at', 'started_at', 'completed_at',
            'event_id', 'images_processed', 'faces_detected',
            'error_log'
        ]
        read_only_fields = [
            'id', 'status', 'created_at', 'started_at', 'completed_at',
            'event_id', 'images_processed', 'faces_detected', 'error_log'
        ]

    def validate_scheduled_time(self, value):
        """Ensure scheduled time is in the future."""
        now = timezone.now()
        # Allow times that are at least 30 seconds in the future (to account for processing time)
        if value < now - timezone.timedelta(seconds=30):
            raise serializers.ValidationError(
                "Scheduled time must be in the future or very recent (within 30 seconds)."
            )
        return value

    def validate_folder_path(self, value):
        """Validate local folder path."""
        from pathlib import Path
        import os

        # Convert to Path object
        path = Path(value)

        # Check if path exists
        if not path.exists():
            raise serializers.ValidationError(
                f"Folder path does not exist: {value}"
            )

        # Check if it's a directory
        if not path.is_dir():
            raise serializers.ValidationError(
                f"Path must be a directory, not a file: {value}"
            )

        # Check read permissions
        if not os.access(path, os.R_OK):
            raise serializers.ValidationError(
                f"Folder is not readable (permission denied): {value}"
            )

        # Return absolute path for consistency
        return str(path.absolute())
