import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Construction } from 'lucide-react';
import Button from './Button';
import Card from './Card';
import './PlaceholderPage.css';

const PlaceholderPage = ({ title, description }) => {
  const navigate = useNavigate();

  return (
    <div className="placeholder-page-container">
      <Card className="placeholder-card">
        <div className="placeholder-icon">
          <Construction size={64} />
        </div>
        <h1 className="placeholder-title">{title}</h1>
        <p className="placeholder-description">
          {description || 'This feature is coming soon. Stay tuned!'}
        </p>
        <Button
          variant="primary"
          size="medium"
          icon={ArrowLeft}
          onClick={() => navigate('/')}
        >
          Back to Home
        </Button>
      </Card>
    </div>
  );
};

export default PlaceholderPage;
