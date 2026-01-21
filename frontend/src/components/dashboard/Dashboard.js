import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FolderOpen, Image, Users } from 'lucide-react';
import { useEvents } from '../../hooks/useEvents';
import SummaryCard from './SummaryCard';
import Button from '../common/Button';
import './Dashboard.css';

const Dashboard = () => {
  const navigate = useNavigate();
  const { events } = useEvents();

  const getCurrentGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  };

  const getCurrentDate = () => {
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    return new Date().toLocaleDateString('en-US', options);
  };

  // Calculate total images across all events (placeholder for now)
  const totalImages = events.reduce((sum, event) => sum + (event.imageCount || 0), 0);
  const totalPersons = 0; // Placeholder

  return (
    <div className="dashboard-container">
      {/* Greeting Section */}
      <div className="dashboard-header">
        <div className="greeting-section">
          <h1 className="greeting-title">{getCurrentGreeting()}! 👋</h1>
          <p className="greeting-subtitle">{getCurrentDate()}</p>
          <p className="greeting-message">
            Ready to organize and share your memories? Let's get started!
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="summary-cards-grid">
        <SummaryCard
          icon={FolderOpen}
          title="Total Events"
          value={events.length}
          color="primary"
        />
        <SummaryCard
          icon={Image}
          title="Total Images"
          value={totalImages}
          color="secondary"
        />
        <SummaryCard
          icon={Users}
          title="Total Persons"
          value={totalPersons}
          color="success"
        />
      </div>

      {/* Quick Actions */}
      <div className="quick-actions-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="quick-actions-grid">
          <Button
            variant="primary"
            size="large"
            onClick={() => navigate('/create-event')}
            className="action-button-primary"
          >
            Create New Event
          </Button>
          <Button
            variant="secondary"
            size="large"
            onClick={() => navigate('/events')}
            className="action-button-secondary"
          >
            Browse My Events
          </Button>
        </div>
      </div>

      {/* Recent Events Section */}
      {events.length > 0 && (
        <div className="recent-events-section">
          <div className="section-header">
            <h2 className="section-title">Recent Events</h2>
            <Button
              variant="ghost"
              size="small"
              onClick={() => navigate('/events')}
            >
              View All
            </Button>
          </div>
          <div className="recent-events-list">
            {events.slice(-3).reverse().map((event) => (
              <div
                key={event.id}
                className="recent-event-card"
                onClick={() => navigate(`/events/${event.id}/gallery/upload`)}
              >
                <div className="recent-event-icon">
                  <FolderOpen size={24} />
                </div>
                <div className="recent-event-info">
                  <h3 className="recent-event-name">{event.name}</h3>
                  <p className="recent-event-meta">
                    {event.type} • {new Date(event.date).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {events.length === 0 && (
        <div className="empty-state">
          <div className="empty-state-icon">📁</div>
          <h3 className="empty-state-title">No Events Yet</h3>
          <p className="empty-state-description">
            Create your first event to start organizing your photos
          </p>
          <Button
            variant="primary"
            size="medium"
            onClick={() => navigate('/create-event')}
          >
            Create Your First Event
          </Button>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
