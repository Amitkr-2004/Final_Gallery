/**
 * Upload Modal Component
 * Allows users to select files or folders for upload
 */

import React, { useState } from 'react';
import Button from './Button';
import './Modal.css';
import './UploadModal.css';

const { electronAPI } = window;

function UploadModal({ onClose, onUpload }) {
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadOptions, setUploadOptions] = useState({
    eventId: 'default',
    userId: 'user1',
    date: new Date().toISOString().split('T')[0]
  });
  const [loading, setLoading] = useState(false);

  const handleSelectFiles = async () => {
    try {
      const result = await electronAPI.upload.selectFiles();

      if (!result.canceled && result.files.length > 0) {
        setSelectedFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to select files:', error);
    }
  };

  const handleSelectFolder = async () => {
    try {
      const result = await electronAPI.upload.selectFolder();

      if (!result.canceled && result.files.length > 0) {
        setSelectedFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to select folder:', error);
    }
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) {
      alert('Please select files or a folder first');
      return;
    }

    setLoading(true);

    try {
      await onUpload(selectedFiles, uploadOptions);
    } catch (error) {
      console.error('Upload failed:', error);
      alert(`Upload failed: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionChange = (key, value) => {
    setUploadOptions(prev => ({ ...prev, [key]: value }));
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content upload-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Upload Images</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {/* File Selection */}
          <div className="upload-selection">
            <div className="selection-buttons">
              <Button
                variant="primary"
                icon="📁"
                onClick={handleSelectFiles}
                fullWidth
              >
                Select Files
              </Button>
              <Button
                variant="secondary"
                icon="📂"
                onClick={handleSelectFolder}
                fullWidth
              >
                Select Folder
              </Button>
            </div>

            {/* Selected Files List */}
            {selectedFiles.length > 0 && (
              <div className="selected-files">
                <div className="selected-files-header">
                  <strong>{selectedFiles.length} files selected</strong>
                </div>
                <div className="selected-files-list">
                  {selectedFiles.slice(0, 10).map((file, index) => (
                    <div key={index} className="selected-file-item">
                      <span className="file-icon">🖼️</span>
                      <span className="file-name" title={file}>
                        {file.split(/[\\/]/).pop()}
                      </span>
                    </div>
                  ))}
                  {selectedFiles.length > 10 && (
                    <div className="selected-file-item more-files">
                      +{selectedFiles.length - 10} more files
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Upload Options */}
          <div className="upload-options">
            <h3>Upload Options</h3>

            <div className="form-group">
              <label htmlFor="eventId">Event ID</label>
              <input
                id="eventId"
                type="text"
                value={uploadOptions.eventId}
                onChange={(e) => handleOptionChange('eventId', e.target.value)}
                placeholder="e.g., wedding-2026, vacation-jan"
              />
            </div>

            <div className="form-group">
              <label htmlFor="userId">User ID</label>
              <input
                id="userId"
                type="text"
                value={uploadOptions.userId}
                onChange={(e) => handleOptionChange('userId', e.target.value)}
                placeholder="e.g., user1, john-doe"
              />
            </div>

            <div className="form-group">
              <label htmlFor="date">Date</label>
              <input
                id="date"
                type="date"
                value={uploadOptions.date}
                onChange={(e) => handleOptionChange('date', e.target.value)}
              />
            </div>

            <div className="upload-info">
              <p className="text-secondary text-sm">
                📍 GCS Path: uploads/{uploadOptions.eventId}/{uploadOptions.userId}/{uploadOptions.date}/
              </p>
              <p className="text-secondary text-sm">
                ⚙️ Images will be automatically processed after upload
              </p>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <Button variant="ghost" onClick={onClose} disabled={loading}>
            Cancel
          </Button>
          <Button
            variant="success"
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loading}
            loading={loading}
          >
            {loading ? 'Starting Upload...' : `Upload ${selectedFiles.length} Files`}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default UploadModal;
