import React from 'react';
import { UserCircle } from 'lucide-react';
import './EmptyCollectionState.css';

/**
 * EmptyCollectionState Component
 * Displays when no matching collection is found after face scan
 */
function EmptyCollectionState({ onTryAgain }) {
  return (
    <div className="empty-collection-state">
      <div className="empty-state-icon">
        <UserCircle size={80} strokeWidth={1.5} />
      </div>

      <h2 className="empty-state-title">No Collection Found</h2>

      <p className="empty-state-message">
        We couldn't find any photos matching your face.
        <br />
        Make sure your photos have been uploaded to an event gallery first.
      </p>

      <div className="empty-state-actions">
        <button
          className="btn-primary"
          onClick={onTryAgain}
        >
          Try Again
        </button>
      </div>
    </div>
  );
}

export default EmptyCollectionState;
