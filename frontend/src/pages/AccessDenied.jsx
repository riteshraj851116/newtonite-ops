import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';

const AccessDenied = () => {
  return (
    <div className="error-page-container">
      <div className="error-card">
        <div className="error-icon-circle icon-danger">
          <ShieldAlert size={48} />
        </div>
        <h1 className="error-title">403 - Access Denied</h1>
        <p className="error-desc">
          You do not possess the required role or resource-level authorization to access this operational resource.
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

export default AccessDenied;
