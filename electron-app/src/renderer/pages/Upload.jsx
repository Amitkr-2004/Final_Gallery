/**
 * Upload Page
 * Simple interface for uploading images
 */

import React, { useState } from 'react';
import './Page.css';

function Upload() {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [stats, setStats] = useState({ success: 0, failed: 0 });

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

  return (
    <div className="page">
      <div className="page-header">
        <h1>Upload Images</h1>
        <p>Select files or folders to upload to your local gallery</p>
      </div>

      <div className="page-content">
        <div
          className="upload-dropzone"
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          style={{
            border: '2px dashed #ccc',
            borderRadius: '8px',
            padding: '60px 40px',
            textAlign: 'center',
            marginBottom: '30px',
            backgroundColor: '#f9f9f9'
          }}
        >
          <div style={{ fontSize: '48px', marginBottom: '20px' }}>📁</div>
          <h2>Drag and drop images here</h2>
          <p style={{ color: '#666', margin: '10px 0 20px' }}>
            or choose files using the buttons below
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
