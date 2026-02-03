"""
Collection views for "Your Collection" feature.
Allows students to scan/upload their face and find all their photos.

Face-Level Matching:
- Matches are done at the PersonPhoto level (individual face detections)
- Each PersonPhoto has its own face_embedding
- Returns only images where the matched face was actually detected
- Provides face_id tracking for precise matching
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
from .face_faiss_manager import get_face_faiss_manager

# Configure logger
logger = logging.getLogger(__name__)


@api_view(['POST'])
@parser_classes([MultiPartParser, FormParser])
def scan_face(request):
    """
    Scan/upload face image to find matching collection.

    Flow:
    1. Receive face image (camera scan or upload)
    2. Detect face using InsightFace (buffalo_l model)
    3. Extract 512D ArcFace embedding vector
    4. Search FAISS index for matching Person (cosine similarity)
    5. If match found with high confidence → return person_id and metadata
    6. If no match → return matched: false with appropriate message

    Thresholds (configurable in .env):
    - FACE_DETECTION_CONFIDENCE_THRESHOLD: Minimum face detection confidence (0.6)
    - FAISS_SIMILARITY_THRESHOLD: Minimum cosine similarity for match (0.85)

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
            "confidence": 0.92,
            "message": "Found your collection with 156 photos!"
        }

    Response (Success - No Match):
        {
            "success": true,
            "matched": false,
            "person": null,
            "confidence": 0.0,
            "message": "Your face is not in our database. Please upload your photos first.",
            "database_status": {"total_persons": 0}
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
        # STAGE 1: Face Detection with InsightFace
        logger.info(f"[{api_endpoint}] Stage: Face Detection | Starting InsightFace detection")

        # Use stricter detection threshold
        face_confidence_threshold = getattr(settings, 'FACE_DETECTION_CONFIDENCE_THRESHOLD', 0.6)
        detected_faces = detect_faces_from_file(image_file, min_confidence=face_confidence_threshold)

        # Check if any face detected
        if len(detected_faces) == 0:
            error_msg = "No face detected. Please ensure your face is clearly visible, well-lit, and facing the camera directly."
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
            error_msg = f"Multiple faces detected ({len(detected_faces)} faces). Please ensure only your face is in the frame."
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Face Detection | Error: {error_msg} | Code: MULTIPLE_FACES")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Face Detection",
                "message": error_msg,
                "error_code": "MULTIPLE_FACES",
                "faces_detected": len(detected_faces)
            }, status=status.HTTP_400_BAD_REQUEST)

        # Extract single face embedding (new dict format)
        face_data = detected_faces[0]
        embedding = face_data['embedding']
        detection_confidence = face_data['confidence']
        logger.info(f"[{api_endpoint}] Stage: Face Detection | Success | Detection confidence: {detection_confidence:.3f}")

        # Additional quality check - reject low confidence detections
        min_quality_threshold = 0.7  # Minimum quality for reliable matching
        if detection_confidence < min_quality_threshold:
            error_msg = f"Face detection quality too low ({detection_confidence:.0%}). Please use a clearer, well-lit photo."
            logger.warning(f"[{api_endpoint}] Stage: Face Detection | Low quality | Confidence: {detection_confidence:.3f}")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Face Quality",
                "message": error_msg,
                "error_code": "LOW_QUALITY_FACE",
                "detection_confidence": float(detection_confidence)
            }, status=status.HTTP_400_BAD_REQUEST)

        # STAGE 2: Face-Level Matching (FAISS Similarity Search at PersonPhoto level)
        # This searches individual face detections, not just person-level embeddings
        logger.info(f"[{api_endpoint}] Stage: Face Matching | Searching face-level FAISS index")

        # Use stricter similarity threshold (0.85 = 85% similarity required)
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.85)
        face_faiss_manager = get_face_faiss_manager(similarity_threshold=similarity_threshold)

        # Get database stats
        face_stats = face_faiss_manager.get_stats()
        total_face_embeddings = face_stats.get('total_face_embeddings', 0)

        # Check if database is empty
        if total_face_embeddings == 0:
            logger.info(f"[{api_endpoint}] Stage: Face Matching | Database empty | No face embeddings indexed")
            return Response({
                "success": True,
                "matched": False,
                "person": None,
                "matches": [],
                "confidence": 0.0,
                "message": "No photos in database yet. Please upload your event photos first to create your collection.",
                "database_status": {
                    "total_face_embeddings": 0,
                    "status": "empty"
                }
            }, status=status.HTTP_200_OK)

        # Search for similar face embeddings - get top 20 for comprehensive matching
        search_results = face_faiss_manager.search_similar_faces(embedding, k=20)

        # Log all search results for debugging
        logger.info(f"[{api_endpoint}] Stage: Face Matching | Found {len(search_results)} results:")
        for i, (person_photo_id, score) in enumerate(search_results[:5]):  # Log top 5
            try:
                pp = PersonPhoto.objects.select_related('person', 'photo').get(id=person_photo_id)
                logger.info(f"  #{i+1}: PersonPhoto {person_photo_id} (Person #{pp.person.person_number}, Photo {pp.photo.id}) -> similarity: {score:.4f}")
            except PersonPhoto.DoesNotExist:
                logger.info(f"  #{i+1}: Unknown PersonPhoto (ID: {person_photo_id}) -> similarity: {score:.4f}")

        if not search_results:
            # No match found in non-empty database
            logger.info(f"[{api_endpoint}] Stage: Face Matching | No match found | Database has {total_face_embeddings} face embeddings")
            return Response({
                "success": True,
                "matched": False,
                "person": None,
                "matches": [],
                "confidence": 0.0,
                "message": "Your face was not found in our database. Please upload your photos to events first.",
                "database_status": {
                    "total_face_embeddings": total_face_embeddings,
                    "status": "no_match"
                }
            }, status=status.HTTP_200_OK)

        # Filter results by similarity threshold and build detailed response
        matched_faces = []
        matched_person_ids = set()
        seen_photo_ids = set()  # Avoid duplicate photos in results

        for person_photo_id, similarity_score in search_results:
            # Skip if below threshold
            if similarity_score < similarity_threshold:
                continue

            try:
                pp = PersonPhoto.objects.select_related('person', 'photo').get(id=person_photo_id)

                # Skip duplicate photos (same photo might have multiple face detections)
                if pp.photo.id in seen_photo_ids:
                    continue
                seen_photo_ids.add(pp.photo.id)

                # Build image URL
                image_url = f"{settings.MEDIA_URL}{pp.photo.file_path}"

                matched_faces.append({
                    "face_id": pp.id,  # PersonPhoto ID for face-level tracking
                    "collection_id": pp.person.id,
                    "person_number": pp.person.person_number,
                    "image_id": pp.photo.id,
                    "image_url": image_url,
                    "similarity": float(similarity_score),
                    "face_bbox": pp.face_bbox,  # Bounding box where face was detected
                    "detection_confidence": pp.confidence
                })

                matched_person_ids.add(pp.person.id)
                logger.debug(f"[FACE_MATCH] PersonPhoto {pp.id} matched: Person #{pp.person.person_number}, Photo {pp.photo.id}, Similarity: {similarity_score:.4f}")

            except PersonPhoto.DoesNotExist:
                logger.warning(f"[FACE_MATCH] PersonPhoto {person_photo_id} not found in database")
                continue

        if not matched_faces:
            # All results were below threshold
            best_score = search_results[0][1] if search_results else 0.0
            logger.info(f"[{api_endpoint}] Stage: Face Matching | No match above threshold | Best: {best_score:.3f} < {similarity_threshold}")
            return Response({
                "success": True,
                "matched": False,
                "person": None,
                "matches": [],
                "confidence": float(best_score),
                "message": "Your face was not found in our database. Please upload your photos to events first.",
                "database_status": {
                    "total_face_embeddings": total_face_embeddings,
                    "best_similarity": float(best_score),
                    "threshold_required": similarity_threshold,
                    "status": "below_threshold"
                }
            }, status=status.HTTP_200_OK)

        # STAGE 3: Build Response with matched images
        # Get primary matched person (highest similarity)
        primary_match = matched_faces[0]
        primary_person_id = primary_match["collection_id"]

        try:
            primary_person = Person.objects.get(id=primary_person_id)
        except Person.DoesNotExist:
            error_msg = f"Person with ID {primary_person_id} not found"
            logger.error(f"[API ERROR] {api_endpoint} | Stage: Data Retrieval | Error: {error_msg}")
            return Response({
                "success": False,
                "api": api_endpoint,
                "stage": "Data Retrieval",
                "message": error_msg,
                "error_code": "PERSON_NOT_FOUND"
            }, status=status.HTTP_404_NOT_FOUND)

        # Count total photos for primary person
        total_photos_in_collection = PersonPhoto.objects.filter(person=primary_person).count()

        logger.info(f"[{api_endpoint}] Stage: Success | Person #{primary_person.person_number} | Matched Photos: {len(matched_faces)} | Best Similarity: {primary_match['similarity']:.4f}")
        logger.info(f"[{api_endpoint}] Matched face_ids: {[m['face_id'] for m in matched_faces[:10]]}")
        logger.info(f"[{api_endpoint}] Matched image_ids: {[m['image_id'] for m in matched_faces[:10]]}")

        return Response({
            "success": True,
            "matched": True,
            "person": {
                "id": primary_person.id,
                "person_number": primary_person.person_number,
                "face_image_url": primary_match["image_url"],
                "total_photos_in_collection": total_photos_in_collection
            },
            "matches": matched_faces,  # All matched images with face-level details
            "total_matched_photos": len(matched_faces),
            "collections_matched": list(matched_person_ids),
            "confidence": float(primary_match["similarity"]),
            "detection_confidence": float(detection_confidence),
            "threshold_used": similarity_threshold,
            "message": f"Found {len(matched_faces)} photos containing your face!"
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
