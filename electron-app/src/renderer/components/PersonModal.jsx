/**
 * Person Modal Component
 * Modal for creating or editing a person
 */

import React, { useState, useEffect } from 'react';
import Button from './Button';
import './PersonModal.css';

function PersonModal({ person, onSave, onClose }) {
  const [formData, setFormData] = useState({
    name: '',
    notes: ''
  });
  const [errors, setErrors] = useState({});

  useEffect(() => {
    if (person) {
      setFormData({
        name: person.name || '',
        notes: person.metadata?.notes || ''
      });
    }
  }, [person]);

  const validate = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validate()) {
      return;
    }

    const saveData = {
      name: formData.name.trim(),
      metadata: {
        notes: formData.notes.trim()
      }
    };

    onSave(saveData);
  };

  const handleChange = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{person ? 'Edit Person' : 'Create Person'}</h3>
          <button className="modal-close-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          <div className="form-group">
            <label className="form-label" htmlFor="person-name">
              Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="person-name"
              className={`form-input ${errors.name ? 'error' : ''}`}
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="Enter person name"
              autoFocus
            />
            {errors.name && (
              <div className="form-error">{errors.name}</div>
            )}
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="person-notes">
              Notes
            </label>
            <textarea
              id="person-notes"
              className="form-textarea"
              value={formData.notes}
              onChange={(e) => handleChange('notes', e.target.value)}
              placeholder="Add any notes about this person (optional)"
              rows={4}
            />
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
              type="submit"
              variant="primary"
            >
              {person ? 'Save Changes' : 'Create Person'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default PersonModal;
