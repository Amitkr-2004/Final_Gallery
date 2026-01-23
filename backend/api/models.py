from django.db import models
from django.core.validators import MinValueValidator
from django.utils import timezone


class Photo(models.Model):
    """
    Model to store photo information.

    Architecture Rules:
    - Each image is stored only ONCE using image_hash (unique constraint)
    - No duplicate photos allowed (enforced by image_hash uniqueness)
    - One photo can belong to many persons (via PersonPhoto mapping)
    - Photos are associated with events via event_id (event-specific galleries)
    """
    id = models.AutoField(primary_key=True)
    file_path = models.CharField(max_length=500)
    image_hash = models.CharField(max_length=64, unique=True, db_index=True)
    event_id = models.CharField(max_length=100, null=True, blank=True, db_index=True,
                                help_text="Event ID from frontend (e.g., 'evt_1234567890')")
    uploaded_at = models.DateTimeField(auto_now_add=True)

    # Processing status and thumbnails (added to match database schema from migration 0005)
    status = models.CharField(
        max_length=20,
        choices=[
            ('pending', 'Pending'),
            ('processing', 'Processing'),
            ('completed', 'Completed'),
            ('failed', 'Failed'),
        ],
        default='completed',
        db_index=True,
        help_text="Processing status: pending, processing, completed, failed"
    )
    processed_at = models.DateTimeField(
        null=True,
        blank=True,
        help_text="When background processing completed"
    )
    thumbnail_small = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="200x200 thumbnail for collections page"
    )
    thumbnail_medium = models.CharField(
        max_length=500,
        null=True,
        blank=True,
        help_text="800x800 thumbnail for detail page"
    )

    class Meta:
        ordering = ['-uploaded_at']
        verbose_name = 'Photo'
        verbose_name_plural = 'Photos'
        # Ensure no duplicate photos at database level
        constraints = [
            models.UniqueConstraint(fields=['image_hash'], name='unique_image_hash')
        ]

    def __str__(self):
        return f"Photo {self.id} - {self.file_path}"


class Person(models.Model):
    """
    Model to store person information with embedding vectors.

    Architecture Rules:
    - One person = one collection (1:1 relationship)
    - Collections numbering starts from 1 and is strictly ascending
    - No duplicate persons allowed (enforced by person_number uniqueness)
    - person_number is auto-generated and cannot be manually set to break sequence
    """
    id = models.AutoField(primary_key=True)
    person_number = models.IntegerField(unique=True, validators=[MinValueValidator(1)])
    embedding_vector = models.JSONField(help_text="Face embedding vector as JSON array")
    created_at = models.DateTimeField(auto_now_add=True)
    face_image = models.CharField(max_length=500, null=True, blank=True)
    cover_face_image = models.CharField(max_length=500, null=True, blank=True)
    cover_image = models.CharField(max_length=500, null=True, blank=True)
    cover_image_quality_score = models.FloatField(default=0.0)

    class Meta:
        ordering = ['person_number']
        verbose_name = 'Person'
        verbose_name_plural = 'Persons'
        # Ensure no duplicate persons at database level
        constraints = [
            models.UniqueConstraint(fields=['person_number'], name='unique_person_number')
        ]

    def __str__(self):
        return f"Person {self.person_number}"

    def save(self, *args, **kwargs):
        """
        Auto-increment person_number starting from 1 if not set.
        Ensures collections numbering is strictly ascending starting from 1.
        Uses select_for_update to prevent race conditions in concurrent scenarios.
        """
        if not self.person_number:
            # Use select_for_update to prevent race conditions
            # Get the maximum person_number and add 1, or start from 1
            from django.db import transaction
            with transaction.atomic():
                # Lock rows to prevent concurrent person_number assignment
                max_person = Person.objects.select_for_update().aggregate(
                    models.Max('person_number')
                )
                max_number = max_person.get('person_number__max') or 0
                self.person_number = max_number + 1
        elif self.person_number < 1:
            raise ValueError("person_number must be >= 1. Collections numbering starts from 1.")
        super().save(*args, **kwargs)


class PersonPhoto(models.Model):
    """
    Model to link persons with photos (many-to-many relationship).

    Architecture Rules:
    - One photo can belong to many persons (many-to-many via this mapping table)
    - One person can have many photos (many-to-many via this mapping table)
    - No duplicate mappings allowed (enforced by unique_together constraint)
    - This is the ONLY way to associate photos with persons
    """
    id = models.AutoField(primary_key=True)
    person = models.ForeignKey(Person, on_delete=models.CASCADE, related_name='person_photos')
    photo = models.ForeignKey(Photo, on_delete=models.CASCADE, related_name='person_photos')
    created_at = models.DateTimeField(auto_now_add=True)

    # Face detection confidence (added to match database schema from migration 0006)
    confidence = models.FloatField(
        default=0.0,
        db_index=True,
        validators=[MinValueValidator(0.0)],
        help_text="Face detection confidence score (0.0-1.0). Higher = better quality."
    )

    class Meta:
        unique_together = [['person', 'photo']]
        ordering = ['-confidence', '-created_at']  # Order by confidence first, then by date
        verbose_name = 'Person Photo'
        verbose_name_plural = 'Person Photos'
        # Ensure no duplicate mappings at database level
        constraints = [
            models.UniqueConstraint(fields=['person', 'photo'], name='unique_person_photo')
        ]

    def __str__(self):
        return f"Person {self.person.person_number} - Photo {self.photo.id}"


class DailyStatistics(models.Model):
    """
    Model to track daily upload statistics.

    Stores aggregated statistics per day for:
    - Total photos uploaded
    - Total faces detected

    One record per day (unique date constraint).
    """
    id = models.AutoField(primary_key=True)
    date = models.DateField(unique=True, db_index=True, help_text="Date in YYYY-MM-DD format")
    photos_uploaded = models.IntegerField(default=0, help_text="Total photos uploaded on this date")
    faces_detected = models.IntegerField(default=0, help_text="Total faces detected on this date")
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-date']
        verbose_name = 'Daily Statistics'
        verbose_name_plural = 'Daily Statistics'
        constraints = [
            models.UniqueConstraint(fields=['date'], name='unique_date')
        ]

    def __str__(self):
        return f"Stats for {self.date}: {self.photos_uploaded} photos, {self.faces_detected} faces"
