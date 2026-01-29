/**
 * Status Card Component
 * Displays a stat with icon, label, and value
 */

import React from 'react';
import './StatusCard.css';

function StatusCard({
  icon,
  label,
  value,
  subtitle = null,
  trend = null,
  trendDirection = null, // 'up' | 'down'
  color = 'primary',
  loading = false,
  onClick = null
}) {
  const classes = [
    'status-card',
    `status-card-${color}`,
    onClick && 'status-card-clickable',
    loading && 'status-card-loading'
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      <div className="status-card-icon">
        {icon}
      </div>

      <div className="status-card-content">
        <div className="status-card-label">{label}</div>

        {loading ? (
          <div className="status-card-skeleton" />
        ) : (
          <>
            <div className="status-card-value">{value}</div>

            {subtitle && (
              <div className="status-card-subtitle">{subtitle}</div>
            )}

            {trend && (
              <div className={`status-card-trend trend-${trendDirection}`}>
                {trendDirection === 'up' && '↑'}
                {trendDirection === 'down' && '↓'}
                {trend}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default StatusCard;
