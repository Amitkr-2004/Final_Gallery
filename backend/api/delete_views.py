"""
Delete endpoints for photos and collections.
"""
from django.db import transaction
from django.conf import settings
from rest_framework.decorators import api_view
from rest_framework.response import Response
from rest_framework import status
import os
from .models import Photo, Person, PersonPhoto
from .faiss_manager import get_faiss_manager


@api_view(['DELETE'])
def delete_photo(request, photo_id):
    """
    Delete a photo and remove it from all collections.
    
    Safety Rules:
    - Transactional: All operations succeed or fail together
    - Removes photo from all person collections
    - Deletes image file from storage
    - Handles empty collections based on configuration
    
    Args:
        photo_id: ID of the photo to delete
        
    Returns:
        Success message with details of what was deleted
    """
    try:
        with transaction.atomic():
            # Step 1: Get photo and verify it exists
            try:
                photo = Photo.objects.get(id=photo_id)
            except Photo.DoesNotExist:
                return Response(
                    {'error': 'Photo not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            # Step 2: Get all persons linked to this photo
            person_photos = PersonPhoto.objects.filter(photo=photo).select_related('person')
            linked_persons = [pp.person for pp in person_photos]
            
            # Step 3: Remove all PersonPhoto relationships (cascade will handle this, but explicit for clarity)
            person_photos.delete()
            
            # Step 4: Delete image file from storage
            image_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)
            if os.path.exists(image_path):
                try:
                    os.remove(image_path)
                except OSError as e:
                    # Log error but don't fail transaction if file already deleted
                    print(f"Warning: Could not delete file {image_path}: {e}")
            
            # Step 5: Delete photo record from database
            photo_id_deleted = photo.id
            photo.delete()
            
            # Step 6: Handle empty collections
            deleted_collections = []
            delete_empty = getattr(settings, 'DELETE_EMPTY_COLLECTIONS', 'delete').lower() == 'delete'
            
            for person in linked_persons:
                # Check if collection is now empty
                remaining_photos_count = PersonPhoto.objects.filter(person=person).count()
                
                if remaining_photos_count == 0 and delete_empty:
                    # Collection is empty and we should delete it
                    person_id_to_delete = person.id
                    person_number = person.person_number
                    
                    # Delete person/collection first
                    person.delete()
                    
                    # Remove from FAISS index (after person is deleted)
                    faiss_manager = get_faiss_manager()
                    faiss_manager.remove_embedding(person_id_to_delete)
                    
                    deleted_collections.append({
                        'person_id': person_id_to_delete,
                        'person_number': person_number
                    })
            
            return Response({
                'message': 'Photo deleted successfully',
                'photo_id': photo_id_deleted,
                'removed_from_collections': len(linked_persons),
                'empty_collections_deleted': len(deleted_collections),
                'deleted_collections': deleted_collections
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response(
            {'error': 'Failed to delete photo', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['DELETE'])
def delete_person(request, person_id):
    """
    Delete an entire person collection and all associated photos.
    
    When a collection is deleted:
    - All photos linked ONLY to this collection are deleted (from database and storage)
    - Photos shared with other collections remain (only the link is removed)
    - The person/collection record is deleted
    - FAISS index is updated
    
    Safety Rules:
    - Transactional: All operations succeed or fail together
    - Deletes photos only if they have no remaining links to other collections
    - Removes from FAISS index
    - Deletes image files from storage
    - Removes all relationships
    
    Args:
        person_id: ID of the person/collection to delete
        
    Returns:
        Success message with details of what was deleted
    """
    try:
        with transaction.atomic():
            # Step 1: Get person and verify it exists
            try:
                person = Person.objects.get(id=person_id)
            except Person.DoesNotExist:
                return Response(
                    {'error': 'Person/Collection not found'},
                    status=status.HTTP_404_NOT_FOUND
                )
            
            person_number = person.person_number
            
            # Step 2: Get all photos linked to this person BEFORE deleting relationships
            person_photos = PersonPhoto.objects.filter(person=person).select_related('photo')
            linked_photos = [pp.photo for pp in person_photos]
            
            # Step 3: Remove all PersonPhoto relationships for this person
            person_photos.delete()
            
            # Step 4: Delete each photo (only if not linked to other persons after removal)
            deleted_photos = []
            deleted_files = []
            
            # Create a set of unique photo IDs to avoid processing duplicates
            processed_photo_ids = set()
            
            for photo in linked_photos:
                # Skip if we've already processed this photo
                if photo.id in processed_photo_ids:
                    continue
                processed_photo_ids.add(photo.id)
                
                # Check if photo is linked to any other persons AFTER removing this person's links
                remaining_links = PersonPhoto.objects.filter(photo=photo).count()
                
                if remaining_links == 0:
                    # Photo is no longer linked to any person, delete it completely
                    # Delete image file first
                    image_path = os.path.join(settings.MEDIA_ROOT, photo.file_path)
                    if os.path.exists(image_path):
                        try:
                            os.remove(image_path)
                            deleted_files.append(photo.file_path)
                        except OSError as e:
                            print(f"Warning: Could not delete file {image_path}: {e}")
                    
                    # Delete photo record
                    deleted_photos.append({
                        'photo_id': photo.id,
                        'file_path': photo.file_path
                    })
                    photo.delete()
            
            # Step 5: Delete person/collection record first
            person.delete()
            
            # Step 6: Remove from FAISS index (after person is deleted)
            faiss_manager = get_faiss_manager()
            faiss_manager.remove_embedding(person_id)
            
            return Response({
                'message': 'Collection deleted successfully',
                'person_id': person_id,
                'person_number': person_number,
                'photos_deleted': len(deleted_photos),
                'files_deleted': len(deleted_files),
                'deleted_photos': deleted_photos
            }, status=status.HTTP_200_OK)
            
    except Exception as e:
        return Response(
            {'error': 'Failed to delete collection', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
