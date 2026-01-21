import React from 'react';
import Card from '../common/Card';
import './SummaryCard.css';

const SummaryCard = ({ icon: Icon, title, value, color = 'primary' }) => {
  return (
    <Card className={`summary-card summary-card-${color}`} hoverable>
      <div className="summary-card-content">
        <div className={`summary-card-icon-wrapper summary-icon-${color}`}>
          <Icon size={24} className="summary-card-icon" />
        </div>
        <div className="summary-card-info">
          <h3 className="summary-card-title">{title}</h3>
          <p className="summary-card-value">{value}</p>
        </div>
      </div>
    </Card>
  );
};

export default SummaryCard;
