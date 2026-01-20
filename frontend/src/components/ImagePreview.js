import { useEffect } from 'react';
import './ImagePreview.css';

function ImagePreview({ imageUrl, onClose }) {
  useEffect(() => {
    // Close on ESC key press
    const handleEscape = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Prevent body scroll when modal is open
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.body.style.overflow = 'unset';
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleBackdropClick = (e) => {
    // Close if clicking the backdrop (not the image)
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="image-preview-overlay" onClick={handleBackdropClick}>
      <button className="image-preview-close" onClick={onClose} aria-label="Close preview">
        ×
      </button>
      <div className="image-preview-container">
        <img
          src={imageUrl}
          alt="Preview"
          className="image-preview-img"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
    </div>
  );
}

export default ImagePreview;
