import React, { useState, useRef, useEffect } from 'react';
import { Camera, Upload, X, Loader } from 'lucide-react';
import {
  startCamera,
  stopCamera,
  captureImageFromVideo,
  validateImageFile,
  compressImage,
} from '../../utils/faceCapture';
import './FaceScanModal.css';

/**
 * FaceScanModal Component
 * Modal for scanning face using camera or uploading image
 */
function FaceScanModal({ isOpen, onClose, onImageCapture, loading }) {
  const [mode, setMode] = useState('select'); // 'select', 'camera', 'upload'
  const [cameraStream, setCameraStream] = useState(null);
  const [error, setError] = useState(null);
  const [isVideoReady, setIsVideoReady] = useState(false);
  const videoRef = useRef(null);
  const fileInputRef = useRef(null);

  // Cleanup camera stream on unmount or mode change
  useEffect(() => {
    return () => {
      if (cameraStream) {
        stopCamera(cameraStream);
      }
    };
  }, [cameraStream]);

  // Reset video ready state when mode changes
  useEffect(() => {
    if (mode !== 'camera') {
      setIsVideoReady(false);
    }
  }, [mode]);

  // Attach stream to video element and handle loading
  useEffect(() => {
    const video = videoRef.current;

    // Only run when we're in camera mode and have a stream
    if (mode !== 'camera' || !cameraStream || !video) {
      return;
    }

    console.log('[FaceScanModal] Attaching stream to video element');

    // Attach stream to video
    video.srcObject = cameraStream;

    const handleLoadedMetadata = () => {
      console.log('[FaceScanModal] Video metadata loaded:', {
        width: video.videoWidth,
        height: video.videoHeight,
        readyState: video.readyState
      });

      // Ensure video starts playing
      video.play().then(() => {
        setIsVideoReady(true);
        console.log('[FaceScanModal] Video playing successfully');
      }).catch(err => {
        console.error('[FaceScanModal] Video play failed:', err);
        setError('Failed to start video playback');
      });
    };

    const handleCanPlay = () => {
      console.log('[FaceScanModal] Video can play');
    };

    const handleError = (e) => {
      console.error('[FaceScanModal] Video error:', e);
      setError('Video playback error');
    };

    // Add event listeners
    video.addEventListener('loadedmetadata', handleLoadedMetadata);
    video.addEventListener('canplay', handleCanPlay);
    video.addEventListener('error', handleError);

    return () => {
      video.removeEventListener('loadedmetadata', handleLoadedMetadata);
      video.removeEventListener('canplay', handleCanPlay);
      video.removeEventListener('error', handleError);
    };
  }, [mode, cameraStream]);

  // Close modal and cleanup
  const handleClose = () => {
    if (cameraStream) {
      stopCamera(cameraStream);
      setCameraStream(null);
    }
    setMode('select');
    setError(null);
    setIsVideoReady(false);
    onClose();
  };

  // Start camera mode
  const handleStartCamera = async () => {
    setError(null);
    setIsVideoReady(false);
    try {
      console.log('[FaceScanModal] Starting camera...');
      const stream = await startCamera();
      console.log('[FaceScanModal] Camera stream obtained');

      // Set stream first, then mode
      // The useEffect will attach the stream to the video element after it's rendered
      setCameraStream(stream);
      setMode('camera');
    } catch (err) {
      setError(err.message);
      console.error('[FaceScanModal] Camera start failed:', err);
    }
  };

  // Capture photo from camera
  const handleCapturePhoto = async () => {
    if (!videoRef.current || !cameraStream) {
      setError('Camera not ready');
      return;
    }

    if (!isVideoReady) {
      setError('Please wait for video to load');
      return;
    }

    // Double-check video dimensions
    if (!videoRef.current.videoWidth || !videoRef.current.videoHeight) {
      setError('Video not fully loaded. Please try again.');
      return;
    }

    setError(null);
    try {
      const imageBlob = await captureImageFromVideo(videoRef.current);

      // Stop camera
      stopCamera(cameraStream);
      setCameraStream(null);
      setIsVideoReady(false);

      // Send captured image to parent
      onImageCapture(imageBlob);
    } catch (err) {
      setError('Failed to capture image. Please try again.');
      console.error('[FaceScanModal] Capture failed:', err);
    }
  };

  // Handle file upload
  const handleFileUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setError(null);

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      setError(validation.error);
      return;
    }

    try {
      // Compress image
      const compressedBlob = await compressImage(file);

      // Send uploaded image to parent
      onImageCapture(compressedBlob);
    } catch (err) {
      setError('Failed to process image');
      console.error('[FaceScanModal] Upload failed:', err);
    }
  };

  // Render nothing if modal is closed
  if (!isOpen) return null;

  return (
    <div className="face-scan-modal-overlay" onClick={handleClose}>
      <div className="face-scan-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <h2 className="modal-title">Find Your Collection</h2>
          <button className="modal-close-btn" onClick={handleClose} disabled={loading}>
            <X size={24} />
          </button>
        </div>

        {/* Content */}
        <div className="modal-content">
          {/* Mode Selection */}
          {mode === 'select' && (
            <div className="mode-selection">
              <p className="mode-selection-text">
                Choose how to scan your face
              </p>

              <div className="mode-buttons">
                <button
                  className="mode-btn camera-btn"
                  onClick={handleStartCamera}
                  disabled={loading}
                >
                  <Camera size={32} />
                  <span>Scan with Camera</span>
                </button>

                <button
                  className="mode-btn upload-btn"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={loading}
                >
                  <Upload size={32} />
                  <span>Upload Photo</span>
                </button>
              </div>

              <div className="tips-section">
                <p className="tips-title">Tips for best results:</p>
                <ul className="tips-list">
                  <li>Use a clear, front-facing photo</li>
                  <li>Ensure good lighting</li>
                  <li>Remove glasses if possible</li>
                  <li>Only one face in the photo</li>
                </ul>
              </div>

              {/* Hidden file input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handleFileUpload}
                style={{ display: 'none' }}
              />
            </div>
          )}

          {/* Camera Mode */}
          {mode === 'camera' && (
            <div className="camera-view">
              <div className="video-container">
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  className="video-feed"
                />
                <div className="face-guide-circle" />
              </div>

              <div className="camera-controls">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    stopCamera(cameraStream);
                    setCameraStream(null);
                    setIsVideoReady(false);
                    setMode('select');
                  }}
                  disabled={loading}
                >
                  Cancel
                </button>
                <button
                  className="btn-primary capture-btn"
                  onClick={handleCapturePhoto}
                  disabled={loading || !isVideoReady}
                >
                  {loading ? (
                    <>
                      <Loader size={20} className="spinner" />
                      <span>Processing...</span>
                    </>
                  ) : !isVideoReady ? (
                    <>
                      <Loader size={20} className="spinner" />
                      <span>Loading Camera...</span>
                    </>
                  ) : (
                    <>
                      <Camera size={20} />
                      <span>Capture Photo</span>
                    </>
                  )}
                </button>
              </div>

              <p className="camera-tip">
                {!isVideoReady ? 'Initializing camera...' : 'Position your face in the circle and capture'}
              </p>
            </div>
          )}

          {/* Loading State (when processing) */}
          {loading && mode === 'select' && (
            <div className="loading-state">
              <Loader size={48} className="spinner" />
              <p>Analyzing face...</p>
            </div>
          )}

          {/* Error Display */}
          {error && (
            <div className="error-message">
              <p>{error}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FaceScanModal;
