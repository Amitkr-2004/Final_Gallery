"""Test script to verify PersonSerializer cover selection logic."""
import os
import django

os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from api.models import Person
from api.serializers import PersonSerializer

print("Testing PersonSerializer cover image selection...")
print("=" * 60)

persons = Person.objects.all()[:5]

if not persons:
    print("No persons found in database")
else:
    for person in persons:
        print(f"\nPerson {person.person_number}:")

        # Get photo count
        photo_count = person.person_photos.count()
        print(f"  Total photos: {photo_count}")

        # Serialize
        serializer = PersonSerializer(person)
        data = serializer.data

        print(f"  cover_face_image_url: {data.get('cover_face_image_url')}")
        print(f"  cover_image_url: {data.get('cover_image_url')}")

        # Show PersonPhoto links with confidence
        person_photos = person.person_photos.all().order_by('-confidence', '-created_at')[:3]
        if person_photos:
            print(f"  PersonPhoto links (top 3 by confidence):")
            for pp in person_photos:
                print(f"    Photo {pp.photo_id}: confidence={pp.confidence:.3f}, "
                      f"created={pp.created_at.strftime('%Y-%m-%d %H:%M:%S')}")

print("\n" + "=" * 60)
print("Test complete. Check Django logs for [COVER] messages.")
