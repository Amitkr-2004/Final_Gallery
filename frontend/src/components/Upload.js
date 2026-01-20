import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import './Upload.css';

function Upload() {
  const navigate = useNavigate();
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState(null);
  const [error, setError] = useState(null);
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);

  const handleFileSelect = (files, mode = 'files') => {
    if (!files || files.length === 0) return;

    // Filter valid image files
    const validImageTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const imageFiles = Array.from(files).filter(file => {
      const isImage = file.type.startsWith('image/') || validImageTypes.includes(file.type);
      const hasValidExtension = /\.(jpg|jpeg|png|webp)$/i.test(file.name);
      return isImage || hasValidExtension;
    });

    if (imageFiles.length === 0) {
      setError('No valid image files found. Supported formats: JPG, PNG, WEBP');
      return;
    }

    // Create file objects with previews
    const filesWithPreviews = imageFiles.map((file, index) => ({
      id: `${Date.now()}-${index}`,
      file,
      name: file.name,
      size: file.size,
      preview: null,
      status: 'pending'
    }));

    // Generate previews
    filesWithPreviews.forEach(fileObj => {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedFiles(prev =>
          prev.map(f => f.id === fileObj.id ? { ...f, preview: reader.result } : f)
        );
      };
      reader.readAsDataURL(fileObj.file);
    });

    setSelectedFiles(filesWithPreviews);
    setError(null);
    setUploadResult(null);
  };

  const handleFilesInputChange = (e) => {
    handleFileSelect(e.target.files, 'files');
  };

  const handleFolderInputChange = (e) => {
    handleFileSelect(e.target.files, 'folder');
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();

    const items = e.dataTransfer.items;
    const files = e.dataTransfer.files;

    if (items && items.length > 0) {
      const fileList = [];
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') {
          const file = items[i].getAsFile();
          if (file) fileList.push(file);
        }
      }
      handleFileSelect(fileList, 'files');
    } else {
      handleFileSelect(files, 'files');
    }
  };

  const handleUpload = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      setError('Please select files first');
      return;
    }

    setUploading(true);
    setError(null);
    setUploadResult(null);

    const results = {
      total: selectedFiles.length,
      success: 0,
      failed: 0,
      results: [],
      errors: []
    };

    try {
      // Process files one by one to track individual progress
      for (let i = 0; i < selectedFiles.length; i++) {
        const fileObj = selectedFiles[i];

        try {
          // Update file status
          setSelectedFiles(prev =>
            prev.map(f => f.id === fileObj.id ? { ...f, status: 'uploading' } : f)
          );

          const formData = new FormData();
          formData.append('image', fileObj.file);

          const response = await fetch('/api/upload/', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) {
            // Read response as text first (body can only be read once)
            const errorText = await response.text();
            let errorData;
            try {
              // Try to parse as JSON
              errorData = JSON.parse(errorText);
              console.error('Error response:', errorData);
              console.error('Error details:', errorData.details || errorData.traceback || 'No details available');
            } catch (e) {
              // If not JSON, use text directly
              console.error('Error response body (not JSON):', errorText);
              throw new Error(`HTTP error! status: ${response.status}, body: ${errorText}`);
            }
            throw new Error(errorData.error || errorData.details || `HTTP error! status: ${response.status}`);
          }

          const data = await response.json();

          // Update file status
          setSelectedFiles(prev =>
            prev.map(f => f.id === fileObj.id ? { ...f, status: 'success' } : f)
          );

          results.success++;
          results.results.push({
            filename: fileObj.name,
            ...data
          });

        } catch (err) {
          console.error(`Error uploading ${fileObj.name}:`, err);

          // Update file status
          setSelectedFiles(prev =>
            prev.map(f => f.id === fileObj.id ? { ...f, status: 'error' } : f)
          );

          results.failed++;
          results.errors.push({
            filename: fileObj.name,
            error: err.message
          });
        }
      }

      setUploadResult(results);

    } catch (err) {
      setError(err.message);
      console.error('Upload error:', err);
    } finally {
      setUploading(false);
    }
  };

  const handleReset = () => {
    setSelectedFiles([]);
    setError(null);
    setUploadResult(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (folderInputRef.current) folderInputRef.current.value = '';
  };

  const handleViewPhotos = () => {
    navigate('/');
  };

  const removeFile = (fileId) => {
    setSelectedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'uploading':
        return '⏳';
      case 'success':
        return '✓';
      case 'error':
        return '✗';
      default:
        return '';
    }
  };

  return (
    <div className="upload-container">
      <header className="upload-header">
        <h1>Upload Images</h1>
        <p>Upload multiple images or an entire folder to create or update collections</p>
      </header>

      <div className="upload-section">
        <div className="upload-mode-buttons">
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary mode-btn"
          >
            Select Files
          </button>
          <button
            onClick={() => folderInputRef.current?.click()}
            disabled={uploading}
            className="btn-secondary mode-btn"
          >
            Select Folder
          </button>
        </div>

        <div
          className="upload-area"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp"
            onChange={handleFilesInputChange}
            className="file-input"
            disabled={uploading}
            multiple
            style={{ display: 'none' }}
          />
          <input
            ref={folderInputRef}
            type="file"
            accept="image/*,.jpg,.jpeg,.png,.webp"
            onChange={handleFolderInputChange}
            className="file-input"
            disabled={uploading}
            webkitdirectory="true"
            directory="true"
            multiple
            style={{ display: 'none' }}
          />

          {selectedFiles.length === 0 ? (
            <div className="upload-placeholder">
              <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                <polyline points="17 8 12 3 7 8"></polyline>
                <line x1="12" y1="3" x2="12" y2="15"></line>
              </svg>
              <p>Drag and drop images or folders here</p>
              <p className="upload-hint">or use the buttons above</p>
              <p className="upload-hint">Supports: JPG, PNG, WEBP</p>
            </div>
          ) : (
            <div className="preview-grid-container">
              <div className="preview-header">
                <h3>{selectedFiles.length} file{selectedFiles.length > 1 ? 's' : ''} selected</h3>
                {!uploading && (
                  <button onClick={handleReset} className="btn-link">
                    Clear All
                  </button>
                )}
              </div>
              <div className="preview-grid">
                {selectedFiles.map((fileObj) => (
                  <div key={fileObj.id} className={`preview-item ${fileObj.status}`}>
                    {fileObj.preview && (
                      <img src={fileObj.preview} alt={fileObj.name} className="preview-thumb" />
                    )}
                    <div className="preview-info">
                      <p className="preview-name" title={fileObj.name}>{fileObj.name}</p>
                      <p className="preview-size">{formatFileSize(fileObj.size)}</p>
                      <div className="preview-status">
                        {fileObj.status !== 'pending' && (
                          <span className={`status-badge ${fileObj.status}`}>
                            {getStatusIcon(fileObj.status)} {fileObj.status}
                          </span>
                        )}
                      </div>
                    </div>
                    {!uploading && fileObj.status === 'pending' && (
                      <button
                        onClick={() => removeFile(fileObj.id)}
                        className="remove-file-btn"
                        title="Remove"
                      >
                        ×
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="error-message">
            <strong>Error:</strong> {error}
          </div>
        )}

        {uploading && (
          <div className="upload-progress-section">
            <div className="global-progress">
              <p>Uploading {selectedFiles.filter(f => f.status === 'uploading').length} of {selectedFiles.length} files...</p>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${(selectedFiles.filter(f => f.status === 'success').length / selectedFiles.length) * 100}%`
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {uploadResult && (
          <div className="success-message">
            <h3>Upload Complete!</h3>
            <div className="upload-summary">
              <div className="summary-stats">
                <div className="stat">
                  <span className="stat-value">{uploadResult.total}</span>
                  <span className="stat-label">Total</span>
                </div>
                <div className="stat success">
                  <span className="stat-value">{uploadResult.success}</span>
                  <span className="stat-label">Success</span>
                </div>
                {uploadResult.failed > 0 && (
                  <div className="stat error">
                    <span className="stat-value">{uploadResult.failed}</span>
                    <span className="stat-label">Failed</span>
                  </div>
                )}
              </div>

              {uploadResult.results.length > 0 && (
                <div className="upload-details">
                  <h4>Successfully Uploaded:</h4>
                  <div className="results-list">
                    {uploadResult.results.slice(0, 5).map((result, index) => (
                      <div key={index} className="result-item">
                        <strong>{result.filename}</strong>
                        <p>Faces detected: {result.faces_detected || 0}</p>
                        {result.matched_persons && result.matched_persons.length > 0 && (
                          <p className="persons-list">
                            Matched: {result.matched_persons.map(p =>
                              `Person ${p.person_number}${p.is_new ? ' (New)' : ''}`
                            ).join(', ')}
                          </p>
                        )}
                      </div>
                    ))}
                    {uploadResult.results.length > 5 && (
                      <p className="more-results">...and {uploadResult.results.length - 5} more</p>
                    )}
                  </div>
                </div>
              )}

              {uploadResult.errors.length > 0 && (
                <div className="upload-errors">
                  <h4>Errors:</h4>
                  <ul>
                    {uploadResult.errors.map((error, index) => (
                      <li key={index}>
                        <strong>{error.filename}:</strong> {error.error}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
            <div className="action-buttons">
              <button onClick={handleReset} className="btn-secondary">
                Upload More
              </button>
              <button onClick={handleViewPhotos} className="btn-primary">
                View All Photos
              </button>
            </div>
          </div>
        )}

        <div className="upload-actions">
          {selectedFiles.length > 0 && !uploadResult && (
            <>
              <button
                onClick={handleUpload}
                disabled={uploading}
                className="btn-primary upload-btn"
              >
                {uploading ? `Uploading... (${selectedFiles.filter(f => f.status === 'success').length}/${selectedFiles.length})` : `Upload ${selectedFiles.length} Image${selectedFiles.length > 1 ? 's' : ''}`}
              </button>
              {!uploading && (
                <button
                  onClick={handleReset}
                  className="btn-secondary"
                >
                  Cancel
                </button>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

export default Upload;
