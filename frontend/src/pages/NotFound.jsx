import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

const NotFound = () => {
  return (
    <div className="error-page-container">
      <div className="error-card">
        <div className="error-icon-circle icon-info">
          <FileQuestion size={48} />
        </div>
        <h1 className="error-title">404 - Page Not Found</h1>
        <p className="error-desc">
          The requested operational resource or endpoint could not be found.
        </p>
        <div className="error-actions">
          <Link to="/" className="btn btn-primary">
            <ArrowLeft size={16} /> Return to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};

export default NotFound;
