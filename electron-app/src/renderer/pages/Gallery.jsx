/**
 * Gallery Page - Simplified
 * Display uploaded images in a grid
 */

import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './Page.css';
import './Gallery.css';

function Gallery() {
  const [files, setFiles] = useState([]);
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0 });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const location = useLocation();

  // Refresh data whenever navigating to this page
  useEffect(() => {
    loadFiles();
    loadStats();
  }, [location]);

  const loadFiles = async () => {
    setLoading(true);
    try {
      const result = await window.electronAPI.gallery.getAllFiles({ limit: 1000 });
      if (result.success) {
        setFiles(result.files);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async () => {
    try {
      const result = await window.electronAPI.gallery.getStats();
      if (result.success) {
        setStats(result.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  };

  const handleSearch = async () => {
    if (!searchTerm) {
      loadFiles();
      return;
    }

    try {
      const result = await window.electronAPI.gallery.searchFiles(searchTerm);
      if (result.success) {
        setFiles(result.files);
      }
    } catch (error) {
      console.error('Search failed:', error);
    }
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.gallery.deleteFile(fileId);
      if (result.success) {
        // Reload files and stats after deletion
        await loadFiles();
        await loadStats();
      } else {
        alert('Failed to delete file: ' + result.error);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const handleClearAll = async () => {
    if (!window.confirm('Are you sure you want to delete ALL images? This cannot be undone!')) {
      return;
    }

    // Double confirmation for safety
    if (!window.confirm('This will permanently delete all images from your gallery. Are you absolutely sure?')) {
      return;
    }

    try {
      const result = await window.electronAPI.gallery.clearAll();
      if (result.success) {
        // Reload files and stats after clearing
        await loadFiles();
        await loadStats();
        alert(result.message);
      } else {
        alert('Failed to clear gallery: ' + result.error);
      }
    } catch (error) {
      console.error('Clear all failed:', error);
      alert('Failed to clear gallery');
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%' }}>
          <div>
            <h1>Gallery</h1>
            <p>View all uploaded images</p>
          </div>
          {files.length > 0 && (
            <button
              onClick={handleClearAll}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: '600'
              }}
              onMouseOver={(e) => e.target.style.backgroundColor = '#c82333'}
              onMouseOut={(e) => e.target.style.backgroundColor = '#dc3545'}
            >
              🗑️ Clear All
            </button>
          )}
        </div>
      </div>

      {/* Stats */}
      <div style={{
        display: 'flex',
        gap: '20px',
        marginBottom: '30px',
        flexWrap: 'wrap'
      }}>
        <div style={{
          flex: '1',
          minWidth: '200px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Total Files</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            {stats.totalFiles}
          </p>
        </div>

        <div style={{
          flex: '1',
          minWidth: '200px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Total Size</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            {formatFileSize(stats.totalSize)}
          </p>
        </div>

        <div style={{
          flex: '1',
          minWidth: '200px',
          padding: '20px',
          backgroundColor: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <h3 style={{ margin: '0 0 10px 0' }}>Today's Uploads</h3>
          <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0 }}>
            {stats.todayUploads || 0}
          </p>
        </div>
      </div>

      {/* Search */}
      <div style={{ marginBottom: '20px', display: 'flex', gap: '10px' }}>
        <input
          type="text"
          placeholder="Search by filename..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
          style={{
            flex: '1',
            padding: '10px',
            fontSize: '16px',
            border: '1px solid #ccc',
            borderRadius: '4px'
          }}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#007bff',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Search
        </button>
        <button
          onClick={loadFiles}
          style={{
            padding: '10px 20px',
            fontSize: '16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Clear
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '40px' }}>
          <p>Loading...</p>
        </div>
      )}

      {/* Gallery Grid */}
      {!loading && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '40px', color: '#666' }}>
          <p>No images found. Upload some images to get started!</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
          gap: '20px',
          marginTop: '20px'
        }}>
          {files.map((file) => {
            // Extract actual filename from filepath (e.g., "2026-01-29_9.jpeg" from full path)
            const actualFilename = file.filepath.split(/[/\\]/).pop();

            return (
              <div
                key={file.id}
                style={{
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  overflow: 'hidden',
                  backgroundColor: 'white',
                  position: 'relative'
                }}
              >
                <div style={{
                  width: '100%',
                  height: '200px',
                  backgroundColor: '#f0f0f0',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  overflow: 'hidden',
                  position: 'relative',
                  cursor: 'pointer'
                }}
                onClick={() => window.electronAPI.system.openFolder(file.filepath)}
                >
                  <img
                    src={`app://uploads/${actualFilename}`}
                    alt={file.filename}
                  style={{
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'cover'
                  }}
                  onError={(e) => {
                    e.target.style.display = 'none';
                    e.target.parentElement.innerHTML = '<div style="padding: 20px; text-align: center;">📷</div>';
                  }}
                />
                  {/* Delete button overlay */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(file.id, file.filename);
                    }}
                    style={{
                      position: 'absolute',
                      top: '8px',
                      right: '8px',
                      padding: '6px 12px',
                      backgroundColor: 'rgba(220, 53, 69, 0.9)',
                      color: 'white',
                      border: 'none',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '12px',
                      fontWeight: '600',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      zIndex: 10
                    }}
                    onMouseOver={(e) => e.target.style.backgroundColor = 'rgba(200, 35, 51, 1)'}
                    onMouseOut={(e) => e.target.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'}
                  >
                    🗑️
                  </button>
              </div>

              <div style={{ padding: '10px' }}>
                <p style={{
                  margin: '0 0 5px 0',
                  fontSize: '14px',
                  fontWeight: 'bold',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }} title={file.filename}>
                  {file.filename}
                </p>
                <p style={{ margin: '0', fontSize: '12px', color: '#666' }}>
                  {formatFileSize(file.file_size)}
                </p>
                <p style={{ margin: '5px 0 0 0', fontSize: '11px', color: '#999' }}>
                  {formatDate(file.upload_date)}
                </p>
              </div>
            </div>
          );
          })}
        </div>
      )}
    </div>
  );
}

export default Gallery;
