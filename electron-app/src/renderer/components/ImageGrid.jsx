/**
 * Image Grid Component
 * Displays images in a responsive grid with face count badges
 */

import React from 'react';
import './ImageGrid.css';

function ImageGrid({ images, loading, onImageClick }) {
  if (loading && images.length === 0) {
    return (
      <div className="image-grid">
        {[...Array(12)].map((_, i) => (
          <div key={i} className="image-card skeleton">
            <div className="image-skeleton" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className="image-grid">
      {images.map((image) => (
        <div
          key={image.id}
          className="image-card"
          onClick={() => onImageClick(image)}
        >
          <div className="image-thumbnail">
            {image.thumbnail_path ? (
              <img
                src={`file://${image.thumbnail_path}`}
                alt={image.filename}
                loading="lazy"
              />
            ) : (
              <div className="image-placeholder">
                <span>🖼️</span>
              </div>
            )}
          </div>

          <div className="image-overlay">
            {image.face_count > 0 && (
              <div className="face-badge">
                <span className="face-icon">👤</span>
                <span className="face-count">{image.face_count}</span>
              </div>
            )}
          </div>

          <div className="image-info">
            <div className="image-filename" title={image.filename}>
              {image.filename}
            </div>
            {image.taken_at && (
              <div className="image-date">
                {new Date(image.taken_at).toLocaleDateString()}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default ImageGrid;
