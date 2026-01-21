import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Tag, ChevronDown, ChevronUp } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import Button from '../common/Button';
import Card from '../common/Card';
import './CreateEvent.css';

const CreateEvent = () => {
  const navigate = useNavigate();
  const { createEvent } = useEvents();

  const [formData, setFormData] = useState({
    name: '',
    date: new Date().toISOString().split('T')[0],
    type: 'Fest',
    branding: false,
    reels: false,
  });

  const [errors, setErrors] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);

  const eventTypes = [
    'Fest',
    'Annual Day',
    'Seminar',
    'Workshop',
    'Convocation',
    'Cultural Event',
    'Sports Event',
    'Conference',
    'Other',
  ];

  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));

    // Clear error for this field
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};

    if (!formData.name.trim()) {
      newErrors.name = 'Event name is required';
    }

    if (!formData.date) {
      newErrors.date = 'Event date is required';
    }

    if (!formData.type) {
      newErrors.type = 'Event type is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    // Create the event
    const newEvent = createEvent(formData);

    // Navigate to the event gallery
    navigate(`/events/${newEvent.id}/gallery/upload`);
  };

  return (
    <div className="create-event-container">
      <div className="create-event-header">
        <h1 className="page-title">Create New Event</h1>
        <p className="page-subtitle">
          Set up a new event to organize and manage your photos
        </p>
      </div>

      <Card className="create-event-card">
        <form onSubmit={handleSubmit} className="event-form">
          {/* Event Name */}
          <div className="form-group">
            <label htmlFor="name" className="form-label">
              Event Name <span className="required">*</span>
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              className={`form-input ${errors.name ? 'input-error' : ''}`}
              placeholder="e.g., Annual Day 2026"
            />
            {errors.name && <p className="error-message">{errors.name}</p>}
          </div>

          {/* Event Date */}
          <div className="form-group">
            <label htmlFor="date" className="form-label">
              Event Date <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <Calendar size={18} className="input-icon" />
              <input
                type="date"
                id="date"
                name="date"
                value={formData.date}
                onChange={handleInputChange}
                className={`form-input input-with-icon-field ${errors.date ? 'input-error' : ''}`}
              />
            </div>
            {errors.date && <p className="error-message">{errors.date}</p>}
          </div>

          {/* Event Type */}
          <div className="form-group">
            <label htmlFor="type" className="form-label">
              Event Type <span className="required">*</span>
            </label>
            <div className="input-with-icon">
              <Tag size={18} className="input-icon" />
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleInputChange}
                className={`form-select input-with-icon-field ${errors.type ? 'input-error' : ''}`}
              >
                {eventTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>
            {errors.type && <p className="error-message">{errors.type}</p>}
          </div>

          {/* Optional Toggles */}
          <div className="form-group">
            <label className="form-label">Optional Features (UI Only)</label>
            <div className="toggles-group">
              <label className="toggle-item">
                <input
                  type="checkbox"
                  name="branding"
                  checked={formData.branding}
                  onChange={handleInputChange}
                  className="toggle-checkbox"
                />
                <span className="toggle-label">Add Branding</span>
                <span className="toggle-description">Add watermark to photos</span>
              </label>

              <label className="toggle-item">
                <input
                  type="checkbox"
                  name="reels"
                  checked={formData.reels}
                  onChange={handleInputChange}
                  className="toggle-checkbox"
                />
                <span className="toggle-label">Generate Reels</span>
                <span className="toggle-description">Create highlight reels automatically</span>
              </label>
            </div>
          </div>

          {/* Advanced Settings (Collapsible) */}
          <div className="form-group">
            <button
              type="button"
              className="advanced-toggle"
              onClick={() => setShowAdvanced(!showAdvanced)}
            >
              <span>Advanced Settings</span>
              {showAdvanced ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </button>

            {showAdvanced && (
              <div className="advanced-content">
                <p className="placeholder-text">
                  Advanced options coming soon...
                </p>
              </div>
            )}
          </div>

          {/* Submit Button */}
          <div className="form-actions">
            <Button
              type="button"
              variant="secondary"
              size="large"
              onClick={() => navigate('/')}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="large"
            >
              Create Event
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
};

export default CreateEvent;
