import React, { useState, useEffect } from 'react';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { Clock, CheckCircle, XCircle, Loader, AlertCircle } from 'lucide-react';
import styles from './TimeScheduler.module.css';

const API_BASE = 'http://localhost:8000/api';

const TimeScheduler = () => {
  // State management
  const [jobData, setJobData] = useState(null);
  const [scheduledTime, setScheduledTime] = useState(new Date());
  const [folderPath, setFolderPath] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [polling, setPolling] = useState(false);

  // Fetch current job on mount
  useEffect(() => {
    fetchCurrentJob();
  }, []);

  // Poll for status when job is pending or running
  useEffect(() => {
    let interval;
    if (jobData && (jobData.status === 'pending' || jobData.status === 'running')) {
      if (!polling) {
        setPolling(true);
      }
      interval = setInterval(() => {
        fetchCurrentJob();
      }, 5000); // Poll every 5 seconds
    } else {
      setPolling(false);
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [jobData, polling]);

  const fetchCurrentJob = async () => {
    try {
      const response = await fetch(`${API_BASE}/scheduler/job/`);
      if (response.ok) {
        const data = await response.json();
        setJobData(data);

        // If job data exists, populate form
        if (data) {
          setScheduledTime(new Date(data.scheduled_time));
          setFolderPath(data.folder_path);
        }

        // Stop polling if job is no longer running
        if (data && data.status !== 'running') {
          setPolling(false);
        }
      } else {
        console.error('Failed to fetch job data');
      }
    } catch (err) {
      console.error('Error fetching job:', err);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    // Validation
    if (!folderPath.trim()) {
      setError('Please provide a local folder path');
      return;
    }

    // Backend will validate the scheduled time - we just do a basic check
    if (!scheduledTime || isNaN(scheduledTime.getTime())) {
      setError('Please select a valid date and time');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/scheduler/job/`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          scheduled_time: scheduledTime.toISOString(),
          folder_path: folderPath,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        setJobData(data);
        setSuccess('Job scheduled successfully! Waiting for execution...');
        setTimeout(() => setSuccess(null), 5000);
      } else {
        const errorData = await response.json();
        // Handle validation errors from backend
        if (errorData.scheduled_time) {
          setError(`Scheduled Time: ${errorData.scheduled_time[0]}`);
        } else if (errorData.folder_path) {
          setError(`Folder Path: ${errorData.folder_path[0]}`);
        } else {
          setError(errorData.error || JSON.stringify(errorData) || 'Failed to schedule job');
        }
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error scheduling job:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCancelJob = async () => {
    if (!window.confirm('Are you sure you want to cancel this job?')) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`${API_BASE}/scheduler/job/`, {
        method: 'DELETE',
      });

      if (response.ok) {
        setJobData(null);
        setFolderPath('');
        setSuccess('Job cancelled successfully');
        setTimeout(() => setSuccess(null), 3000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to cancel job');
      }
    } catch (err) {
      setError('Network error. Please try again.');
      console.error('Error cancelling job:', err);
    } finally {
      setLoading(false);
    }
  };

  const StatusBadge = ({ status }) => {
    const statusConfig = {
      pending: { color: '#3b82f6', text: 'Pending', icon: Clock },
      running: { color: '#f59e0b', text: 'Running', icon: Loader },
      completed: { color: '#10b981', text: 'Completed', icon: CheckCircle },
      failed: { color: '#ef4444', text: 'Failed', icon: XCircle },
    };

    const config = statusConfig[status] || statusConfig.pending;
    const Icon = config.icon;

    return (
      <div className={styles.statusBadge} style={{ backgroundColor: `${config.color}20`, color: config.color }}>
        <Icon size={16} className={status === 'running' ? styles.spinning : ''} />
        <span>{config.text}</span>
      </div>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <Clock size={32} />
        <h1>Time Scheduler</h1>
        <p>Schedule automated image processing from local folder</p>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className={styles.alert} style={{ backgroundColor: '#fee2e2', color: '#991b1b' }}>
          <AlertCircle size={20} />
          <span>{error}</span>
        </div>
      )}

      {success && (
        <div className={styles.alert} style={{ backgroundColor: '#d1fae5', color: '#065f46' }}>
          <CheckCircle size={20} />
          <span>{success}</span>
        </div>
      )}

      {/* Schedule Form */}
      <div className={styles.card}>
        <h2>Schedule a Job</h2>
        <form onSubmit={handleSaveSchedule}>
          <div className={styles.formGroup}>
            <label>Date & Time</label>
            <DatePicker
              selected={scheduledTime}
              onChange={(date) => setScheduledTime(date)}
              showTimeSelect
              timeFormat="HH:mm"
              timeIntervals={15}
              dateFormat="MMMM d, yyyy h:mm aa"
              minDate={new Date()}
              className={styles.datePicker}
              disabled={jobData && jobData.status === 'running'}
            />
          </div>

          <div className={styles.formGroup}>
            <label>Local Folder Path</label>
            <input
              type="text"
              value={folderPath}
              onChange={(e) => setFolderPath(e.target.value)}
              placeholder="D:\Images\Students or /home/user/photos/students"
              className={styles.input}
              disabled={jobData && jobData.status === 'running'}
            />
            <small className={styles.hint}>
              Provide the absolute path to the folder containing images. Subdirectories will be scanned recursively.
            </small>
            {jobData && jobData.folder_path && (
              <small className={styles.currentPath}>
                💾 Current path: {jobData.folder_path}
              </small>
            )}
          </div>

          <button
            type="submit"
            className={styles.btnPrimary}
            disabled={loading || (jobData && jobData.status === 'running')}
          >
            {loading ? 'Saving...' : 'Save Schedule'}
          </button>
        </form>
      </div>

      {/* Current Job Status */}
      {jobData && (
        <div className={styles.card}>
          <h2>Current Job</h2>

          <div className={styles.jobInfo}>
            <div className={styles.jobRow}>
              <span className={styles.label}>Status:</span>
              <StatusBadge status={jobData.status} />
            </div>

            <div className={styles.jobRow}>
              <span className={styles.label}>Scheduled:</span>
              <span>{new Date(jobData.scheduled_time).toLocaleString()}</span>
            </div>

            <div className={styles.jobRow}>
              <span className={styles.label}>Folder Path:</span>
              <span className={styles.folderPath}>{jobData.folder_path}</span>
            </div>

            {jobData.status === 'running' && (
              <div className={styles.progress}>
                <div className={styles.jobRow}>
                  <span className={styles.label}>Images Processed:</span>
                  <span className={styles.highlight}>{jobData.images_processed}</span>
                </div>
              </div>
            )}

            {jobData.status === 'completed' && (
              <div className={styles.results}>
                <h3>✓ Job Completed Successfully</h3>
                <div className={styles.statsGrid}>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Event ID</span>
                    <span className={styles.statValue}>{jobData.event_id || 'N/A'}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Images Processed</span>
                    <span className={styles.statValue}>{jobData.images_processed}</span>
                  </div>
                  <div className={styles.statItem}>
                    <span className={styles.statLabel}>Completed At</span>
                    <span className={styles.statValue}>
                      {new Date(jobData.completed_at).toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {jobData.status === 'failed' && jobData.error_log && (
              <div className={styles.errorLog}>
                <h3>Error Details</h3>
                <pre className={styles.errorText}>{jobData.error_log}</pre>
              </div>
            )}

            {jobData.status === 'pending' && (
              <>
                <div className={styles.pendingInfo}>
                  <p style={{ margin: '1rem 0', color: '#6b7280', fontSize: '0.9rem' }}>
                    ⏳ Waiting for scheduled time. Job will start automatically when the time arrives.
                    <br />
                    <strong>Make sure Celery Beat is running!</strong> (See setup guide)
                  </p>
                </div>
                <button
                  onClick={handleCancelJob}
                  className={styles.btnDanger}
                  disabled={loading}
                >
                  Cancel Job
                </button>
              </>
            )}
          </div>
        </div>
      )}

      {/* Instructions */}
      <div className={styles.card} style={{ backgroundColor: '#f0f9ff' }}>
        <h3>Setup Instructions</h3>
        <ol className={styles.instructions}>
          <li>Prepare a folder on your local system containing images (e.g., D:\Images\Students)</li>
          <li>The folder can contain subdirectories - all images will be scanned recursively</li>
          <li>Copy the absolute path to the folder</li>
          <li>Paste the folder path above and select a scheduled time</li>
          <li>Click "Save Schedule" - the job will run automatically at the scheduled time</li>
          <li>Make sure the backend server can access the folder path</li>
        </ol>
      </div>
    </div>
  );
};

export default TimeScheduler;
