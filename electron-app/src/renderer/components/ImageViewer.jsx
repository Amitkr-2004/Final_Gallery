/**
 * Image Viewer Component
 * Lightbox modal for viewing full-size images with face detection overlays
 */

import React, { useState, useEffect } from 'react';
import Button from './Button';
import './ImageViewer.css';

const { electronAPI } = window;

function ImageViewer({ image, onClose, onNext, onPrev, hasNext, hasPrev }) {
  const [faces, setFaces] = useState([]);
  const [showOverlay, setShowOverlay] = useState(true);
  const [zoom, setZoom] = useState(1);
  const [imageSize, setImageSize] = useState({ width: 0, height: 0 });

  useEffect(() => {
    loadFaces();

    // Keyboard navigation
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight' && hasNext) onNext();
      if (e.key === 'ArrowLeft' && hasPrev) onPrev();
      if (e.key === 'f') setShowOverlay(prev => !prev);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [image.id]);

  const loadFaces = async () => {
    try {
      const facesData = await electronAPI.processing.getFaces(image.id);
      setFaces(facesData);
    } catch (error) {
      console.error('Failed to load faces:', error);
    }
  };

  const handleImageLoad = (e) => {
    setImageSize({
      width: e.target.naturalWidth,
      height: e.target.naturalHeight
    });
  };

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleZoomReset = () => {
    setZoom(1);
  };

  const formatDate = (dateString) => {
    if (!dateString) return null;
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  return (
    <div className="image-viewer-overlay" onClick={onClose}>
      <div className="image-viewer" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="viewer-header">
          <div className="viewer-title">
            <h3>{image.filename}</h3>
            {image.taken_at && (
              <span className="viewer-date">{formatDate(image.taken_at)}</span>
            )}
          </div>
          <div className="viewer-controls">
            <Button
              variant="ghost"
              size="sm"
              icon={showOverlay ? '👁️' : '👁️‍🗨️'}
              onClick={() => setShowOverlay(!showOverlay)}
              title="Toggle face overlay"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="➖"
              onClick={handleZoomOut}
              disabled={zoom <= 0.5}
              title="Zoom out"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleZoomReset}
              title="Reset zoom"
            >
              {Math.round(zoom * 100)}%
            </Button>
            <Button
              variant="ghost"
              size="sm"
              icon="➕"
              onClick={handleZoomIn}
              disabled={zoom >= 3}
              title="Zoom in"
            />
            <Button
              variant="ghost"
              size="sm"
              icon="✕"
              onClick={onClose}
              title="Close (Esc)"
            />
          </div>
        </div>

        {/* Image Container */}
        <div className="viewer-content">
          {/* Navigation */}
          {hasPrev && (
            <button className="nav-button nav-prev" onClick={onPrev}>
              ←
            </button>
          )}

          <div className="image-container">
            <div
              className="image-wrapper"
              style={{ transform: `scale(${zoom})` }}
            >
              <img
                src={`file://${image.local_path}`}
                alt={image.filename}
                onLoad={handleImageLoad}
              />

              {/* Face Overlays */}
              {showOverlay && faces.length > 0 && imageSize.width > 0 && (
                <div className="face-overlays">
                  {faces.map((face) => {
                    const box = face.bounding_box;
                    const scaleX = 100 / imageSize.width;
                    const scaleY = 100 / imageSize.height;

                    return (
                      <div
                        key={face.id}
                        className="face-box"
                        style={{
                          left: `${box.x * scaleX}%`,
                          top: `${box.y * scaleY}%`,
                          width: `${box.width * scaleX}%`,
                          height: `${box.height * scaleY}%`
                        }}
                      >
                        {face.person_name && (
                          <div className="face-label">{face.person_name}</div>
                        )}
                        {face.age && (
                          <div className="face-info">
                            {face.age}y, {face.gender}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {hasNext && (
            <button className="nav-button nav-next" onClick={onNext}>
              →
            </button>
          )}
        </div>

        {/* Metadata Sidebar */}
        <div className="viewer-sidebar">
          <div className="metadata-section">
            <h4>Image Details</h4>
            <div className="metadata-item">
              <span className="metadata-label">Dimensions</span>
              <span className="metadata-value">
                {image.width} × {image.height}
              </span>
            </div>
            {image.size && (
              <div className="metadata-item">
                <span className="metadata-label">Size</span>
                <span className="metadata-value">
                  {(image.size / 1024 / 1024).toFixed(2)} MB
                </span>
              </div>
            )}
            {image.camera_make && (
              <div className="metadata-item">
                <span className="metadata-label">Camera</span>
                <span className="metadata-value">
                  {image.camera_make} {image.camera_model}
                </span>
              </div>
            )}
          </div>

          {faces.length > 0 && (
            <div className="metadata-section">
              <h4>Faces ({faces.length})</h4>
              <div className="faces-list">
                {faces.map((face) => (
                  <div key={face.id} className="face-item">
                    {face.thumbnail_path && (
                      <img
                        src={`file://${face.thumbnail_path}`}
                        alt="Face"
                        className="face-thumb"
                      />
                    )}
                    <div className="face-details">
                      <div className="face-name">
                        {face.person_name || 'Unknown'}
                      </div>
                      {face.age && (
                        <div className="face-meta">
                          {face.age}y, {face.gender}
                        </div>
                      )}
                      <div className="face-confidence">
                        {Math.round(face.confidence * 100)}% confidence
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default ImageViewer;
