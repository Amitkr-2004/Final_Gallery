/**
 * Gallery Page - Simplified
 * Display uploaded images in a grid
 * Orchids International School Branding
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useLocation } from 'react-router-dom';
import {
  Images,
  HardDrive,
  Calendar,
  Search,
  RefreshCw,
  Trash2,
  Image as ImageIcon,
  Loader2
} from 'lucide-react';
import './Page.css';
import './Gallery.css';

// Image component that loads via IPC
function GalleryImage({ filepath, filename, onClick }) {
  const [imageSrc, setImageSrc] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let mounted = true;

    const loadImage = async () => {
      try {
        setLoading(true);
        setError(false);
        const result = await window.electronAPI.gallery.getImageData(filepath);
        if (mounted) {
          if (result.success) {
            setImageSrc(result.dataUrl);
          } else {
            setError(true);
          }
        }
      } catch (err) {
        console.error('Failed to load image:', filepath, err);
        if (mounted) {
          setError(true);
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    loadImage();
    return () => { mounted = false; };
  }, [filepath]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', backgroundColor: '#FFF8F5' }}>
        <Loader2 size={32} color="#800020" style={{ animation: 'spin 1s linear infinite' }} />
      </div>
    );
  }

  if (error || !imageSrc) {
    return (
      <div style={{ padding: '20px', textAlign: 'center', color: '#999', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: '#FFF8F5' }}>
        <ImageIcon size={48} color="#ccc" />
      </div>
    );
  }

  return (
    <img
      src={imageSrc}
      alt={filename}
      onClick={onClick}
      style={{
        maxWidth: '100%',
        maxHeight: '100%',
        objectFit: 'cover',
        width: '100%',
        height: '100%',
        cursor: 'pointer'
      }}
    />
  );
}

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
      console.log('📷 Loading gallery files...');
      const result = await window.electronAPI.gallery.getAllFiles({ limit: 1000 });
      console.log('📷 Gallery result:', result);
      if (result.success) {
        console.log('📷 Files loaded:', result.files.length);
        if (result.files.length > 0) {
          console.log('📷 First file:', result.files[0]);
          const actualFilename = result.files[0].filepath.split(/[/\\]/).pop();
          console.log('📷 First file actual filename:', actualFilename);
          console.log('📷 First file encoded URL:', `app://uploads/${encodeURIComponent(actualFilename)}`);
        }
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
            <h1 style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <ImageIcon size={32} color="#800020" />
              Gallery
            </h1>
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
                borderRadius: '8px',
                cursor: 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
              onMouseOver={(e) => e.currentTarget.style.backgroundColor = '#c82333'}
              onMouseOut={(e) => e.currentTarget.style.backgroundColor = '#dc3545'}
            >
              <Trash2 size={16} /> Clear All
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
          backgroundColor: '#FFF8F5',
          borderRadius: '12px',
          border: '1px solid #E8C4C4',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <Images size={40} color="#800020" />
          <div>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#800020' }}>
              {stats.totalFiles}
            </p>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Total Files</h3>
          </div>
        </div>

        <div style={{
          flex: '1',
          minWidth: '200px',
          padding: '20px',
          backgroundColor: '#FFF8F5',
          borderRadius: '12px',
          border: '1px solid #E8C4C4',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <HardDrive size={40} color="#800020" />
          <div>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#800020' }}>
              {formatFileSize(stats.totalSize)}
            </p>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Total Size</h3>
          </div>
        </div>

        <div style={{
          flex: '1',
          minWidth: '200px',
          padding: '20px',
          backgroundColor: '#FFF8F5',
          borderRadius: '12px',
          border: '1px solid #E8C4C4',
          display: 'flex',
          alignItems: 'center',
          gap: '15px'
        }}>
          <Calendar size={40} color="#800020" />
          <div>
            <p style={{ fontSize: '24px', fontWeight: 'bold', margin: 0, color: '#800020' }}>
              {stats.todayUploads || 0}
            </p>
            <h3 style={{ margin: 0, fontSize: '14px', color: '#666' }}>Today's Uploads</h3>
          </div>
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
            padding: '12px 16px',
            fontSize: '16px',
            border: '2px solid #E8C4C4',
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = '#800020'}
          onBlur={(e) => e.target.style.borderColor = '#E8C4C4'}
        />
        <button
          onClick={handleSearch}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#800020',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '500'
          }}
        >
          <Search size={18} /> Search
        </button>
        <button
          onClick={loadFiles}
          style={{
            padding: '12px 24px',
            fontSize: '16px',
            backgroundColor: '#6c757d',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            fontWeight: '500'
          }}
        >
          <RefreshCw size={18} /> Reset
        </button>
      </div>

      {/* Loading */}
      {loading && (
        <div style={{ textAlign: 'center', padding: '60px' }}>
          <RefreshCw size={48} color="#800020" style={{ animation: 'spin 1s linear infinite' }} />
          <p style={{ marginTop: '16px', color: '#666' }}>Loading images...</p>
        </div>
      )}

      {/* Gallery Grid */}
      {!loading && files.length === 0 && (
        <div style={{ textAlign: 'center', padding: '60px', color: '#666' }}>
          <ImageIcon size={64} color="#ccc" style={{ marginBottom: '16px' }} />
          <p style={{ fontSize: '18px' }}>No images found. Upload some images to get started!</p>
        </div>
      )}

      {!loading && files.length > 0 && (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: '20px',
          marginTop: '20px'
        }}>
          {files.map((file) => (
            <div
              key={file.id}
              style={{
                border: '1px solid #E8C4C4',
                borderRadius: '12px',
                overflow: 'hidden',
                backgroundColor: 'white',
                position: 'relative',
                boxShadow: '0 2px 8px rgba(128, 0, 32, 0.08)',
                transition: 'transform 0.2s, box-shadow 0.2s'
              }}
              onMouseOver={(e) => {
                e.currentTarget.style.transform = 'translateY(-4px)';
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(128, 0, 32, 0.15)';
              }}
              onMouseOut={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = '0 2px 8px rgba(128, 0, 32, 0.08)';
              }}
            >
              <div style={{
                width: '100%',
                height: '180px',
                backgroundColor: '#FFF8F5',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
                position: 'relative'
              }}>
                <GalleryImage
                  filepath={file.filepath}
                  filename={file.filename}
                  onClick={() => window.electronAPI.system.openFolder(file.filepath)}
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
                    padding: '8px',
                    backgroundColor: 'rgba(220, 53, 69, 0.9)',
                    color: 'white',
                    border: 'none',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 10,
                    transition: 'all 0.2s'
                  }}
                  onMouseOver={(e) => e.currentTarget.style.backgroundColor = 'rgba(200, 35, 51, 1)'}
                  onMouseOut={(e) => e.currentTarget.style.backgroundColor = 'rgba(220, 53, 69, 0.9)'}
                >
                  <Trash2 size={16} />
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
          ))}
        </div>
      )}
    </div>
  );
}

export default Gallery;
