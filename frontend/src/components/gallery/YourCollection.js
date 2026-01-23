import React, { useState, useEffect } from 'react';
import { Camera, Upload, Loader } from 'lucide-react';
import FaceScanModal from './FaceScanModal';
import CollectionGrid from './CollectionGrid';
import EmptyCollectionState from './EmptyCollectionState';
import { useCollection } from '../../hooks/useCollection';
import './YourCollection.css';

/**
 * YourCollection Component
 * Main page for "Your Collection" feature
 * Allows students to scan/upload face and view their photos
 */
function YourCollection() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [scanComplete, setScanComplete] = useState(false);
  const [showEmptyState, setShowEmptyState] = useState(false);

  const {
    loading,
    error,
    matchedPerson,
    photos,
    pagination,
    scanFace,
    fetchCollectionPhotos,
    loadMorePhotos,
    resetCollection,
  } = useCollection();

  // Handle image capture from modal (camera or upload)
  const handleImageCapture = async (imageBlob) => {
    try {
      // Scan face
      const result = await scanFace(imageBlob);

      // Close modal
      setIsModalOpen(false);
      setScanComplete(true);

      if (result.matched) {
        // Match found - fetch photos
        await fetchCollectionPhotos(result.person.id);
        setShowEmptyState(false);
      } else {
        // No match found - show empty state
        setShowEmptyState(true);
      }
    } catch (err) {
      console.error('[YourCollection] Scan error:', err);
      setIsModalOpen(false);
      setScanComplete(true);
      setShowEmptyState(true);
    }
  };

  // Handle try again (reset and open modal)
  const handleTryAgain = () => {
    resetCollection();
    setScanComplete(false);
    setShowEmptyState(false);
    setIsModalOpen(true);
  };

  // Handle load more photos
  const handleLoadMore = () => {
    loadMorePhotos();
  };

  return (
    <div className="your-collection-page">
      <div className="your-collection-header">
        <h1 className="page-title">Your Collection</h1>
        <p className="page-subtitle">
          Find all your photos from uploaded events
        </p>
      </div>

      {/* Initial Scan Section (Before any scan attempt) */}
      {!scanComplete && (
        <div className="scan-section">
          <div className="scan-card">
            <h2 className="scan-title">Find Your Photos</h2>
            <p className="scan-description">
              Use your camera or upload a photo to find all images containing your face
            </p>

            <div className="scan-buttons">
              <button
                className="scan-btn camera-btn"
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
              >
                <Camera size={24} />
                <span>Scan with Camera</span>
              </button>

              <button
                className="scan-btn upload-btn"
                onClick={() => setIsModalOpen(true)}
                disabled={loading}
              >
                <Upload size={24} />
                <span>Upload Photo</span>
              </button>
            </div>

            <div className="scan-tips">
              <p className="tips-title">Tips for best results:</p>
              <ul className="tips-list">
                <li>Use a clear, front-facing photo</li>
                <li>Ensure good lighting</li>
                <li>Only one face in the photo</li>
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Loading State (During face matching) */}
      {loading && scanComplete && (
        <div className="loading-section">
          <Loader size={48} className="spinner" />
          <p className="loading-text">Searching for your photos...</p>
          <p className="loading-subtext">This may take a few seconds</p>
        </div>
      )}

      {/* Error State */}
      {error && !loading && (
        <div className="error-section">
          <div className="error-card">
            <h3 className="error-title">Something went wrong</h3>
            <p className="error-message">{error}</p>
            <button className="btn-primary" onClick={handleTryAgain}>
              Try Again
            </button>
          </div>
        </div>
      )}

      {/* Empty State (No match found) */}
      {showEmptyState && !loading && !error && (
        <EmptyCollectionState onTryAgain={handleTryAgain} />
      )}

      {/* Collection Results (Match found) */}
      {matchedPerson && photos.length > 0 && !loading && !error && (
        <div className="collection-results">
          <div className="collection-info">
            <h2 className="collection-info-title">
              Found Your Collection!
            </h2>
            <p className="collection-info-text">
              We found {pagination?.total || photos.length} photos of you
            </p>
            <button
              className="btn-secondary-small"
              onClick={handleTryAgain}
            >
              Search Again
            </button>
          </div>

          <CollectionGrid
            photos={photos}
            pagination={pagination}
            onLoadMore={handleLoadMore}
            loading={loading}
          />
        </div>
      )}

      {/* Face Scan Modal */}
      <FaceScanModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onImageCapture={handleImageCapture}
        loading={loading}
      />
    </div>
  );
}

export default YourCollection;
