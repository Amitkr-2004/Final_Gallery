import hashlib
import os
import logging
from django.conf import settings
from django.db import IntegrityError
from rest_framework import viewsets, status
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Photo, Person, PersonPhoto, DailyStatistics
from .serializers import ImageUploadSerializer, PhotoSerializer, PersonSerializer, DailyStatisticsSerializer
from .utils import get_image_upload_path, detect_faces_from_file, detect_faces_and_extract_embeddings, update_daily_statistics
from .faiss_manager import get_faiss_manager
from .face_faiss_manager import get_face_faiss_manager
from .gcs_service import sync_photo_to_gcs, is_gcs_configured
import numpy as np

# Configure logger for this module
logger = logging.getLogger(__name__)


@api_view(['GET'])
def health_check(request):
    """Health check endpoint to verify API is running."""
    return Response({'status': 'ok', 'message': 'API is running'})


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def upload_image(request):
    """
    Upload an image endpoint.
    
    Logic:
    1. Receive image
    2. Compute image hash
    3. If hash exists in Photo table: use existing photo_id
    4. Else: save image and create Photo record
    5. Do NOT duplicate image
    6. Detect all faces in the image
    7. Extract embedding vector for each detected face
    8. For each embedding:
       - Compare with existing Person embeddings using FAISS
       - If similarity > threshold → match existing person
       - Else → create new Person with next person_number
    9. Insert into PersonPhoto table: (person_id, photo_id)
       - Ensure UNIQUE(person, photo) constraint
       - Do not insert duplicates
    10. Return photo_id, embeddings, and matched persons
    """
    serializer = ImageUploadSerializer(data=request.data)

    if not serializer.is_valid():
        return Response(
            {'error': 'Invalid request', 'details': serializer.errors},
            status=status.HTTP_400_BAD_REQUEST
        )

    image_file = serializer.validated_data['image']
    event_id = request.data.get('event_id', None)  # Extract event_id from request

    try:
        # Compute image hash (SHA256)
        image_file.seek(0)  # Reset file pointer to beginning
        hash_sha256 = hashlib.sha256()
        for chunk in image_file.chunks():
            hash_sha256.update(chunk)
        image_hash = hash_sha256.hexdigest()
        
        # Check if photo with this hash already exists
        existing_photo = Photo.objects.filter(image_hash=image_hash).first()
        
        if existing_photo:
            # Photo already exists, detect faces from existing image
            # NOTE: Do NOT update statistics for duplicate photos
            # They were already counted when first uploaded

            # Get full path to existing image
            existing_image_path = os.path.join(settings.MEDIA_ROOT, existing_photo.file_path)

            # Detect faces and extract embeddings from existing image (only clear faces)
            # Filter by detection confidence to avoid processing unclear/blurry faces
            face_confidence_threshold = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.5)
            quality_faces = detect_faces_and_extract_embeddings(existing_image_path, min_confidence=face_confidence_threshold)

            # Process each clearly detected face embedding with FAISS similarity matching
            # Logic: Upload Image → Detect Face(s) clearly → Compare with existing persons →
            #        • Match found → Append image to matched person's collection
            #        • No match found → Create new person + new collection → Store image
            # Only faces with sufficient confidence are processed (avoids duplicates from unclear faces)
            similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.7)
            faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)
            face_faiss_manager = get_face_faiss_manager(similarity_threshold=similarity_threshold)
            matched_persons = []

            for face_data in quality_faces:
                # Extract face data (new dict format)
                embedding = face_data['embedding']
                confidence = face_data['confidence']
                bbox = face_data.get('bbox')

                # Step 1: Compare with existing persons using FAISS
                # find_or_create_person() checks if person already exists:
                #   - If similarity >= threshold → returns existing person (is_new=False)
                #   - If no match found → creates new person (is_new=True)
                person, is_new = faiss_manager.find_or_create_person(embedding)

                # Step 2: Add image to person's collection (create PersonPhoto mapping)
                # Whether person is existing or new, append this image to their collection
                # get_or_create ensures UNIQUE(person, photo) - no duplicate mappings
                # NOW ALSO stores face_embedding and face_bbox for face-level matching
                try:
                    person_photo, created = PersonPhoto.objects.get_or_create(
                        person=person,
                        photo=existing_photo,
                        defaults={
                            'confidence': confidence,
                            'face_embedding': embedding,  # Store face embedding for face-level matching
                            'face_bbox': bbox  # Store bounding box
                        }
                    )
                    # If record already existed but doesn't have embedding, update it
                    if not created and person_photo.face_embedding is None:
                        person_photo.face_embedding = embedding
                        person_photo.face_bbox = bbox
                        person_photo.save(update_fields=['face_embedding', 'face_bbox'])
                except IntegrityError:
                    # Handle race condition: if duplicate detected at DB level, get existing record
                    person_photo = PersonPhoto.objects.get(
                        person=person,
                        photo=existing_photo
                    )

                # Step 3: Add to face-level FAISS index for face-level matching
                if created and embedding:
                    face_faiss_manager.add_face_embedding(person_photo.id, embedding)
                    logger.debug(f"[FACE_INDEX] Added PersonPhoto {person_photo.id} to face FAISS index")

                matched_persons.append({
                    'person_id': person.id,
                    'person_number': person.person_number,
                    'person_photo_id': person_photo.id,  # Include PersonPhoto ID for face-level tracking
                    'is_new': is_new,  # True if new person/collection created, False if existing
                    'detection_confidence': confidence  # Quality score of face detection
                })

            return Response({
                'photo_id': existing_photo.id,
                'message': 'Photo already exists (duplicate not counted in statistics)',
                'file_path': existing_photo.file_path,
                'faces_detected': len(quality_faces),
                'faces_processed': len(matched_persons),
                'matched_persons': matched_persons,
                'confidence_threshold': face_confidence_threshold
            }, status=status.HTTP_200_OK)
        
        # Photo doesn't exist, save the image and create Photo record
        # Generate filename using hash to ensure uniqueness
        file_extension = os.path.splitext(image_file.name)[1] or '.jpg'
        filename = f"{image_hash}{file_extension}"
        
        # Get the full path where image should be saved
        image_path = get_image_upload_path(filename)
        
        # Ensure the directory exists
        os.makedirs(os.path.dirname(image_path), exist_ok=True)
        
        # Save the image file
        image_file.seek(0)  # Reset file pointer again
        with open(image_path, 'wb+') as destination:
            for chunk in image_file.chunks():
                destination.write(chunk)
        
        # Create Photo record
        # Store relative path from MEDIA_ROOT
        relative_path = os.path.join('images', filename).replace('\\', '/')

        # Log before creating Photo record
        logger.info(f"[PHOTO_CREATE] Creating Photo record: file_path={relative_path}, image_hash={image_hash}, event_id={event_id}, status=completed")

        photo = Photo.objects.create(
            file_path=relative_path,
            image_hash=image_hash,
            event_id=event_id,  # Save event_id (was extracted but not saved before)
            status='completed'  # Set status explicitly (synchronous processing)
        )

        # Log after successful creation
        logger.info(f"[PHOTO_CREATE] Photo record created successfully: photo_id={photo.id}, file_path={photo.file_path}, event_id={photo.event_id}, status={photo.status}")
        
        # Detect faces and extract embeddings (only clear, well-detected faces)
        # Filter by detection confidence to avoid creating collections for unclear/blurry faces
        image_file.seek(0)  # Reset file pointer for face detection
        face_confidence_threshold = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.5)
        quality_faces = detect_faces_from_file(image_file, min_confidence=face_confidence_threshold)

        # Process each clearly detected face embedding with FAISS similarity matching
        # Logic: Upload Image → Detect Face(s) clearly → Compare with existing persons →
        #        • Match found → Append image to matched person's collection
        #        • No match found → Create new person + new collection → Store image
        # Only faces with sufficient confidence are processed (avoids duplicates from unclear faces)
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.7)
        faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)
        face_faiss_manager = get_face_faiss_manager(similarity_threshold=similarity_threshold)
        matched_persons = []
        skipped_faces = 0

        for face_data in quality_faces:
            # Extract face data (new dict format)
            embedding = face_data['embedding']
            confidence = face_data['confidence']
            bbox = face_data.get('bbox')

            # Step 1: Compare with existing persons using FAISS
            # find_or_create_person() checks if person already exists:
            #   - If similarity >= threshold → returns existing person (is_new=False)
            #   - If no match found → creates new person (is_new=True)
            person, is_new = faiss_manager.find_or_create_person(embedding)

            # Step 2: Add image to person's collection (create PersonPhoto mapping)
            # Whether person is existing or new, append this image to their collection
            # get_or_create ensures UNIQUE(person, photo) - no duplicate mappings
            # NOW ALSO stores face_embedding and face_bbox for face-level matching
            try:
                person_photo, created = PersonPhoto.objects.get_or_create(
                    person=person,
                    photo=photo,
                    defaults={
                        'confidence': confidence,
                        'face_embedding': embedding,  # Store face embedding for face-level matching
                        'face_bbox': bbox  # Store bounding box
                    }
                )
            except IntegrityError:
                # Handle race condition: if duplicate detected at DB level, get existing record
                person_photo = PersonPhoto.objects.get(
                    person=person,
                    photo=photo
                )

            # Step 3: Add to face-level FAISS index for face-level matching
            if created and embedding:
                face_faiss_manager.add_face_embedding(person_photo.id, embedding)
                logger.debug(f"[FACE_INDEX] Added PersonPhoto {person_photo.id} to face FAISS index")

            matched_persons.append({
                'person_id': person.id,
                'person_number': person.person_number,
                'person_photo_id': person_photo.id,  # Include PersonPhoto ID for face-level tracking
                'is_new': is_new,  # True if new person/collection created, False if existing
                'detection_confidence': confidence  # Quality score of face detection
            })

        # UPDATE STATISTICS: New photo successfully uploaded
        # This is called ONLY for new photos (not duplicates)
        # Increments daily counter by 1 photo and N faces
        try:
            update_daily_statistics(
                photos_count=1,
                faces_count=len(matched_persons)  # Use matched_persons count (processed faces)
            )
        except Exception as stats_error:
            # Log error but don't fail the upload
            logger.error(f"[STATISTICS] Failed to update statistics: {str(stats_error)}")

        # SYNC TO GOOGLE CLOUD STORAGE
        # Upload image and collection metadata to GCS (if configured)
        gcs_sync_result = None
        if is_gcs_configured():
            try:
                # Get list of Person objects that were matched
                matched_person_objects = []
                for mp in matched_persons:
                    try:
                        person = Person.objects.get(id=mp['person_id'])
                        matched_person_objects.append(person)
                    except Person.DoesNotExist:
                        pass

                # Sync to GCS
                gcs_sync_result = sync_photo_to_gcs(
                    photo=photo,
                    local_image_path=image_path,
                    matched_persons=matched_person_objects
                )
                logger.info(f"[GCS_SYNC] Photo {photo.id} synced to GCS: {gcs_sync_result}")
            except Exception as gcs_error:
                logger.error(f"[GCS_SYNC] Failed to sync photo {photo.id} to GCS: {str(gcs_error)}")
                gcs_sync_result = {'success': False, 'error': str(gcs_error)}

        return Response({
            'photo_id': photo.id,
            'message': 'Photo uploaded successfully',
            'file_path': photo.file_path,
            'faces_detected': len(quality_faces),
            'faces_processed': len(matched_persons),
            'matched_persons': matched_persons,
            'confidence_threshold': face_confidence_threshold,
            'gcs_sync': gcs_sync_result
        }, status=status.HTTP_201_CREATED)
        
    except Exception as e:
        return Response(
            {'error': 'Failed to process image', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )


@api_view(['GET'])
def list_photos(request):
    """
    Get all unique photos.
    
    Returns:
        List of all photos in the database
    """
    photos = Photo.objects.all().distinct()
    serializer = PhotoSerializer(photos, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
def list_persons(request):
    """
    Get all persons sorted by person_number ASC.
    
    Returns:
        List of all persons sorted by person_number in ascending order
    """
    persons = Person.objects.all().order_by('person_number')
    serializer = PersonSerializer(persons, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_person_photos(request, person_id):
    """
    Get all photos linked to a specific person.

    Args:
        person_id: ID of the person

    Returns:
        List of photos linked to the person
    """
    try:
        person = Person.objects.get(id=person_id)
    except Person.DoesNotExist:
        return Response(
            {'error': 'Person not found'},
            status=status.HTTP_404_NOT_FOUND
        )

    # Get photos through PersonPhoto relationship
    person_photos = PersonPhoto.objects.filter(person=person).select_related('photo')
    photos = [pp.photo for pp in person_photos]

    serializer = PhotoSerializer(photos, many=True)
    return Response(serializer.data, status=status.HTTP_200_OK)


@api_view(['GET'])
def get_statistics(request):
    """
    Get daily statistics for photo uploads.

    Query Parameters:
        days (optional): Number of recent days to fetch (default: 30, max: 365)

    Returns:
        List of daily statistics ordered by date (most recent first)
    """
    try:
        # Get number of days from query params (default: 30, max: 365)
        days = int(request.GET.get('days', 30))
        days = min(max(days, 1), 365)  # Clamp between 1 and 365

        # Fetch statistics for last N days
        statistics = DailyStatistics.objects.all().order_by('-date')[:days]

        serializer = DailyStatisticsSerializer(statistics, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    except Exception as e:
        return Response(
            {'error': 'Failed to fetch statistics', 'details': str(e)},
            status=status.HTTP_500_INTERNAL_SERVER_ERROR
        )
