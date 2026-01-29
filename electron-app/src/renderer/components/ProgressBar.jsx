/**
 * Progress Bar Component
 * Shows progress with percentage and optional label
 */

import React from 'react';
import './ProgressBar.css';

function ProgressBar({
  progress = 0,
  total = 100,
  label = null,
  showPercentage = true,
  size = 'md',
  color = 'primary',
  animated = false,
  className = ''
}) {
  const percentage = total > 0 ? Math.min((progress / total) * 100, 100) : 0;
  const displayPercentage = Math.round(percentage);

  const classes = [
    'progress-bar',
    `progress-bar-${size}`,
    `progress-bar-${color}`,
    animated && 'progress-bar-animated',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes}>
      {(label || showPercentage) && (
        <div className="progress-bar-header">
          {label && <span className="progress-bar-label">{label}</span>}
          {showPercentage && (
            <span className="progress-bar-percentage">{displayPercentage}%</span>
          )}
        </div>
      )}

      <div className="progress-bar-track">
        <div
          className="progress-bar-fill"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export default ProgressBar;
