/**
 * Custom hook for "Your Collection" feature
 * Handles face scanning and collection photo fetching
 */
import { useState, useCallback } from 'react';

const API_BASE_URL = 'http://localhost:8000/api';

/**
 * Hook for managing collection operations
 */
export const useCollection = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [matchedPerson, setMatchedPerson] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [pagination, setPagination] = useState(null);

  /**
   * Scan face and search for matching collection
   * @param {File|Blob} imageFile - Face image to scan
   * @returns {Promise<Object>} Scan result with person data
   */
  const scanFace = useCallback(async (imageFile) => {
    setLoading(true);
    setError(null);

    try {
      console.info('[YourCollection] Scanning face...');

      // Create FormData for multipart upload
      const formData = new FormData();
      formData.append('image', imageFile, 'face.jpg');

      const response = await fetch(`${API_BASE_URL}/collection/scan-face/`, {
        method: 'POST',
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.message || 'Failed to scan face';
        console.error(
          `[YourCollection] API Failed → ${data.api} → ${data.stage} → ${errorMessage}`
        );
        throw new Error(errorMessage);
      }

      console.info(
        `[YourCollection] Success → Matched: ${data.matched} → ${
          data.matched ? `Person #${data.person.person_number}` : 'No match'
        }`
      );

      // Store matched person if found
      if (data.matched) {
        setMatchedPerson(data.person);
      } else {
        setMatchedPerson(null);
        setPhotos([]);
        setPagination(null);
      }

      setLoading(false);
      return data;
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      console.error('[YourCollection] Scan failed:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      setMatchedPerson(null);
      setPhotos([]);
      setPagination(null);
      throw err;
    }
  }, []);

  /**
   * Fetch photos for a specific person/collection
   * @param {number} personId - Person ID
   * @param {Object} options - Query options (page, limit, event_id)
   * @returns {Promise<Object>} Photos and pagination data
   */
  const fetchCollectionPhotos = useCallback(async (personId, options = {}) => {
    setLoading(true);
    setError(null);

    try {
      const { page = 1, limit = 50, event_id = null } = options;

      // Build query string
      const params = new URLSearchParams({
        page: page.toString(),
        limit: limit.toString(),
      });

      if (event_id) {
        params.append('event_id', event_id);
      }

      console.info(`[YourCollection] Fetching photos for Person #${personId}...`);

      const response = await fetch(
        `${API_BASE_URL}/collection/${personId}/photos/?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        const errorMessage = data.message || 'Failed to fetch collection photos';
        console.error(
          `[YourCollection] API Failed → ${data.api} → ${data.stage} → ${errorMessage}`
        );
        throw new Error(errorMessage);
      }

      console.info(
        `[YourCollection] Success → Fetched ${data.photos.length} photos (Page ${data.pagination.page}/${data.pagination.pages})`
      );

      setPhotos(data.photos);
      setPagination(data.pagination);
      setMatchedPerson(data.person);
      setLoading(false);

      return data;
    } catch (err) {
      const errorMessage = err.message || 'An unexpected error occurred';
      console.error('[YourCollection] Fetch failed:', errorMessage);
      setError(errorMessage);
      setLoading(false);
      throw err;
    }
  }, []);

  /**
   * Load more photos (next page)
   */
  const loadMorePhotos = useCallback(async () => {
    if (!matchedPerson || !pagination || !pagination.has_next) {
      return;
    }

    const nextPage = pagination.page + 1;

    try {
      const data = await fetchCollectionPhotos(matchedPerson.id, {
        page: nextPage,
        limit: pagination.limit,
      });

      // Append new photos to existing ones
      setPhotos((prevPhotos) => [...prevPhotos, ...data.photos]);
    } catch (err) {
      console.error('[YourCollection] Load more failed:', err);
    }
  }, [matchedPerson, pagination, fetchCollectionPhotos]);

  /**
   * Reset collection state
   */
  const resetCollection = useCallback(() => {
    setMatchedPerson(null);
    setPhotos([]);
    setPagination(null);
    setError(null);
    setLoading(false);
  }, []);

  return {
    // State
    loading,
    error,
    matchedPerson,
    photos,
    pagination,

    // Actions
    scanFace,
    fetchCollectionPhotos,
    loadMorePhotos,
    resetCollection,
  };
};

export default useCollection;
