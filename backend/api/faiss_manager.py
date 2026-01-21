"""
FAISS vector database manager for person embeddings.
"""
import os
import numpy as np
import faiss
from django.conf import settings
from django.db import models
from .models import Person


class FAISSManager:
    """Manages FAISS index for person embeddings."""
    
    def __init__(self, similarity_threshold=0.7, index_path=None):
        """
        Initialize FAISS manager.
        
        Args:
            similarity_threshold: Minimum cosine similarity to match a person (0-1)
            index_path: Path to save/load FAISS index (default: backend/faiss_index.bin)
        """
        self.similarity_threshold = similarity_threshold
        # Convert BASE_DIR to string if it's a Path object
        base_dir = str(settings.BASE_DIR)
        self.index_path = index_path or os.path.join(
            base_dir, 'faiss_index.bin'
        )
        self.id_map_path = index_path.replace('.bin', '_id_map.npy') if index_path else os.path.join(
            base_dir, 'faiss_id_map.npy'
        )
        self.index = None
        self.id_map = {}  # Maps FAISS index position to Person ID
        self.dimension = None
        self._initialize_index()
    
    def _initialize_index(self):
        """Initialize or load FAISS index."""
        try:
            if os.path.exists(self.index_path) and os.path.exists(self.id_map_path):
                # Load existing index
                self.index = faiss.read_index(self.index_path)
                self.id_map = np.load(self.id_map_path, allow_pickle=True).item()
                # Get dimension from index
                self.dimension = self.index.d
            else:
                # Create new index - dimension will be set when first embedding is added
                self.dimension = None
                self.index = None
                self.id_map = {}
        except Exception as e:
            # If loading fails, start fresh
            import logging
            logger = logging.getLogger(__name__)
            logger.warning(f"Failed to load FAISS index, starting fresh: {str(e)}")
            self.dimension = None
            self.index = None
            self.id_map = {}
    
    def _create_index(self, dimension):
        """
        Create a new FAISS index.
        
        Args:
            dimension: Dimension of embedding vectors
        """
        # Use IndexFlatIP (Inner Product) for cosine similarity
        # Normalize vectors for cosine similarity
        self.dimension = dimension
        self.index = faiss.IndexFlatIP(dimension)  # Inner product for cosine similarity
    
    def _normalize_vector(self, vector):
        """
        Normalize vector for cosine similarity.
        
        Args:
            vector: Numpy array or list
            
        Returns:
            Normalized numpy array
        """
        vector = np.array(vector, dtype=np.float32)
        norm = np.linalg.norm(vector)
        if norm == 0:
            return vector
        return vector / norm
    
    def add_embedding(self, person_id, embedding):
        """
        Add embedding to FAISS index.
        
        Args:
            person_id: Person database ID
            embedding: Embedding vector (list or numpy array)
        """
        embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
        
        # Initialize index if needed
        if self.index is None:
            self._create_index(embedding.shape[1])
        
        # Normalize embedding for cosine similarity
        normalized = self._normalize_vector(embedding[0])
        normalized = normalized.reshape(1, -1)
        
        # Add to index
        self.index.add(normalized)
        
        # Map FAISS index position to Person ID
        faiss_id = self.index.ntotal - 1
        self.id_map[faiss_id] = person_id
        
        # Save index
        self._save_index()
    
    def search_similar(self, embedding, k=1):
        """
        Search for similar embeddings in FAISS index.
        
        Args:
            embedding: Query embedding vector (list or numpy array)
            k: Number of nearest neighbors to return
            
        Returns:
            List of tuples (person_id, similarity_score)
        """
        if self.index is None or self.index.ntotal == 0:
            return []
        
        embedding = np.array(embedding, dtype=np.float32).reshape(1, -1)
        
        # Normalize query embedding
        normalized = self._normalize_vector(embedding[0])
        normalized = normalized.reshape(1, -1)
        
        # Search in FAISS (returns distances and indices)
        distances, indices = self.index.search(normalized, k)
        
        results = []
        for i, (distance, idx) in enumerate(zip(distances[0], indices[0])):
            if idx != -1 and idx in self.id_map:  # -1 means no result
                person_id = self.id_map[idx]
                # Distance is inner product (cosine similarity when normalized)
                similarity = float(distance)
                results.append((person_id, similarity))
        
        return results
    
    def find_or_create_person(self, embedding):
        """
        Find existing person or create new one based on similarity threshold.
        
        Behavior:
        - Compare embedding with existing persons using FAISS similarity search
        - If similarity >= threshold → Match found → Return existing person (no new collection)
        - If no match found → Create new person + new collection → Return new person
        
        Args:
            embedding: Face embedding vector
            
        Returns:
            Tuple (person, is_new): Person object and boolean indicating if newly created
                - is_new=True: New person/collection was created
                - is_new=False: Existing person/collection was matched
        """
        # Step 1: Search for similar embeddings in existing persons
        results = self.search_similar(embedding, k=1)
        
        # Step 2: If match found (similarity >= threshold), use existing person
        if results:
            person_id, similarity = results[0]
            if similarity >= self.similarity_threshold:
                # Match found → return existing person (do not create new collection)
                person = Person.objects.get(id=person_id)
                return person, False
        
        # Step 3: No match found → Create new person + new collection
        # Person.save() will handle person_number auto-increment starting from 1
        # This ensures collections numbering is strictly ascending
        from django.db import transaction
        
        with transaction.atomic():
            # Create new person without person_number - let save() handle it
            # This ensures thread-safe sequential numbering starting from 1
            person = Person(
                embedding_vector=embedding.tolist() if isinstance(embedding, np.ndarray) else embedding
            )
            person.save()  # save() will auto-increment person_number
        
        # Add new person's embedding to FAISS index for future matching
        self.add_embedding(person.id, embedding)
        
        return person, True  # is_new=True indicates new person/collection was created
    
    def rebuild_index(self):
        """Rebuild FAISS index from all Person records in database."""
        persons = Person.objects.all()

        if not persons.exists():
            # Database is empty - reset index
            self.index = None
            self.id_map = {}
            self.dimension = None
            # Clean up any orphaned index files
            try:
                if os.path.exists(self.index_path):
                    os.remove(self.index_path)
                if os.path.exists(self.id_map_path):
                    os.remove(self.id_map_path)
            except Exception:
                pass
            return

        # Get dimension from first person
        first_embedding = np.array(persons.first().embedding_vector, dtype=np.float32)
        dimension = len(first_embedding)

        # Create new index
        self._create_index(dimension)
        self.id_map = {}

        # Add all persons to index
        for person in persons:
            embedding = np.array(person.embedding_vector, dtype=np.float32)
            # Normalize and add manually to avoid nested save calls
            normalized = self._normalize_vector(embedding).reshape(1, -1)
            self.index.add(normalized)
            faiss_id = self.index.ntotal - 1
            self.id_map[faiss_id] = person.id

        # Save the rebuilt index
        self._save_index()
    
    def remove_embedding(self, person_id):
        """
        Remove embedding from FAISS index when a person is deleted.
        
        Args:
            person_id: Person database ID to remove
        """
        if self.index is None or self.index.ntotal == 0:
            return
        
        # Find FAISS index position for this person_id
        faiss_positions_to_remove = [
            pos for pos, pid in self.id_map.items() if pid == person_id
        ]
        
        if not faiss_positions_to_remove:
            return
        
        # FAISS doesn't support direct removal, so rebuild index without this person
        # This is more reliable than trying to remove individual entries
        self.rebuild_index()
        # Save the rebuilt index
        self._save_index()
    
    def _save_index(self):
        """Save FAISS index and ID map to disk."""
        if self.index is not None:
            faiss.write_index(self.index, self.index_path)
            np.save(self.id_map_path, self.id_map)
    
    def get_stats(self):
        """Get statistics about the FAISS index."""
        if self.index is None:
            return {
                'total_embeddings': 0,
                'dimension': None,
                'similarity_threshold': self.similarity_threshold
            }
        
        return {
            'total_embeddings': self.index.ntotal,
            'dimension': self.dimension,
            'similarity_threshold': self.similarity_threshold
        }


# Global FAISS manager instance
_faiss_manager = None


def get_faiss_manager(similarity_threshold=0.7):
    """
    Get or create global FAISS manager instance.

    Args:
        similarity_threshold: Minimum cosine similarity to match a person

    Returns:
        FAISSManager instance
    """
    global _faiss_manager
    if _faiss_manager is None:
        _faiss_manager = FAISSManager(similarity_threshold=similarity_threshold)
        # Rebuild index from database if it doesn't exist
        # This handles both empty database (after clearing) and missing index files
        if _faiss_manager.index is None:
            try:
                _faiss_manager.rebuild_index()
            except Exception as e:
                import logging
                logger = logging.getLogger(__name__)
                logger.warning(f"Failed to rebuild FAISS index on initialization: {str(e)}")
                # Continue anyway - index will be created on first upload
    return _faiss_manager
