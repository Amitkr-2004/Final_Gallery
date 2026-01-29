/**
 * Upload Progress Component
 * Displays real-time upload progress for multiple files
 */

import React from 'react';
import Button from './Button';
import ProgressBar from './ProgressBar';
import Card from './Card';
import './UploadProgress.css';

function UploadProgress({ progress, onCancel }) {
  const formatSpeed = (bps) => {
    if (!bps || bps === 0) return '0 B/s';
    const k = 1024;
    const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];
    const i = Math.floor(Math.log(bps) / Math.log(k));
    return Math.round(bps / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const formatFileSize = (bytes) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  // Calculate overall progress
  const totalLoaded = progress.reduce((sum, p) => sum + (p.loaded || 0), 0);
  const totalSize = progress.reduce((sum, p) => sum + (p.total || 0), 0);
  const overallProgress = totalSize > 0 ? Math.round((totalLoaded / totalSize) * 100) : 0;

  // Calculate average speed
  const avgSpeed = progress.reduce((sum, p) => sum + (p.speed || 0), 0) / (progress.length || 1);

  return (
    <div className="upload-progress-overlay">
      <Card className="upload-progress-card" padding="md">
        <div className="upload-progress-header">
          <h3>Uploading Files</h3>
          <Button
            variant="error"
            size="sm"
            icon="✕"
            onClick={onCancel}
          >
            Cancel
          </Button>
        </div>

        {/* Overall Progress */}
        <div className="upload-overall">
          <div className="upload-stats">
            <span className="stat-item">
              <strong>{overallProgress}%</strong> Complete
            </span>
            <span className="stat-item">
              {progress.length} files
            </span>
            <span className="stat-item">
              {formatSpeed(avgSpeed)}
            </span>
          </div>

          <ProgressBar
            progress={overallProgress}
            total={100}
            animated
            color="primary"
          />
        </div>

        {/* Individual File Progress */}
        <div className="upload-files-list">
          {progress.map((file, index) => (
            <div key={file.uploadId || index} className="upload-file-item">
              <div className="file-info">
                <span className="file-icon">📁</span>
                <div className="file-details">
                  <span className="file-name" title={file.filename}>
                    {file.filename}
                  </span>
                  <span className="file-meta text-sm text-secondary">
                    {formatFileSize(file.loaded)} / {formatFileSize(file.total)}
                    {' • '}
                    {formatSpeed(file.speed)}
                  </span>
                </div>
              </div>

              <div className="file-progress">
                <ProgressBar
                  progress={file.progress || 0}
                  total={100}
                  size="sm"
                  animated
                  color="success"
                  showPercentage={true}
                />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

export default UploadProgress;
