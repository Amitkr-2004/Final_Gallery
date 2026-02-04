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
  Loader2,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight
} from 'lucide-react';
import './Page.css';
import './Gallery.css';

// Pagination configuration
const ITEMS_PER_PAGE = 20;

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
  const [clearing, setClearing] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [isSearchMode, setIsSearchMode] = useState(false);
  const location = useLocation();

  // Refresh data whenever navigating to this page
  useEffect(() => {
    loadStats();
  }, [location]);

  // Load files when page changes or on initial load
  useEffect(() => {
    if (!isSearchMode) {
      loadFiles(currentPage);
    }
  }, [currentPage, location]);

  const loadFiles = async (page = 1) => {
    setLoading(true);
    try {
      const offset = (page - 1) * ITEMS_PER_PAGE;
      console.log('📷 Loading gallery files...', { page, offset, limit: ITEMS_PER_PAGE });

      const result = await window.electronAPI.gallery.getAllFiles({
        limit: ITEMS_PER_PAGE,
        offset: offset
      });

      console.log('📷 Gallery result:', result);
      if (result.success) {
        console.log('📷 Files loaded:', result.files.length);
        setFiles(result.files);

        // Calculate total pages from stats
        const totalFiles = stats.totalFiles || 0;
        const pages = Math.ceil(totalFiles / ITEMS_PER_PAGE) || 1;
        setTotalPages(pages);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    } finally {
      setLoading(false);
    }
  };

  // Recalculate total pages when stats change
  useEffect(() => {
    if (!isSearchMode) {
      const pages = Math.ceil(stats.totalFiles / ITEMS_PER_PAGE) || 1;
      setTotalPages(pages);
    }
  }, [stats.totalFiles, isSearchMode]);

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
      handleResetSearch();
      return;
    }

    setLoading(true);
    setIsSearchMode(true);
    try {
      const result = await window.electronAPI.gallery.searchFiles(searchTerm);
      if (result.success) {
        setFiles(result.files);
        // In search mode, show all results on one page
        setTotalPages(1);
        setCurrentPage(1);
      }
    } catch (error) {
      console.error('Search failed:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleResetSearch = () => {
    setSearchTerm('');
    setIsSearchMode(false);
    setCurrentPage(1);
    loadFiles(1);
  };

  const handlePageChange = (newPage) => {
    if (newPage >= 1 && newPage <= totalPages && newPage !== currentPage) {
      setCurrentPage(newPage);
      // Scroll to top of gallery
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages = [];
    const maxVisiblePages = 5;

    if (totalPages <= maxVisiblePages) {
      // Show all pages if total is small
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
    } else {
      // Always show first page
      pages.push(1);

      // Calculate start and end of visible range
      let start = Math.max(2, currentPage - 1);
      let end = Math.min(totalPages - 1, currentPage + 1);

      // Adjust if at the beginning
      if (currentPage <= 3) {
        end = Math.min(4, totalPages - 1);
      }

      // Adjust if at the end
      if (currentPage >= totalPages - 2) {
        start = Math.max(2, totalPages - 3);
      }

      // Add ellipsis if needed before middle pages
      if (start > 2) {
        pages.push('...');
      }

      // Add middle pages
      for (let i = start; i <= end; i++) {
        pages.push(i);
      }

      // Add ellipsis if needed after middle pages
      if (end < totalPages - 1) {
        pages.push('...');
      }

      // Always show last page
      if (totalPages > 1) {
        pages.push(totalPages);
      }
    }

    return pages;
  };

  const handleDeleteFile = async (fileId, filename) => {
    if (!window.confirm(`Are you sure you want to delete "${filename}"?`)) {
      return;
    }

    try {
      const result = await window.electronAPI.gallery.deleteFile(fileId);
      if (result.success) {
        // Reload stats first to get correct total
        await loadStats();

        // Check if current page would be empty after deletion
        const newTotal = stats.totalFiles - 1;
        const newTotalPages = Math.ceil(newTotal / ITEMS_PER_PAGE) || 1;

        if (currentPage > newTotalPages) {
          setCurrentPage(newTotalPages);
        } else {
          // Reload current page
          await loadFiles(currentPage);
        }
      } else {
        alert('Failed to delete file: ' + result.error);
      }
    } catch (error) {
      console.error('Delete failed:', error);
      alert('Failed to delete file');
    }
  };

  const handleClearAll = async () => {
    // Prevent multiple clicks
    if (clearing) {
      return;
    }

    if (!window.confirm('Are you sure you want to delete ALL images? This cannot be undone!')) {
      return;
    }

    // Double confirmation for safety
    if (!window.confirm('This will permanently delete all images from your gallery. Are you absolutely sure?')) {
      return;
    }

    setClearing(true);
    try {
      const result = await window.electronAPI.gallery.clearAll();
      if (result.success) {
        // Reset to first page and reload
        setCurrentPage(1);
        setIsSearchMode(false);
        setSearchTerm('');
        await loadStats();
        await loadFiles(1);
        alert(`Gallery cleared!\n\nDeleted: ${result.deletedCount} files\nFailed: ${result.failedCount || 0} files`);
      } else {
        alert('Failed to clear gallery: ' + result.error);
      }
    } catch (error) {
      console.error('Clear all failed:', error);
      alert('Failed to clear gallery');
    } finally {
      setClearing(false);
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
              disabled={clearing}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                backgroundColor: clearing ? '#999' : '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: clearing ? 'not-allowed' : 'pointer',
                fontWeight: '600',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                opacity: clearing ? 0.7 : 1
              }}
              onMouseOver={(e) => !clearing && (e.currentTarget.style.backgroundColor = '#c82333')}
              onMouseOut={(e) => !clearing && (e.currentTarget.style.backgroundColor = '#dc3545')}
            >
              {clearing ? (
                <>
                  <RefreshCw size={16} style={{ animation: 'spin 1s linear infinite' }} /> Clearing...
                </>
              ) : (
                <>
                  <Trash2 size={16} /> Clear All
                </>
              )}
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
          onClick={handleResetSearch}
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
        <>
          {/* Page Info Header */}
          <div className="pagination-info">
            <span>
              {isSearchMode ? (
                `Found ${files.length} result${files.length !== 1 ? 's' : ''} for "${searchTerm}"`
              ) : (
                `Showing ${((currentPage - 1) * ITEMS_PER_PAGE) + 1}-${Math.min(currentPage * ITEMS_PER_PAGE, stats.totalFiles)} of ${stats.totalFiles} images`
              )}
            </span>
          </div>

          {/* Gallery Grid */}
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

          {/* Pagination Controls */}
          {!isSearchMode && totalPages > 1 && (
            <div className="pagination-container">
              <div className="pagination">
                {/* First Page Button */}
                <button
                  className="pagination-btn pagination-nav"
                  onClick={() => handlePageChange(1)}
                  disabled={currentPage === 1}
                  title="First Page"
                >
                  <ChevronsLeft size={18} />
                </button>

                {/* Previous Button */}
                <button
                  className="pagination-btn pagination-nav"
                  onClick={() => handlePageChange(currentPage - 1)}
                  disabled={currentPage === 1}
                  title="Previous Page"
                >
                  <ChevronLeft size={18} />
                </button>

                {/* Page Numbers */}
                <div className="pagination-pages">
                  {getPageNumbers().map((page, index) => (
                    page === '...' ? (
                      <span key={`ellipsis-${index}`} className="pagination-ellipsis">...</span>
                    ) : (
                      <button
                        key={page}
                        className={`pagination-btn pagination-number ${currentPage === page ? 'active' : ''}`}
                        onClick={() => handlePageChange(page)}
                      >
                        {page}
                      </button>
                    )
                  ))}
                </div>

                {/* Next Button */}
                <button
                  className="pagination-btn pagination-nav"
                  onClick={() => handlePageChange(currentPage + 1)}
                  disabled={currentPage === totalPages}
                  title="Next Page"
                >
                  <ChevronRight size={18} />
                </button>

                {/* Last Page Button */}
                <button
                  className="pagination-btn pagination-nav"
                  onClick={() => handlePageChange(totalPages)}
                  disabled={currentPage === totalPages}
                  title="Last Page"
                >
                  <ChevronsRight size={18} />
                </button>
              </div>

              <div className="pagination-jump">
                <span>Go to page:</span>
                <input
                  type="number"
                  min="1"
                  max={totalPages}
                  value={currentPage}
                  onChange={(e) => {
                    const page = parseInt(e.target.value, 10);
                    if (!isNaN(page)) {
                      handlePageChange(page);
                    }
                  }}
                  className="pagination-input"
                />
                <span>of {totalPages}</span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Gallery;
