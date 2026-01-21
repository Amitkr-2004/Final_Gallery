import { useEffect, useState, useRef } from 'react';
import { X, ChevronLeft, ChevronRight, ZoomIn, ZoomOut, RotateCcw, Loader } from 'lucide-react';
import './ImagePreview.css';

function ImagePreview({ imageUrl, images = [], currentIndex = 0, onClose }) {
  const [zoom, setZoom] = useState(1);
  const [loading, setLoading] = useState(true);
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const imageRef = useRef(null);

  const hasMultipleImages = images.length > 1;
  const currentImageUrl = hasMultipleImages ? images[activeIndex] : imageUrl;

  useEffect(() => {
    setActiveIndex(currentIndex);
  }, [currentIndex]);

  useEffect(() => {
    // Reset zoom when image changes
    setZoom(1);
    setLoading(true);
  }, [activeIndex, currentImageUrl]);

  useEffect(() => {
    // Keyboard controls
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && hasMultipleImages) {
        handlePrevious();
      } else if (e.key === 'ArrowRight' && hasMultipleImages) {
        handleNext();
      }
    };

    // Mouse wheel zoom
    const handleWheel = (e) => {
      if (e.ctrlKey || e.metaKey) {
        e.preventDefault();
        const delta = e.deltaY > 0 ? -0.1 : 0.1;
        setZoom((prevZoom) => Math.min(Math.max(prevZoom + delta, 0.5), 3));
      }
    };

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('wheel', handleWheel);
    };
  }, [onClose, hasMultipleImages, activeIndex, images.length]);

  const handlePrevious = () => {
    if (hasMultipleImages && activeIndex > 0) {
      setActiveIndex(activeIndex - 1);
    }
  };

  const handleNext = () => {
    if (hasMultipleImages && activeIndex < images.length - 1) {
      setActiveIndex(activeIndex + 1);
    }
  };

  const handleZoomIn = () => {
    setZoom((prevZoom) => Math.min(prevZoom + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom((prevZoom) => Math.max(prevZoom - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleImageLoad = () => {
    setLoading(false);
  };

  return (
    <div className="image-preview-overlay" onClick={handleBackdropClick}>
      {/* Close button */}
      <button className="image-preview-close" onClick={onClose} aria-label="Close preview">
        <X size={24} />
      </button>

      {/* Image counter */}
      {hasMultipleImages && (
        <div className="image-preview-counter">
          {activeIndex + 1} / {images.length}
        </div>
      )}

      {/* Zoom controls */}
      <div className="image-preview-zoom-controls">
        <button onClick={handleZoomOut} disabled={zoom <= 0.5} aria-label="Zoom out">
          <ZoomOut size={20} />
        </button>
        <span className="zoom-level">{Math.round(zoom * 100)}%</span>
        <button onClick={handleZoomIn} disabled={zoom >= 3} aria-label="Zoom in">
          <ZoomIn size={20} />
        </button>
        <button onClick={handleResetZoom} aria-label="Reset zoom">
          <RotateCcw size={20} />
        </button>
      </div>

      {/* Navigation buttons */}
      {hasMultipleImages && (
        <>
          <button
            className="image-preview-nav image-preview-nav-left"
            onClick={handlePrevious}
            disabled={activeIndex === 0}
            aria-label="Previous image"
          >
            <ChevronLeft size={32} />
          </button>
          <button
            className="image-preview-nav image-preview-nav-right"
            onClick={handleNext}
            disabled={activeIndex === images.length - 1}
            aria-label="Next image"
          >
            <ChevronRight size={32} />
          </button>
        </>
      )}

      {/* Image container */}
      <div className="image-preview-container">
        {loading && (
          <div className="image-preview-loader">
            <Loader className="spinner" size={48} />
          </div>
        )}
        <img
          ref={imageRef}
          src={currentImageUrl}
          alt="Preview"
          className="image-preview-img"
          style={{ transform: `scale(${zoom})` }}
          onClick={(e) => e.stopPropagation()}
          onLoad={handleImageLoad}
        />
      </div>
    </div>
  );
}

export default ImagePreview;
