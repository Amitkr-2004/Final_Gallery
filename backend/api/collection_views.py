"""
Collection views for "Your Collection" feature.
Allows students to scan/upload their face and find all their photos.
"""
import os
import logging
from django.conf import settings
from rest_framework.decorators import api_view, parser_classes
from rest_framework.response import Response
from rest_framework import status
from rest_framework.parsers import MultiPartParser, FormParser
from .models import Person, PersonPhoto, Photo
from .serializers import PhotoSerializer
from .utils import detect_faces_from_file
from .faiss_manager import get_faiss_manager

# Configure logger
logger = logging.getLogger(__name__)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def scan_face(request):
    """
    Scan/upload face image to find matching collection.

    Flow:
    1. Receive face image (camera scan or upload)
    2. Detect face using InsightFace
    3. Extract 512D embedding vector
    4. Search FAISS index for matching Person
    5. If match found → return person_id and metadata
    6. If no match → return matched: false

    Request:
        image: Image file (multipart/form-data)

    Response (Success - Match Found):
        {
            "success": true,
            "matched": true,
            "person": {
                "id": 42,
                "person_number": 42,
                "face_image_url": "/media/images/abc123.jpg",
                "total_photos": 156
            },
            "confidence": 0.85,
            "message": "Found your collection with 156 photos!"
        }

    Response (Success - No Match):
        {
            "success": true,
            "matched": false,
            "person": null,
            "confidence": 0.0,
            "message": "No collection found. Upload photos to events first."
        }

    Response (Error):
        {
            "success": false,
            "api": "/api/collection/scan-face/",
            "stage": "Face Detection",
            "message": "No face detected in the image",
            "error_code": "NO_FACE_DETECTED"
        }
    """
    api_endpoint = "/api/collection/scan-face/"

    # Validate request
    if 'image' not in request.FILES:
        error_msg = "No image file provided"
        logger.error(f"[API ERROR] {api_endpoint} | Stage: Request Validation | Error: {error_msg} | Code: MISSING_IMAGE")
        return Response({
            "success": False,
            "api": api_endpoint,
            "stage": "Request Validation",
            "message": error_msg,
            "error_code": "MISSING_IMAGE"
        }, status=status.HTTP_400_BAD_REQUEST)

    image_file = request.FILES['image']

    try:
        # STAGE 1: Face Detection
        logger.info(f"[{api_endpoint}] Stage: Face Detection | Starting face detection")

        face_confidence_threshold = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.3)
        detected_faces = detect_faces_from_file(image_file, min_confidence=face_confidence_threshold)

        # Check if any face detected
        if len(detected_faces) == 0:
            error_msg = "No face detected in the image. Please use a clear, front-facing photo."
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Face Detection | Error: {error_msg} | Code: NO_FACE_DETECTED")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Face Detection",
                "message": error_msg,
                "error_code": "NO_FACE_DETECTED"
            }, status=status.HTTP_400_BAD_REQUEST)

        # Check if multiple faces detected
        if len(detected_faces) > 1:
            error_msg = f"Multiple faces detected ({len(detected_faces)} faces). Please upload a photo with only your face."
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Face Detection | Error: {error_msg} | Code: MULTIPLE_FACES")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Face Detection",
                "message": error_msg,
                "error_code": "MULTIPLE_FACES",
                "faces_detected": len(detected_faces)
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract single face embedding
        embedding, detection_confidence = detected_faces[0]
        logger.info(f"[{api_endpoint}] Stage: Face Detection | Success | Confidence: {detection_confidence:.2f}")

        # STAGE 2: Face Matching (FAISS Similarity Search)
        logger.info(f"[{api_endpoint}] Stage: Face Matching | Searching FAISS index")

        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.6)
        faiss_manager = get_faiss_manager(similarity_threshold=similarity_threshold)

        # Search for similar embeddings
        search_results = faiss_manager.search_similar(embedding, k=1)

        if not search_results:
            # No persons in database yet
            logger.info(f"[{api_endpoint}] Stage: Face Matching | No match found | FAISS index empty")
            return Response({
                "success": True,
                "matched": False,
                "person": None,
                "confidence": 0.0,
                "message": "No collection found. Upload photos to events first."
            }, status=status.HTTP_200_OK)

        person_id, similarity_score = search_results[0]

        # Check if similarity meets threshold
        if similarity_score < similarity_threshold:
            logger.info(f"[{api_endpoint}] Stage: Face Matching | No match found | Best similarity: {similarity_score:.2f} < threshold: {similarity_threshold}")
            return Response({
                "success": True,
                "matched": False,
                "person": None,
                "confidence": float(similarity_score),
                "message": "No collection found. Upload photos to events first."
            }, status=status.HTTP_200_OK)

        # STAGE 3: Fetch Collection Metadata
        logger.info(f"[{api_endpoint}] Stage: Data Retrieval | Match found | Person ID: {person_id} | Similarity: {similarity_score:.2f}")

        try:
            person = Person.objects.get(id=person_id)
        except Person.DoesNotExist:
            error_msg = f"Person with ID {person_id} not found in database"
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Data Retrieval | Error: {error_msg} | Code: PERSON_NOT_FOUND")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Data Retrieval",
                "message": error_msg,
                "error_code": "PERSON_NOT_FOUND"
            }, status=status.HTTP_404_NOT_FOUND)

        # Count total photos for this person
        total_photos = PersonPhoto.objects.filter(person=person).count()

        # Get first photo for face preview
        first_person_photo = PersonPhoto.objects.filter(person=person).select_related('photo').first()
        face_image_url = None
        if first_person_photo and first_person_photo.photo:
            face_image_url = f"{settings.MEDIA_URL}{first_person_photo.photo.file_path}"

        logger.info(f"[{api_endpoint}] Stage: Success | Person #{person.person_number} | Total Photos: {total_photos}")

        return Response({
            "success": True,
            "matched": True,
            "person": {
                "id": person.id,
                "person_number": person.person_number,
                "face_image_url": face_image_url,
                "total_photos": total_photos
            },
            "confidence": float(similarity_score),
            "message": f"Found your collection with {total_photos} photos!"
        }, status=status.HTTP_200_OK)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[API ERROR] {api_endpoint} | Stage: Internal Error | Error: {error_msg} | Code: INTERNAL_ERROR")
        return Response({
            "success": False,
            "api": api_endpoint,
            "stage": "Internal Error",
            "message": f"An unexpected error occurred: {error_msg}",
            "error_code": "INTERNAL_ERROR"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)


@api_view(['GET'])
def get_collection_photos(request, person_id):
    """
    Get all photos for a specific person/collection.

    Query Parameters:
        page (int): Page number (default: 1)
        limit (int): Photos per page (default: 50, max: 200)
        event_id (str): Filter by event (optional)

    Response (Success):
        {
            "success": true,
            "person": {
                "id": 42,
                "person_number": 42,
                "total_photos": 156
            },
            "photos": [...],
            "pagination": {
                "total": 156,
                "page": 1,
                "limit": 50,
                "pages": 4,
                "has_next": true,
                "has_prev": false
            }
        }

    Response (Error):
        {
            "success": false,
            "api": "/api/collection/{person_id}/photos/",
            "stage": "Data Retrieval",
            "message": "Collection not found",
            "error_code": "PERSON_NOT_FOUND"
        }
    """
    api_endpoint = f"/api/collection/{person_id}/photos/"

    try:
        # STAGE 1: Validate Person
        logger.info(f"[{api_endpoint}] Stage: Data Retrieval | Fetching person {person_id}")

        try:
            person = Person.objects.get(id=person_id)
        except Person.DoesNotExist:
            error_msg = f"Collection not found with ID {person_id}"
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Data Retrieval | Error: {error_msg} | Code: PERSON_NOT_FOUND")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Data Retrieval",
                "message": error_msg,
                "error_code": "PERSON_NOT_FOUND"
            }, status=status.HTTP_404_NOT_FOUND)

        # STAGE 2: Get Query Parameters
        page = int(request.GET.get('page', 1))
        limit = int(request.GET.get('limit', 50))
        event_id = request.GET.get('event_id', None)

        # Validate pagination parameters
        page = max(1, page)  # Minimum page 1
        limit = max(1, min(limit, 200))  # Between 1 and 200

        # STAGE 3: Fetch Photos
        person_photos_query = PersonPhoto.objects.filter(person=person).select_related('photo').order_by('-confidence', '-created_at')

        # Filter by event if specified
        if event_id:
            person_photos_query = person_photos_query.filter(photo__event_id=event_id)
            logger.info(f"[{api_endpoint}] Stage: Data Retrieval | Filtering by event_id: {event_id}")

        # Count total
        total_photos = person_photos_query.count()

        # Pagination
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        person_photos = person_photos_query[start_idx:end_idx]

        # Extract photos
        photos = [pp.photo for pp in person_photos]

        # Serialize
        photo_serializer = PhotoSerializer(photos, many=True)

        # Calculate pagination metadata
        total_pages = (total_photos + limit - 1) // limit  # Ceiling division
        has_next = page < total_pages
        has_prev = page > 1

        logger.info(f"[{api_endpoint}] Stage: Success | Person #{person.person_number} | Photos: {len(photos)}/{total_photos} | Page: {page}/{total_pages}")

        return Response({
            "success": True,
            "person": {
                "id": person.id,
                "person_number": person.person_number,
                "total_photos": total_photos
            },
            "photos": photo_serializer.data,
            "pagination": {
                "total": total_photos,
                "page": page,
                "limit": limit,
                "pages": total_pages,
                "has_next": has_next,
                "has_prev": has_prev
            }
        }, status=status.HTTP_200_OK)

    except ValueError as e:
        error_msg = "Invalid pagination parameters"
        logger.error(f"[API ERROR] {api_endpoint} | Stage: Request Validation | Error: {error_msg} | Code: INVALID_PARAMETERS")
        return Response({
            "success": False,
            "api": api_endpoint,
            "stage": "Request Validation",
            "message": error_msg,
            "error_code": "INVALID_PARAMETERS"
        }, status=status.HTTP_400_BAD_REQUEST)

    except Exception as e:
        error_msg = str(e)
        logger.error(f"[API ERROR] {api_endpoint} | Stage: Internal Error | Error: {error_msg} | Code: INTERNAL_ERROR")
        return Response({
            "success": False,
            "api": api_endpoint,
            "stage": "Internal Error",
            "message": f"An unexpected error occurred: {error_msg}",
            "error_code": "INTERNAL_ERROR"
        }, status=status.HTTP_500_INTERNAL_SERVER_ERROR)
