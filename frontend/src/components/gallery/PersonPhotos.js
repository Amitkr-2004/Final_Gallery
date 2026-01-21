import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import ImagePreview from './ImagePreview';
import './PersonPhotos.css';

function PersonPhotos() {
  const { personId, eventId } = useParams();
  const navigate = useNavigate();
  const [photos, setPhotos] = useState([]);
  const [person, setPerson] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    if (personId) {
      fetchPersonPhotos();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [personId]);

  const fetchPersonPhotos = async () => {
    try {
      setLoading(true);
      
      // Fetch person info first
      const personsResponse = await fetch('/api/persons/');
      if (!personsResponse.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await personsResponse.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error fetching persons:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error fetching persons - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${personsResponse.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${personsResponse.status}`);
      }
      const personsData = await personsResponse.json();
      const personData = personsData.find(p => p.id === parseInt(personId));
      
      if (!personData) {
        throw new Error('Person not found');
      }
      setPerson(personData);
      
      // Fetch photos for this person
      const photosResponse = await fetch(`/api/persons/${personId}/photos/`);
      
      if (!photosResponse.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await photosResponse.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error fetching person photos:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error fetching person photos - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${photosResponse.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${photosResponse.status}`);
      }
      
      const photosData = await photosResponse.json();
      
      // Ensure no duplicates by filtering unique image_hash
      const uniquePhotos = photosData.filter((photo, index, self) =>
        index === self.findIndex((p) => p.image_hash === photo.image_hash)
      );
      
      setPhotos(uniquePhotos);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching person photos:', err);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="person-photos-container">
        <div className="loading">Loading photos...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="person-photos-container">
        <div className="error">Error: {error}</div>
        <button onClick={() => navigate(`/events/${eventId}/gallery/collections`)} className="back-button">
          Back to Collections
        </button>
      </div>
    );
  }

  return (
    <div className="person-photos-container">
      <header className="person-photos-header">
        <button onClick={() => navigate(`/events/${eventId}/gallery/collections`)} className="back-button">
          ← Back to Collections
        </button>
        <div className="header-info">
          <h1>Person {person?.person_number}</h1>
          <p className="photo-count">
            {photos.length} {photos.length === 1 ? 'photo' : 'photos'}
          </p>
        </div>
      </header>
      
      {photos.length === 0 ? (
        <div className="no-photos">
          <p>No photos found for this person.</p>
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

export default PersonPhotos;
