from rest_framework import serializers
from .models import Photo, Person
from django.conf import settings


class ImageUploadSerializer(serializers.Serializer):
    """Serializer for image upload."""
    image = serializers.ImageField(required=True)


class PhotoSerializer(serializers.ModelSerializer):
    """Serializer for Photo model."""
    image_url = serializers.SerializerMethodField()
    
    class Meta:
        model = Photo
        fields = ['id', 'file_path', 'image_hash', 'uploaded_at', 'image_url']
        read_only_fields = ['id', 'image_hash', 'uploaded_at']
    
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
