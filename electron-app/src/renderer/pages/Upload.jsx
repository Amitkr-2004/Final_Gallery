/**
 * Upload Page
 * Simple interface for uploading images to local gallery and Django backend for face recognition
 */

import React, { useState, useRef } from 'react';
import './Page.css';

// Django backend API URL
const DJANGO_API_URL = 'http://localhost:8000';

function Upload() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ success: 0, failed: 0 });

  // Face Recognition Upload State
  const [faceUploading, setFaceUploading] = useState(false);
  const [faceMessage, setFaceMessage] = useState('');
  const [faceResult, setFaceResult] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [apiStatus, setApiStatus] = useState('checking');
  const fileInputRef = useRef(null);

  // Check Django API status on component mount
  React.useEffect(() => {
    checkApiStatus();
  }, []);

  const checkApiStatus = async () => {
    try {
      const response = await fetch(`${DJANGO_API_URL}/api/health/`);
      const data = await response.json();
      if (data.status === 'ok') {
        setApiStatus('connected');
      } else {
        setApiStatus('disconnected');
      }
    } catch (error) {
      setApiStatus('disconnected');
    }
  };

  // ============ Local Gallery Upload Functions ============
  const handleSelectFiles = async () => {
    try {
      const result = await window.electronAPI.upload.selectFiles();

      if (result.canceled) {
        return;
      }

      await uploadFiles(result.files);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await window.electronAPI.upload.selectFolder();

      if (result.canceled) {
        return;
      }

      await uploadFiles(result.files);
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  };

  const uploadFiles = async (files) => {
    if (files.length === 0) {
      setMessage('No files selected');
      return;
    }

    setUploading(true);
    setMessage(`Uploading ${files.length} files...`);

    try {
      const result = await window.electronAPI.upload.uploadFiles(files);

      if (result.success) {
        const { success, failed } = result.results;
        setStats({ success, failed });
        setMessage(`Upload complete! ${success} files uploaded successfully${failed > 0 ? `, ${failed} failed` : ''}.`);
      } else {
        setMessage(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      setMessage(`Upload error: ${error.message}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();

    const files = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      files.push(file.path);
    }

    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  // ============ Face Recognition Upload Functions ============
  const handleFaceFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPreviewUrl(URL.createObjectURL(file));
      setFaceResult(null);
      setFaceMessage('');
    }
  };

  const handleFaceUpload = async () => {
    const file = fileInputRef.current?.files[0];
    if (!file) {
      setFaceMessage('Please select a photo first');
      return;
    }

    setFaceUploading(true);
    setFaceMessage('Uploading and processing with InsightFace...');
    setFaceResult(null);

    const formData = new FormData();
    formData.append('image', file);

    try {
      const response = await fetch(`${DJANGO_API_URL}/api/upload/`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.photo_id) {
        setFaceResult({
          success: true,
          photoId: data.photo_id,
          facesDetected: data.faces_detected,
          facesProcessed: data.faces_processed,
          matchedPersons: data.matched_persons || []
        });
        setFaceMessage('');
      } else {
        setFaceResult({ success: false });
        setFaceMessage(data.error || data.message || 'Upload failed');
      }
    } catch (error) {
      setFaceResult({ success: false });
      setFaceMessage(`Connection error: ${error.message}. Make sure Django server is running.`);
    } finally {
      setFaceUploading(false);
    }
  };

  const clearFaceUpload = () => {
    setPreviewUrl(null);
    setFaceResult(null);
    setFaceMessage('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>Upload Images</h1>
        <p>Upload to local gallery or add faces for recognition</p>
      </div>

      <div className="page-content">
        {/* ============ Face Recognition Upload Section ============ */}
        <div style={{
          border: '2px solid #800020',
          borderRadius: '12px',
          padding: '30px',
          marginBottom: '30px',
          background: 'linear-gradient(135deg, #FFF8F5 0%, #fff 100%)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
            <div>
              <h2 style={{ color: '#800020', margin: 0 }}>Upload for Face Recognition</h2>
              <p style={{ color: '#666', margin: '5px 0 0' }}>
                Add your photo to the face recognition database (InsightFace + FAISS)
              </p>
            </div>
            <div style={{
              padding: '8px 16px',
              borderRadius: '20px',
              fontSize: '14px',
              fontWeight: 'bold',
              backgroundColor: apiStatus === 'connected' ? '#c6f6d5' : apiStatus === 'checking' ? '#fef3c7' : '#fed7d7',
              color: apiStatus === 'connected' ? '#22543d' : apiStatus === 'checking' ? '#92400e' : '#742a2a'
            }}>
              {apiStatus === 'connected' ? '✓ API Connected' : apiStatus === 'checking' ? '⏳ Checking...' : '✗ API Offline'}
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: previewUrl ? '1fr 1fr' : '1fr',
            gap: '20px',
            alignItems: 'start'
          }}>
            {/* Upload Area */}
            <div>
              <input
                type="file"
                ref={fileInputRef}
                accept="image/*"
                onChange={handleFaceFileSelect}
                style={{ display: 'none' }}
                id="face-file-input"
              />
              <label
                htmlFor="face-file-input"
                style={{
                  display: 'block',
                  border: '2px dashed #800020',
                  borderRadius: '8px',
                  padding: '40px 20px',
                  textAlign: 'center',
                  cursor: 'pointer',
                  backgroundColor: '#fff',
                  transition: 'all 0.3s'
                }}
              >
                <div style={{ fontSize: '40px', marginBottom: '10px' }}>📷</div>
                <p style={{ color: '#800020', fontWeight: 'bold', margin: 0 }}>
                  Click to select your photo
                </p>
                <p style={{ color: '#999', fontSize: '14px', margin: '5px 0 0' }}>
                  JPG, PNG - Clear front-facing photo works best
                </p>
              </label>

              <div style={{ display: 'flex', gap: '10px', marginTop: '15px' }}>
                <button
                  onClick={handleFaceUpload}
                  disabled={!previewUrl || faceUploading || apiStatus !== 'connected'}
                  style={{
                    flex: 1,
                    padding: '12px 24px',
                    fontSize: '16px',
                    cursor: (!previewUrl || faceUploading || apiStatus !== 'connected') ? 'not-allowed' : 'pointer',
                    backgroundColor: '#800020',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    opacity: (!previewUrl || faceUploading || apiStatus !== 'connected') ? 0.5 : 1
                  }}
                >
                  {faceUploading ? '⏳ Processing...' : '🚀 Upload & Process'}
                </button>
                {previewUrl && (
                  <button
                    onClick={clearFaceUpload}
                    style={{
                      padding: '12px 20px',
                      fontSize: '16px',
                      cursor: 'pointer',
                      backgroundColor: '#e2e8f0',
                      color: '#4a5568',
                      border: 'none',
                      borderRadius: '6px'
                    }}
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* Preview & Result */}
            {previewUrl && (
              <div style={{ textAlign: 'center' }}>
                <img
                  src={previewUrl}
                  alt="Preview"
                  style={{
                    maxWidth: '100%',
                    maxHeight: '200px',
                    borderRadius: '10px',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.15)'
                  }}
                />
              </div>
            )}
          </div>

          {/* Face Upload Message */}
          {faceMessage && (
            <div style={{
              marginTop: '15px',
              padding: '12px 16px',
              borderRadius: '6px',
              backgroundColor: faceResult?.success === false ? '#fed7d7' : '#e9ecef',
              color: faceResult?.success === false ? '#742a2a' : '#495057'
            }}>
              {faceMessage}
            </div>
          )}

          {/* Face Upload Result */}
          {faceResult?.success && (
            <div style={{
              marginTop: '15px',
              padding: '20px',
              borderRadius: '8px',
              backgroundColor: '#c6f6d5',
              color: '#22543d'
            }}>
              <h3 style={{ margin: '0 0 10px' }}>✅ Upload Successful!</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '15px', marginTop: '15px' }}>
                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{faceResult.photoId}</div>
                  <div style={{ fontSize: '12px', color: '#276749' }}>Photo ID</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{faceResult.facesDetected}</div>
                  <div style={{ fontSize: '12px', color: '#276749' }}>Faces Detected</div>
                </div>
                <div style={{ textAlign: 'center', padding: '10px', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '6px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold' }}>{faceResult.matchedPersons.length}</div>
                  <div style={{ fontSize: '12px', color: '#276749' }}>Persons Matched</div>
                </div>
              </div>
              {faceResult.matchedPersons.length > 0 && (
                <div style={{ marginTop: '15px', fontSize: '14px' }}>
                  <strong>Matched Collections: </strong>
                  {faceResult.matchedPersons.map((p, i) => (
                    <span key={i} style={{
                      display: 'inline-block',
                      padding: '4px 10px',
                      backgroundColor: p.is_new ? '#800020' : '#228B22',
                      color: 'white',
                      borderRadius: '12px',
                      margin: '2px 4px',
                      fontSize: '12px'
                    }}>
                      Person #{p.person_number} {p.is_new ? '(New)' : '(Existing)'}
                    </span>
                  ))}
                </div>
              )}
              <p style={{ marginTop: '15px', fontSize: '14px', opacity: 0.8 }}>
                🎯 Your face has been added to the database. You can now use the Camera Scanner to find your photos!
              </p>
            </div>
          )}
        </div>

        {/* ============ Local Gallery Upload Section ============ */}
        <div style={{
          border: '2px dashed #ccc',
          borderRadius: '8px',
          padding: '40px',
          textAlign: 'center',
          marginBottom: '30px',
          backgroundColor: '#f9f9f9'
        }}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
          <h2>Upload to Local Gallery</h2>
          <p style={{ color: '#666', margin: '10px 0 20px' }}>
            Drag and drop images or choose files using the buttons below
          </p>

          <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '20px' }}>
            <button
              onClick={handleSelectFiles}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                backgroundColor: '#007bff',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Select Files
            </button>

            <button
              onClick={handleSelectFolder}
              disabled={uploading}
              style={{
                padding: '12px 24px',
                fontSize: '16px',
                cursor: uploading ? 'not-allowed' : 'pointer',
                backgroundColor: '#28a745',
                color: 'white',
                border: 'none',
                borderRadius: '4px'
              }}
            >
              Select Folder
            </button>
          </div>
        </div>

        {message && (
          <div style={{
            padding: '15px',
            borderRadius: '4px',
            backgroundColor: stats.success > 0 ? '#d4edda' : '#f8d7da',
            color: stats.success > 0 ? '#155724' : '#721c24',
            marginBottom: '20px'
          }}>
            {message}
          </div>
        )}

        {uploading && (
          <div style={{ textAlign: 'center', padding: '20px' }}>
            <div style={{
              width: '40px',
              height: '40px',
              border: '4px solid #f3f3f3',
              borderTop: '4px solid #007bff',
              borderRadius: '50%',
              animation: 'spin 1s linear infinite',
              margin: '0 auto'
            }}></div>
            <p style={{ marginTop: '10px' }}>Uploading...</p>
          </div>
        )}

        <div style={{
          marginTop: '30px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h3 style={{ marginBottom: '10px' }}>Supported Formats</h3>
          <p style={{ color: '#666' }}>
            JPG, JPEG, PNG, GIF, BMP, WEBP
          </p>
        </div>
      </div>

      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
}

export default Upload;
