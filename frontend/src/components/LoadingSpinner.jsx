import React from 'react';
import { Loader2 } from 'lucide-react';

export const LoadingSpinner = ({ text = 'Loading data...', size = 32 }) => {
  return (
    <div className="loading-state-container">
      <Loader2 size={size} className="spinner-animate" />
      {text && <p className="loading-state-text">{text}</p>}
    </div>
  );
};

export const EmptyState = ({
  icon,
  title = 'No items found',
  description = 'Try adjusting your search filters or create a new item.',
  action,
}) => {
  return (
    <div className="empty-state-card">
      {icon && <div className="empty-state-icon">{icon}</div>}
      <h3 className="empty-state-title">{title}</h3>
      <p className="empty-state-desc">{description}</p>
      {action && <div className="empty-state-action">{action}</div>}
    </div>
  );
};
