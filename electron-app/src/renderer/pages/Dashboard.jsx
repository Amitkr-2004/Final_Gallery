/**
 * Dashboard Page
 * Main entry point with upload functionality and stats
 * Orchids International School Branding
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Upload,
  FolderOpen,
  Image,
  HardDrive,
  Calendar,
  CheckCircle,
  AlertCircle,
  Loader2,
  Images,
  FolderUp,
  SkipForward,
  XCircle,
  BarChart3,
  Camera
} from 'lucide-react';
import './Dashboard.css';
import './Page.css';

function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalFiles: 0, totalSize: 0, todayUploads: 0 });
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    loadStats();
  }, []);

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

  const handleUploadFiles = async () => {
    console.log('Upload Files button clicked');
    try {
      console.log('Calling selectFiles...');
      const result = await window.electronAPI.upload.selectFiles();
      console.log('selectFiles result:', result);

      if (result.canceled) {
        console.log('User canceled file selection');
        return;
      }

      console.log('Files selected:', result.files);
      await uploadFiles(result.files);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const handleUploadFolder = async () => {
    try {
      const result = await window.electronAPI.upload.selectFolder();

      if (result.canceled) {
        return;
      }

      await uploadFiles(result.files);
    } catch (error) {
      console.error('Upload error:', error);
    }
  };

  const uploadFiles = async (files) => {
    if (files.length === 0) {
      return;
    }

    setUploading(true);
    setUploadProgress({ total: files.length, current: 0, success: 0, failed: 0 });

    try {
      const result = await window.electronAPI.upload.uploadFiles(files);

      if (result.success) {
        const { success, failed, skipped } = result.results;
        setUploadProgress({
          total: files.length,
          current: files.length,
          success,
          failed,
          skipped: skipped || 0,
          complete: true
        });

        // Reload stats after upload
        await loadStats();

        // Navigate to gallery after short delay if there are successful uploads
        if (success > 0) {
          setTimeout(() => {
            navigate('/gallery');
          }, 1500);
        }
      }
    } catch (error) {
      console.error('Upload error:', error);
      setUploadProgress({
        total: files.length,
        current: 0,
        success: 0,
        failed: files.length,
        complete: true,
        error: error.message
      });
    } finally {
      setTimeout(() => {
        setUploading(false);
        setUploadProgress(null);
      }, 2000);
    }
  };

  const handleDragEnter = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    const files = [];
    for (let i = 0; i < e.dataTransfer.files.length; i++) {
      const file = e.dataTransfer.files[i];
      // Check if it's an image
      if (file.type.startsWith('image/')) {
        files.push(file.path);
      }
    }

    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    return (bytes / (1024 * 1024 * 1024)).toFixed(2) + ' GB';
  };

  return (
    <div className="dashboard">
      {/* Header */}
      <div className="dashboard-header">
        <h1 className="dashboard-title">
          <Camera size={40} style={{ marginRight: '12px', verticalAlign: 'middle' }} />
          Orchids Gallery
        </h1>
        <p className="dashboard-subtitle">Upload and manage your school event photos</p>
      </div>

      {/* Main Upload Area */}
      <div className="dashboard-content">
        <div
          className={`upload-card ${dragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
        >
          {!uploading ? (
            <>
              <div className="upload-icon">
                {dragActive ? <FolderOpen size={80} /> : <Upload size={80} />}
              </div>

              <h2 className="upload-title">
                {dragActive ? 'Drop images here' : 'Upload Images'}
              </h2>

              <p className="upload-description">
                {dragActive
                  ? 'Release to upload'
                  : 'Drag and drop images here, or use the buttons below'
                }
              </p>

              <div className="upload-buttons">
                <button
                  className="btn btn-primary btn-large"
                  onClick={handleUploadFiles}
                >
                  <span className="btn-icon"><Images size={20} /></span>
                  Upload Files
                </button>

                <button
                  className="btn btn-secondary btn-large"
                  onClick={handleUploadFolder}
                >
                  <span className="btn-icon"><FolderUp size={20} /></span>
                  Upload Folder
                </button>
              </div>

              <p className="upload-formats">
                Supported formats: JPG, PNG, GIF, BMP, WEBP
              </p>
            </>
          ) : (
            <div className="upload-progress-container">
              <div className="upload-progress-icon">
                {uploadProgress?.complete ? (
                  uploadProgress.failed === 0 ? (
                    uploadProgress.success === 0 ? (
                      <AlertCircle size={60} style={{ color: '#DAA520' }} />
                    ) : (
                      <CheckCircle size={60} style={{ color: '#228B22' }} />
                    )
                  ) : (
                    <AlertCircle size={60} style={{ color: '#f59e0b' }} />
                  )
                ) : (
                  <Loader2 size={60} className="spin-animation" />
                )}
              </div>

              <h3 className="upload-progress-title">
                {uploadProgress?.complete
                  ? uploadProgress.failed === 0
                    ? uploadProgress.success === 0
                      ? 'All Images Already Exist'
                      : 'Upload Complete!'
                    : 'Upload Completed with Errors'
                  : 'Uploading...'
                }
              </h3>

              {uploadProgress && (
                <div className="upload-progress-stats">
                  <p><CheckCircle size={16} style={{ marginRight: '8px', color: '#228B22' }} /> Success: {uploadProgress.success}</p>
                  {uploadProgress.skipped > 0 && <p><SkipForward size={16} style={{ marginRight: '8px', color: '#DAA520' }} /> Skipped (Duplicates): {uploadProgress.skipped}</p>}
                  {uploadProgress.failed > 0 && <p><XCircle size={16} style={{ marginRight: '8px', color: '#ef4444' }} /> Failed: {uploadProgress.failed}</p>}
                  <p><BarChart3 size={16} style={{ marginRight: '8px', color: '#800020' }} /> Total: {uploadProgress.total}</p>
                </div>
              )}

              {uploadProgress?.complete && uploadProgress.failed === 0 && (
                <p className="upload-redirect-message">
                  Redirecting to gallery...
                </p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Stats Section */}
      <div className="dashboard-stats">
        <div className="stat-card">
          <div className="stat-icon"><Images size={48} color="#800020" /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.totalFiles}</div>
            <div className="stat-label">Total Images</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><HardDrive size={48} color="#800020" /></div>
          <div className="stat-content">
            <div className="stat-value">{formatFileSize(stats.totalSize)}</div>
            <div className="stat-label">Storage Used</div>
          </div>
        </div>

        <div className="stat-card">
          <div className="stat-icon"><Calendar size={48} color="#800020" /></div>
          <div className="stat-content">
            <div className="stat-value">{stats.todayUploads || 0}</div>
            <div className="stat-label">Today's Uploads</div>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="dashboard-actions">
        <button
          className="btn btn-outline"
          onClick={() => navigate('/gallery')}
        >
          <span className="btn-icon"><Image size={20} /></span>
          View Gallery
        </button>
      </div>
    </div>
  );
}

export default Dashboard;
