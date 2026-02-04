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
  Camera,
  Ban
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

    // Set up upload progress listener
    const removeProgressListener = window.electronAPI.upload.onProgress((progress) => {
      console.log('📤 Upload progress:', progress);
      setUploadProgress({
        total: progress.total,
        current: progress.current,
        success: progress.success,
        failed: progress.failed,
        skipped: progress.skipped || 0,
        cancelled: progress.cancelled || 0,
        currentFile: progress.currentFile,
        complete: progress.status === 'cancelled'
      });
    });

    // Cleanup listener on unmount
    return () => {
      if (removeProgressListener) {
        removeProgressListener();
      }
    };
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
        const { success, failed, skipped, cancelled } = result.results;
        setUploadProgress({
          total: files.length,
          current: files.length - (cancelled || 0),
          success,
          failed,
          skipped: skipped || 0,
          cancelled: cancelled || 0,
          complete: true
        });

        // Reload stats after upload
        await loadStats();

        // Navigate to gallery after short delay if there are successful uploads and not cancelled
        if (success > 0 && !cancelled) {
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

  const handleCancelUpload = async () => {
    try {
      await window.electronAPI.upload.cancel();
      console.log('Upload cancellation requested');
    } catch (error) {
      console.error('Failed to cancel upload:', error);
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
              {/* Circular Progress */}
              <div className="circular-progress-wrapper">
                <div className="circular-progress">
                  <svg className="progress-ring" viewBox="0 0 120 120">
                    <circle
                      className="progress-ring-bg"
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      strokeWidth="8"
                    />
                    <circle
                      className="progress-ring-fill"
                      cx="60"
                      cy="60"
                      r="52"
                      fill="none"
                      strokeWidth="8"
                      strokeLinecap="round"
                      style={{
                        strokeDasharray: `${2 * Math.PI * 52}`,
                        strokeDashoffset: `${2 * Math.PI * 52 * (1 - (uploadProgress?.total > 0 ? uploadProgress.current / uploadProgress.total : 0))}`,
                        stroke: uploadProgress?.complete
                          ? uploadProgress.cancelled > 0 ? '#ef4444'
                            : uploadProgress.failed > 0 ? '#f59e0b'
                            : '#22c55e'
                          : '#ffffff'
                      }}
                    />
                  </svg>
                  <div className="progress-center">
                    {uploadProgress?.complete ? (
                      uploadProgress.cancelled > 0 ? (
                        <Ban size={36} color="#ef4444" />
                      ) : uploadProgress.failed === 0 ? (
                        uploadProgress.success === 0 ? (
                          <AlertCircle size={36} color="#f59e0b" />
                        ) : (
                          <CheckCircle size={36} color="#22c55e" />
                        )
                      ) : (
                        <AlertCircle size={36} color="#f59e0b" />
                      )
                    ) : (
                      <span className="progress-percentage">
                        {uploadProgress?.total > 0 ? Math.round((uploadProgress.current / uploadProgress.total) * 100) : 0}%
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Status Title */}
              <h3 className="upload-status-title">
                {uploadProgress?.complete
                  ? uploadProgress.cancelled > 0
                    ? 'Upload Cancelled'
                    : uploadProgress.failed === 0
                      ? uploadProgress.success === 0
                        ? 'All Images Already Exist'
                        : 'Upload Complete!'
                      : 'Completed with Errors'
                  : 'Uploading Photos'
                }
              </h3>

              {/* File Counter */}
              {uploadProgress && !uploadProgress.complete && (
                <p className="upload-file-counter">
                  {uploadProgress.current} of {uploadProgress.total} files
                </p>
              )}

              {/* Current File Name */}
              {uploadProgress && !uploadProgress.complete && uploadProgress.currentFile && (
                <p className="upload-current-file">
                  {uploadProgress.currentFile.split('/').pop().split('\\').pop()}
                </p>
              )}

              {/* Stats Grid */}
              {uploadProgress && (
                <div className="upload-stats-grid">
                  <div className="upload-stat-item success">
                    <CheckCircle size={18} />
                    <span className="stat-number">{uploadProgress.success}</span>
                    <span className="stat-text">Uploaded</span>
                  </div>
                  {uploadProgress.skipped > 0 && (
                    <div className="upload-stat-item skipped">
                      <SkipForward size={18} />
                      <span className="stat-number">{uploadProgress.skipped}</span>
                      <span className="stat-text">Skipped</span>
                    </div>
                  )}
                  {uploadProgress.failed > 0 && (
                    <div className="upload-stat-item failed">
                      <XCircle size={18} />
                      <span className="stat-number">{uploadProgress.failed}</span>
                      <span className="stat-text">Failed</span>
                    </div>
                  )}
                  {uploadProgress.cancelled > 0 && (
                    <div className="upload-stat-item cancelled">
                      <Ban size={18} />
                      <span className="stat-number">{uploadProgress.cancelled}</span>
                      <span className="stat-text">Cancelled</span>
                    </div>
                  )}
                </div>
              )}

              {/* Cancel Button */}
              {uploadProgress && !uploadProgress.complete && (
                <button className="cancel-upload-btn" onClick={handleCancelUpload}>
                  <XCircle size={18} />
                  Cancel
                </button>
              )}

              {/* Redirect Message */}
              {uploadProgress?.complete && uploadProgress.cancelled === 0 && uploadProgress.failed === 0 && uploadProgress.success > 0 && (
                <p className="upload-redirect-message">
                  Opening gallery...
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
