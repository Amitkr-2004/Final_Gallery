import React from 'react';
import { Outlet, useNavigate, useLocation, useParams } from 'react-router-dom';
import { Upload as UploadIcon, Image, Users, BarChart3, ArrowLeft } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import Button from '../common/Button';
import './EventGallery.css';

const EventGallery = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { eventId } = useParams();
  const { getEvent } = useEvents();

  const event = getEvent(eventId);

  if (!event) {
    return (
      <div className="event-gallery-container">
        <div className="event-not-found">
          <h2>Event Not Found</h2>
          <p>The event you're looking for doesn't exist.</p>
          <Button variant="primary" onClick={() => navigate('/events')}>
            Back to Events
          </Button>
        </div>
      </div>
    );
  }

  const tabs = [
    { path: 'upload', label: 'Upload', icon: UploadIcon },
    { path: 'photos', label: 'Photos', icon: Image },
    { path: 'collections', label: 'Collections', icon: Users },
    { path: 'stats', label: 'Statistics', icon: BarChart3 },
  ];

  const currentPath = location.pathname.split('/').pop();
  const isActive = (tabPath) => currentPath === tabPath;

  return (
    <div className="event-gallery-container">
      {/* Event Header */}
      <div className="event-gallery-header">
        <Button
          variant="ghost"
          size="small"
          icon={ArrowLeft}
          onClick={() => navigate('/events')}
          className="back-button"
        >
          Back
        </Button>

        <div className="event-info">
          <h1 className="event-name">{event.name}</h1>
          <div className="event-meta">
            <span className="event-type">{event.type}</span>
            <span className="event-date">
              {new Date(event.date).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <nav className="event-gallery-tabs">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.path);

          return (
            <button
              key={tab.path}
              className={`tab-button ${active ? 'active' : ''}`}
              onClick={() => navigate(`/events/${eventId}/gallery/${tab.path}`)}
            >
              <Icon size={18} className="tab-icon" />
              <span className="tab-label">{tab.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Gallery Content */}
      <div className="event-gallery-content">
        <Outlet />
      </div>
    </div>
  );
};

export default EventGallery;
