import { useEffect, useState } from 'react';
import ImagePreview from './ImagePreview';
import './Photos.css';

function Photos() {
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    fetchPhotos();
  }, []);

  const fetchPhotos = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/photos/');
      
      if (!response.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await response.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error fetching photos:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error fetching photos - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure no duplicates by filtering unique image_hash
      const uniquePhotos = data.filter((photo, index, self) =>
        index === self.findIndex((p) => p.image_hash === photo.image_hash)
      );
      
      setPhotos(uniquePhotos);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching photos:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    // Show confirmation dialog
    const confirmed = window.confirm(
      'This photo will be permanently removed from all collections. Continue?'
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(photoId);
      const response = await fetch(`/api/photos/${photoId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await response.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error deleting photo:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error deleting photo - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Optimistic update: Remove photo from state immediately
      setPhotos(photos.filter(photo => photo.id !== photoId));
      
      // Show success message if collections were deleted
      if (result.empty_collections_deleted > 0) {
        alert(`Photo deleted. ${result.empty_collections_deleted} empty collection(s) were also deleted.`);
      }
      
    } catch (err) {
      alert(`Error deleting photo: ${err.message}`);
      console.error('Error deleting photo:', err);
      // Reload photos on error to ensure consistency
      fetchPhotos();
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="photos-container">
        <div className="loading">Loading photos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="photos-container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchPhotos} className="retry-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="photos-container">
      <header className="photos-header">
        <h1>Photo Gallery</h1>
        <p className="photo-count">{photos.length} unique {photos.length === 1 ? 'photo' : 'photos'}</p>
      </header>
      
      {photos.length === 0 ? (
        <div className="no-photos">
          <p>No photos found. Upload some images to get started!</p>
        </div>
      ) : (
        <div className="photos-grid">
          {photos.map((photo) => (
            <div key={photo.id} className="photo-card">
              <div className="photo-image-container">
                <img
                  src={photo.image_url}
                  alt={`ID ${photo.id}`}
                  className="photo-image"
                  loading="lazy"
                  onClick={() => setPreviewImage(photo.image_url)}
                  style={{ cursor: 'pointer' }}
                  onError={(e) => {
                    e.target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="200" height="200"%3E%3Crect width="200" height="200" fill="%23ddd"/%3E%3Ctext x="50%25" y="50%25" text-anchor="middle" dy=".3em" fill="%23999"%3EImage not found%3C/text%3E%3C/svg%3E';
                  }}
                />
                <button
                  className="delete-button"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeletePhoto(photo.id);
                  }}
                  disabled={deletingId === photo.id}
                  title="Delete photo"
                >
                  {deletingId === photo.id ? 'Deleting...' : '×'}
                </button>
              </div>
              <div className="photo-info">
                <p className="photo-id">Photo ID: {photo.id}</p>
                <p className="photo-date">
                  {new Date(photo.uploaded_at).toLocaleDateString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage}
          onClose={() => setPreviewImage(null)}
        />
      )}
    </div>
  );
}

export default Photos;
