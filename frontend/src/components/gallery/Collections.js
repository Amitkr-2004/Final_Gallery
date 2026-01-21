import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SkeletonLoader from '../common/SkeletonLoader';
import LazyImage from '../common/LazyImage';
import './Collections.css';

function Collections() {
  const navigate = useNavigate();
  const { eventId } = useParams();
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  useEffect(() => {
    fetchPersons();
  }, []);

  const fetchPersons = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/persons/');
      
      if (!response.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await response.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error fetching persons:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error fetching persons - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`);
      }
      
      const data = await response.json();
      
      // Ensure no duplicates by filtering unique person_number
      // Also sort by person_number to ensure ascending order
      const uniquePersons = data
        .filter((person, index, self) =>
          index === self.findIndex((p) => p.person_number === person.person_number)
        )
        .sort((a, b) => a.person_number - b.person_number);
      
      setPersons(uniquePersons);
      setError(null);
    } catch (err) {
      setError(err.message);
      console.error('Error fetching persons:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteCollection = async (personId, personNumber, event) => {
    // Prevent navigation when clicking delete button
    event.stopPropagation();
    
    // Show confirmation dialog
    const confirmed = window.confirm(
      `This collection and all its photos will be permanently deleted. This action cannot be undone.\n\nAre you sure you want to delete Person ${personNumber}?`
    );
    
    if (!confirmed) {
      return;
    }

    try {
      setDeletingId(personId);
      const response = await fetch(`/api/persons/${personId}/`, {
        method: 'DELETE',
      });

      if (!response.ok) {
        // Read response as text first (body can only be read once)
        const errorText = await response.text();
        let errorData;
        try {
          // Try to parse as JSON
          errorData = JSON.parse(errorText);
          console.error('Error deleting person:', errorData);
          console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
        } catch (e) {
          // If not JSON, use text directly
          console.error('Error deleting person - response body (not JSON):', errorText);
          throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
        }
        throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`);
      }

      const result = await response.json();
      
      // Optimistic update: Remove collection from state immediately
      setPersons(persons.filter(person => person.id !== personId));
      
      alert(`Collection deleted successfully. ${result.photos_deleted} photo(s) were removed.`);
      
    } catch (err) {
      alert(`Error deleting collection: ${err.message}`);
      console.error('Error deleting collection:', err);
      // Reload collections on error to ensure consistency
      fetchPersons();
    } finally {
      setDeletingId(null);
    }
  };

  if (loading) {
    return (
      <div className="collections-container">
        <header className="collections-header">
          <h1>Collections</h1>
        </header>
        <div className="persons-grid">
          <SkeletonLoader variant="circle" count={8} />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="collections-container">
        <div className="error">Error: {error}</div>
        <button onClick={fetchPersons} className="retry-button">Retry</button>
      </div>
    );
  }

  return (
    <div className="collections-container">
      <header className="collections-header">
        <h1>Collections</h1>
        <p className="person-count">{persons.length} {persons.length === 1 ? 'person' : 'persons'}</p>
      </header>
      
      {persons.length === 0 ? (
        <div className="no-persons">
          <p>No persons found. Upload images with faces to create collections!</p>
        </div>
      ) : (
        <div className="persons-grid">
          {persons.map((person) => (
            <div
              key={person.id}
              className="person-avatar-wrapper"
              onClick={() => navigate(`/events/${eventId}/gallery/persons/${person.id}/photos`)}
            >
              <button
                className="delete-avatar-button"
                onClick={(e) => handleDeleteCollection(person.id, person.person_number, e)}
                disabled={deletingId === person.id}
                title={`Delete Person ${person.person_number}`}
              >
                ×
              </button>

              {person.face_image_url ? (
                <LazyImage
                  src={person.face_image_url}
                  alt={`Person ${person.person_number}`}
                  className="person-avatar"
                />
              ) : (
                <div className="person-avatar-placeholder">
                  {person.person_number}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Collections;
