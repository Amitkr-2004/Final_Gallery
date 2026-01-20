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
    """
    id = models.AutoField(primary_key=True)
    file_path = models.CharField(max_length=500)
    image_hash = models.CharField(max_length=64, unique=True, db_index=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

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

    class Meta:
        unique_together = [['person', 'photo']]
        ordering = ['-created_at']
        verbose_name = 'Person Photo'
        verbose_name_plural = 'Person Photos'
        # Ensure no duplicate mappings at database level
        constraints = [
            models.UniqueConstraint(fields=['person', 'photo'], name='unique_person_photo')
        ]

    def __str__(self):
        return f"Person {self.person.person_number} - Photo {self.photo.id}"
