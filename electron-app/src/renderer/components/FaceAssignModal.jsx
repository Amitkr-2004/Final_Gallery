/**
 * Face Assign Modal Component
 * Modal for assigning a face to a person
 */

import React, { useState } from 'react';
import Button from './Button';
import './PersonModal.css'; // Reuse modal styles
import './FaceAssignModal.css';

function FaceAssignModal({ face, persons, onAssign, onClose, onCreatePerson }) {
  const [selectedPersonId, setSelectedPersonId] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPersons = persons.filter(person =>
    person.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleAssign = () => {
    if (!selectedPersonId) {
      return;
    }
    onAssign(face.id, parseInt(selectedPersonId));
  };

  const handleCreateAndAssign = () => {
    onClose();
    onCreatePerson();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content face-assign-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>Assign Face to Person</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {/* Face Preview */}
          <div className="face-preview-section">
            {face.thumbnail_path ? (
              <img
                src={`file://${face.thumbnail_path}`}
                alt="Face"
                className="face-preview-image"
              />
            ) : (
              <div className="face-preview-placeholder">👤</div>
            )}
            <div className="face-preview-info">
              {face.age && (
                <div>{face.age} years old, {face.gender}</div>
              )}
              <div className="text-secondary">
                {Math.round(face.confidence * 100)}% confidence
              </div>
            </div>
          </div>

          {/* Search */}
          <div className="form-group">
            <label className="form-label">Search Persons</label>
            <input
              type="text"
              className="form-input"
              placeholder="Search by name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Person List */}
          <div className="form-group">
            <label className="form-label">
              Select Person {selectedPersonId && '✓'}
            </label>
            <div className="person-select-list">
              {filteredPersons.length === 0 ? (
                <div className="empty-message">
                  {searchTerm ? 'No persons found' : 'No persons available'}
                </div>
              ) : (
                filteredPersons.map(person => (
                  <div
                    key={person.id}
                    className={`person-select-item ${selectedPersonId == person.id ? 'selected' : ''}`}
                    onClick={() => setSelectedPersonId(person.id.toString())}
                  >
                    <div className="person-select-avatar">👤</div>
                    <div className="person-select-info">
                      <div className="person-select-name">{person.name}</div>
                      <div className="person-select-count text-secondary">
                        {person.face_count || 0} faces
                      </div>
                    </div>
                    {selectedPersonId == person.id && (
                      <div className="person-select-check">✓</div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Create New Person Option */}
          <div className="create-person-option">
            <span className="text-secondary">Person not in list?</span>
            <Button
              variant="text"
              size="sm"
              onClick={handleCreateAndAssign}
            >
              Create New Person
            </Button>
          </div>

          <div className="modal-footer">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="primary"
              onClick={handleAssign}
              disabled={!selectedPersonId}
            >
              Assign to Person
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default FaceAssignModal;
