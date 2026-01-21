import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import EventCard from './EventCard';
import Button from '../common/Button';
import './EventsList.css';

const EventsList = () => {
  const navigate = useNavigate();
  const { events, deleteEvent } = useEvents();

  const sortedEvents = [...events].sort((a, b) =>
    new Date(b.createdAt) - new Date(a.createdAt)
  );

  return (
    <div className="events-list-container">
      {/* Header */}
      <div className="events-list-header">
        <div>
          <h1 className="page-title">My Events</h1>
          <p className="page-subtitle">
            {events.length} {events.length === 1 ? 'event' : 'events'} created
          </p>
        </div>
        <Button
          variant="primary"
          size="medium"
          icon={Plus}
          onClick={() => navigate('/create-event')}
        >
          Create Event
        </Button>
      </div>

      {/* Events Grid */}
      {events.length > 0 ? (
        <div className="events-grid">
          {sortedEvents.map(event => (
            <EventCard
              key={event.id}
              event={event}
              onDelete={deleteEvent}
            />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="events-empty-state">
          <div className="empty-state-icon">📁</div>
          <h3 className="empty-state-title">No Events Yet</h3>
          <p className="empty-state-description">
            Create your first event to start organizing your photos
          </p>
          <Button
            variant="primary"
            size="large"
            icon={Plus}
            onClick={() => navigate('/create-event')}
          >
            Create Your First Event
          </Button>
        </div>
      )}
    </div>
  );
};

export default EventsList;
