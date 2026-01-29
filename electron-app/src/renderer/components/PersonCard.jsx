/**
 * Person Card Component
 * Display a person with their face count and action buttons
 */

import React from 'react';
import Button from './Button';
import './PersonCard.css';

function PersonCard({ person, onEdit, onDelete }) {
  return (
    <div className="person-card">
      <div className="person-card-header">
        <div className="person-avatar-large">
          <span>👤</span>
        </div>
        <div className="person-card-info">
          <h4 className="person-card-name">{person.name}</h4>
          <div className="person-card-stats">
            <span className="stat-badge">{person.face_count || 0} faces</span>
            {person.last_seen && (
              <span className="stat-text text-secondary">
                Last seen {new Date(person.last_seen * 1000).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>

      {person.metadata?.notes && (
        <div className="person-card-notes">
          {person.metadata.notes}
        </div>
      )}

      <div className="person-card-actions">
        <Button
          variant="ghost"
          size="sm"
          icon="✏️"
          onClick={onEdit}
          fullWidth
        >
          Edit
        </Button>
        <Button
          variant="error"
          size="sm"
          icon="🗑️"
          onClick={onDelete}
          fullWidth
        >
          Delete
        </Button>
      </div>
    </div>
  );
}

export default PersonCard;
