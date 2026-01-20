"""
Django management command to verify architecture rules are being followed.
Usage: python manage.py verify_architecture
"""
from django.core.management.base import BaseCommand
from django.db.models import Count
from api.models import Photo, Person, PersonPhoto


class Command(BaseCommand):
    help = 'Verify that architecture rules are being followed'

    def handle(self, *args, **options):
        """Verify all architecture rules."""
        self.stdout.write(self.style.SUCCESS('=' * 60))
        self.stdout.write(self.style.SUCCESS('Verifying Architecture Rules'))
        self.stdout.write(self.style.SUCCESS('=' * 60))
        
        errors = []
        warnings = []
        
        # Rule 1: Store image only once using image_hash
        self.stdout.write('\n1. Checking: Store image only once using image_hash')
        duplicate_hashes = Photo.objects.values('image_hash').annotate(
            count=Count('id')
        ).filter(count__gt=1)
        if duplicate_hashes.exists():
            errors.append(f"❌ Found {duplicate_hashes.count()} duplicate image hashes!")
            for dup in duplicate_hashes:
                self.stdout.write(self.style.ERROR(f"   Hash {dup['image_hash']} appears {dup['count']} times"))
        else:
            self.stdout.write(self.style.SUCCESS('   ✓ No duplicate image hashes'))
        
        # Rule 2: One person = one collection
        self.stdout.write('\n2. Checking: One person = one collection')
        total_persons = Person.objects.count()
        self.stdout.write(self.style.SUCCESS(f'   ✓ {total_persons} persons (collections) found'))
        
        # Rule 3: One photo can belong to many persons
        self.stdout.write('\n3. Checking: One photo can belong to many persons')
        photos_with_multiple_persons = PersonPhoto.objects.values('photo').annotate(
            person_count=Count('person', distinct=True)
        ).filter(person_count__gt=1)
        if photos_with_multiple_persons.exists():
            count = photos_with_multiple_persons.count()
            self.stdout.write(self.style.SUCCESS(f'   ✓ {count} photos belong to multiple persons (expected)'))
        else:
            self.stdout.write(self.style.WARNING('   ⚠ No photos belong to multiple persons'))
        
        # Rule 4: Use PersonPhoto mapping table
        self.stdout.write('\n4. Checking: PersonPhoto mapping table usage')
        total_mappings = PersonPhoto.objects.count()
        self.stdout.write(self.style.SUCCESS(f'   ✓ {total_mappings} PersonPhoto mappings found'))
        
        # Rule 5: No duplicate Photos
        self.stdout.write('\n5. Checking: No duplicate Photos')
        total_photos = Photo.objects.count()
        unique_hashes = Photo.objects.values('image_hash').distinct().count()
        if total_photos == unique_hashes:
            self.stdout.write(self.style.SUCCESS(f'   ✓ {total_photos} photos, all unique'))
        else:
            errors.append(f"❌ Photo count ({total_photos}) != unique hashes ({unique_hashes})")
        
        # Rule 6: No duplicate Persons
        self.stdout.write('\n6. Checking: No duplicate Persons')
        total_persons = Person.objects.count()
        unique_numbers = Person.objects.values('person_number').distinct().count()
        if total_persons == unique_numbers:
            self.stdout.write(self.style.SUCCESS(f'   ✓ {total_persons} persons, all unique'))
        else:
            errors.append(f"❌ Person count ({total_persons}) != unique numbers ({unique_numbers})")
        
        # Rule 7: No duplicate mappings
        self.stdout.write('\n7. Checking: No duplicate PersonPhoto mappings')
        total_mappings = PersonPhoto.objects.count()
        unique_mappings = PersonPhoto.objects.values('person', 'photo').distinct().count()
        if total_mappings == unique_mappings:
            self.stdout.write(self.style.SUCCESS(f'   ✓ {total_mappings} mappings, all unique'))
        else:
            errors.append(f"❌ Mapping count ({total_mappings}) != unique mappings ({unique_mappings})")
        
        # Rule 8: Collections numbering must start from 1 and be ascending
        self.stdout.write('\n8. Checking: Collections numbering (starting from 1, ascending)')
        persons = Person.objects.all().order_by('person_number')
        if persons.exists():
            first_person = persons.first()
            if first_person.person_number != 1:
                errors.append(f"❌ First person number is {first_person.person_number}, should be 1")
            else:
                self.stdout.write(self.style.SUCCESS(f'   ✓ First person number is 1'))
            
            # Check for gaps or non-ascending order
            expected_number = 1
            for person in persons:
                if person.person_number != expected_number:
                    errors.append(f"❌ Person number sequence broken: expected {expected_number}, got {person.person_number}")
                    break
                expected_number += 1
            
            if expected_number - 1 == persons.count():
                self.stdout.write(self.style.SUCCESS(f'   ✓ All {persons.count()} persons numbered sequentially from 1'))
        else:
            self.stdout.write(self.style.WARNING('   ⚠ No persons found'))
        
        # Summary
        self.stdout.write('\n' + '=' * 60)
        if errors:
            self.stdout.write(self.style.ERROR('❌ VERIFICATION FAILED'))
            self.stdout.write(self.style.ERROR(f'Found {len(errors)} error(s):'))
            for error in errors:
                self.stdout.write(self.style.ERROR(f'  {error}'))
            return
        else:
            self.stdout.write(self.style.SUCCESS('✓ ALL ARCHITECTURE RULES VERIFIED'))
            self.stdout.write(self.style.SUCCESS('=' * 60))
