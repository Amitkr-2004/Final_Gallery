"""
Face-level FAISS manager for PersonPhoto embeddings.
Enables matching at face level, returning specific images where faces were detected.
"""
import os
import numpy as np
import faiss
import logging
from django.conf import settings
from .models import PersonPhoto

logger = logging.getLogger(__name__)


class FaceFAISSManager:
    """
    Manages FAISS index for face-level embeddings stored in PersonPhoto.

    Unlike the Person-level FAISS manager, this indexes individual face detections,
    allowing us to match and return specific images where a face was detected.
    """

    def __init__(self, similarity_threshold=0.85, index_path=None):
        """
        Initialize face-level FAISS manager.

        Args:
            similarity_threshold: Minimum cosine similarity to match (0-1)
            index_path: Path to save/load FAISS index
        """
        self.similarity_threshold = similarity_threshold
        base_dir = str(settings.BASE_DIR)
        self.index_path = index_path or os.path.join(base_dir, 'face_faiss_index.bin')
        self.id_map_path = self.index_path.replace('.bin', '_id_map.npy')

        self.index = None
        self.id_map = {}  # Maps FAISS index position to PersonPhoto ID
        self.dimension = 512  # InsightFace embedding dimension

        self._initialize_index()

    def _initialize_index(self):
        """Initialize or load FAISS index."""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.id_map_path):
                self.index = faiss.read_index(self.index_path)
                self.id_map = np.load(self.id_map_path, allow_pickle=True).item()
                self.dimension = self.index.d
                logger.info(f"Loaded face FAISS index with {self.index.ntotal} embeddings")
            else:
                self._create_index(self.dimension)
                logger.info("Created new face FAISS index")
        except Exception as e:
            logger.warning(f"Failed to load face FAISS index: {e}")
            self._create_index(self.dimension)

    def _create_index(self, dimension):
        """Create a new FAISS index."""
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
        self.id_map = {}

    def _normalize_vector(self, vector):
        """Normalize vector for cosine similarity."""
        vector = np.array(vector, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm == 0:
            return vector
        return vector / norm

    def add_face_embedding(self, person_photo_id, embedding):
        """
        Add face embedding to FAISS index.

        Args:
            person_photo_id: PersonPhoto database ID
            embedding: 512D embedding vector
        """
        if embedding is None or len(embedding) != self.dimension:
            logger.warning(f"Invalid embedding for PersonPhoto {person_photo_id}")
            return

        embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
        normalized = self._normalize_vector(embedding[0]).reshape(1, -1)

        self.index.add(normalized)
        faiss_id = self.index.ntotal - 1
        self.id_map[faiss_id] = person_photo_id

        self._save_index()
        logger.debug(f"Added face embedding for PersonPhoto {person_photo_id}")

    def search_similar_faces(self, embedding, k=10):
        """
        Search for similar face embeddings.

        Args:
            embedding: Query embedding (512D)
            k: Number of results to return

        Returns:
            List of tuples: [(person_photo_id, similarity_score), ...]
        """
        if self.index is None or self.index.ntotal == 0:
            return []

        embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
        normalized = self._normalize_vector(embedding[0]).reshape(1, -1)

        distances, indices = self.index.search(normalized, k)

        results = []
        for distance, idx in zip(distances[0], indices[0]):
            if idx != -1 and idx in self.id_map:
                person_photo_id = self.id_map[idx]
                similarity = float(distance)  # Cosine similarity when normalized
                results.append((person_photo_id, similarity))

        return results

    def rebuild_index(self):
        """Rebuild FAISS index from all PersonPhoto records with embeddings."""
        logger.info("Rebuilding face FAISS index...")

        # Get all PersonPhotos with face_embedding
        person_photos = PersonPhoto.objects.exclude(face_embedding__isnull=True)

        if not person_photos.exists():
            self._create_index(self.dimension)
            self._save_index()
            logger.info("No face embeddings found, created empty index")
            return

        # Create new index
        self._create_index(self.dimension)

        count = 0
        for pp in person_photos:
            if pp.face_embedding and len(pp.face_embedding) == self.dimension:
                normalized = self._normalize_vector(pp.face_embedding).reshape(1, -1)
                self.index.add(normalized)
                faiss_id = self.index.ntotal - 1
                self.id_map[faiss_id] = pp.id
                count += 1

        self._save_index()
        logger.info(f"Rebuilt face FAISS index with {count} embeddings")

    def remove_embedding(self, person_photo_id):
        """Remove embedding and rebuild index (FAISS doesn't support direct removal)."""
        self.rebuild_index()

    def _save_index(self):
        """Save FAISS index and ID map to disk."""
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
            np.save(self.id_map_path, self.id_map)

    def get_stats(self):
        """Get index statistics."""
        return {
            'total_face_embeddings': self.index.ntotal if self.index else 0,
            'dimension': self.dimension,
            'similarity_threshold': self.similarity_threshold
        }


# Global face FAISS manager instance
_face_faiss_manager = None


def get_face_faiss_manager(similarity_threshold=None):
    """
    Get or create global face FAISS manager instance.

    Args:
        similarity_threshold: Override threshold (defaults to settings)

    Returns:
        FaceFAISSManager instance
    """
    global _face_faiss_manager

    if similarity_threshold is None:
        similarity_threshold = getattr(settings, 'FAISS_SIMILARITY_THRESHOLD', 0.85)

    if _face_faiss_manager is None:
        _face_faiss_manager = FaceFAISSManager(similarity_threshold=similarity_threshold)
        if _face_faiss_manager.index is None or _face_faiss_manager.index.ntotal == 0:
            try:
                _face_faiss_manager.rebuild_index()
            except Exception as e:
                logger.warning(f"Failed to rebuild face FAISS index: {e}")
    else:
        _face_faiss_manager.similarity_threshold = similarity_threshold

    return _face_faiss_manager
