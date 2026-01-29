/**
 * Card Component
 * Container for content sections
 */

import React from 'react';
import './Card.css';

function Card({
  children,
  title = null,
  subtitle = null,
  footer = null,
  padding = 'md',
  className = '',
  hoverable = false,
  onClick = null
}) {
  const classes = [
    'card',
    `card-padding-${padding}`,
    hoverable && 'card-hoverable',
    onClick && 'card-clickable',
    className
  ].filter(Boolean).join(' ');

  return (
    <div className={classes} onClick={onClick}>
      {(title || subtitle) && (
        <div className="card-header">
          {title && <h3 className="card-title">{title}</h3>}
          {subtitle && <p className="card-subtitle">{subtitle}</p>}
        </div>
      )}

      <div className="card-body">
        {children}
      </div>

      {footer && (
        <div className="card-footer">
          {footer}
        </div>
      )}
    </div>
  );
}

export default Card;
