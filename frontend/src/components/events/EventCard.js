import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Calendar, Tag, Image, Trash2 } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import Card from '../common/Card';
import Button from '../common/Button';
import './EventCard.css';

const EventCard = ({ event, onDelete }) => {
  const navigate = useNavigate();
  const { getEventPhotoCount } = useEvents();

  const handleCardClick = () => {
    navigate(`/events/${event.id}/gallery/upload`);
  };

  const handleDelete = (e) => {
    e.stopPropagation();
    const confirmed = window.confirm(
      `Are you sure you want to delete "${event.name}"? This action cannot be undone.`
    );
    if (confirmed) {
      onDelete(event.id);
    }
  };

  const formatDate = (dateString) => {
    const options = { year: 'numeric', month: 'short', day: 'numeric' };
    return new Date(dateString).toLocaleDateString('en-US', options);
  };

  return (
    <Card className="event-card" hoverable onClick={handleCardClick}>
      <div className="event-card-header">
        <div className="event-card-icon">
          <Image size={24} />
        </div>
        <button
          className="event-card-delete"
          onClick={handleDelete}
          aria-label="Delete event"
        >
          <Trash2 size={18} />
        </button>
      </div>

      <div className="event-card-body">
        <h3 className="event-card-title">{event.name}</h3>

        <div className="event-card-meta">
          <div className="event-meta-item">
            <Calendar size={14} />
            <span>{formatDate(event.date)}</span>
          </div>

          <div className="event-meta-item">
            <Tag size={14} />
            <span>{event.type}</span>
          </div>
        </div>

        <div className="event-card-stats">
          <div className="event-stat">
            <span className="stat-value">{getEventPhotoCount(event.id)}</span>
            <span className="stat-label">Images</span>
          </div>
        </div>
      </div>

      <div className="event-card-footer">
        <Button
          variant="ghost"
          size="small"
          onClick={handleCardClick}
          className="event-card-action"
        >
          Open Gallery
        </Button>
      </div>
    </Card>
  );
};

export default EventCard;
