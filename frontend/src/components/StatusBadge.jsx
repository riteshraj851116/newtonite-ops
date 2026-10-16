import React from 'react';

const StatusBadge = ({ status }) => {
  const normalized = (status || '').replace(/ /g, '_');

  const getStatusClass = (s) => {
    switch (s) {
      case 'Open':
        return 'badge-status-open';
      case 'In_Progress':
        return 'badge-status-in-progress';
      case 'Awaiting_Approval':
        return 'badge-status-awaiting';
      case 'Resolved':
        return 'badge-status-resolved';
      case 'Closed':
        return 'badge-status-closed';
      case 'Blocked':
        return 'badge-status-blocked';
      default:
        return 'badge-status-default';
    }
  };

  const getLabel = (s) => {
    switch (s) {
      case 'In_Progress':
        return 'In Progress';
      case 'Awaiting_Approval':
        return 'Awaiting Approval';
      default:
        return s || 'Unknown';
    }
  };

  return (
    <span className={`badge ${getStatusClass(normalized)}`}>
      {getLabel(normalized)}
    </span>
  );
};

export default StatusBadge;
