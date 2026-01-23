import React, { useState } from 'react';
import Masonry from 'react-masonry-css';
import LazyImage from '../common/LazyImage';
import ImagePreview from './ImagePreview';
import { Loader } from 'lucide-react';
import './CollectionGrid.css';

/**
 * CollectionGrid Component
 * Displays collection photos in a masonry grid layout
 */
function CollectionGrid({ photos, pagination, onLoadMore, loading }) {
  const [previewImage, setPreviewImage] = useState(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);

  // Masonry breakpoint columns
  const breakpointColumnsObj = {
    default: 4,
    1400: 3,
    1024: 2,
    768: 1,
  };

  // Handle image click for preview
  const handleImageClick = (photo, index) => {
    setPreviewImage(photo.image_url);
    setCurrentImageIndex(index);
  };

  // Navigate to previous image in preview
  const handlePrevImage = () => {
    const newIndex = currentImageIndex > 0 ? currentImageIndex - 1 : photos.length - 1;
    setCurrentImageIndex(newIndex);
    setPreviewImage(photos[newIndex].image_url);
  };

  // Navigate to next image in preview
  const handleNextImage = () => {
    const newIndex = currentImageIndex < photos.length - 1 ? currentImageIndex + 1 : 0;
    setCurrentImageIndex(newIndex);
    setPreviewImage(photos[newIndex].image_url);
  };

  // Close preview
  const handleClosePreview = () => {
    setPreviewImage(null);
  };

  if (!photos || photos.length === 0) {
    return null;
  }

  return (
    <div className="collection-grid-container">
      <div className="collection-header">
        <h3 className="collection-title">
          Your Photos ({pagination?.total || photos.length})
        </h3>
      </div>

      <Masonry
        breakpointCols={breakpointColumnsObj}
        className="collection-masonry-grid"
        columnClassName="collection-masonry-grid-column"
      >
        {photos.map((photo, index) => (
          <div key={photo.id} className="collection-photo-item">
            <LazyImage
              src={photo.image_url}
              alt={`Photo ${photo.id}`}
              className="collection-photo-image"
              onClick={() => handleImageClick(photo, index)}
            />
          </div>
        ))}
      </Masonry>

      {/* Load More Button */}
      {pagination && pagination.has_next && (
        <div className="load-more-container">
          <button
            className="btn-load-more"
            onClick={onLoadMore}
            disabled={loading}
          >
            {loading ? (
              <>
                <Loader size={20} className="spinner" />
                <span>Loading...</span>
              </>
            ) : (
              <span>Load More Photos</span>
            )}
          </button>
        </div>
      )}

      {/* Image Preview Modal */}
      {previewImage && (
        <ImagePreview
          imageUrl={previewImage}
          onClose={handleClosePreview}
          onPrev={handlePrevImage}
          onNext={handleNextImage}
          currentIndex={currentImageIndex}
          totalImages={photos.length}
        />
      )}
    </div>
  );
}

export default CollectionGrid;
