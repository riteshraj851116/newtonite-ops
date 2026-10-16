import React from 'react';

const PriorityBadge = ({ priority }) => {
  const getPriorityClass = (p) => {
    switch (p) {
      case 'Urgent':
        return 'badge-priority-urgent';
      case 'High':
        return 'badge-priority-high';
      case 'Medium':
        return 'badge-priority-medium';
      case 'Low':
        return 'badge-priority-low';
      default:
        return 'badge-priority-default';
    }
  };

  return <span className={`badge ${getPriorityClass(priority)}`}>{priority}</span>;
};

export default PriorityBadge;
