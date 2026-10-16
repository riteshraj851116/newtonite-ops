import React from 'react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';

const ConflictModal = ({
  isOpen,
  conflictData,
  onResolveReload,
  onClose,
}) => {
  if (!isOpen || !conflictData) return null;

  const isStaleUpdate = conflictData.conflictType === 'STALE_UPDATE';
  const isClaimConflict = conflictData.conflictType === 'CONCURRENT_CLAIM';

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true">
      <div className="modal-card modal-card-conflict">
        <div className="modal-header">
          <div className="modal-title-with-icon">
            <span className="modal-icon-badge icon-danger">
              <AlertCircle size={22} />
            </span>
            <div>
              <h3>Concurrency Conflict Detected</h3>
              <p className="modal-subtitle">HTTP 409 Conflict Response from Server</p>
            </div>
          </div>
          <button className="btn-close" onClick={onClose} aria-label="Close dialog">
            <X size={18} />
          </button>
        </div>

        <div className="modal-body">
          <div className="conflict-alert-banner">
            <p className="conflict-message">{conflictData.message}</p>
          </div>

          {isStaleUpdate && (
            <div className="conflict-diff-box">
              <div className="conflict-version-pill">
                <span>Submitted Revision: <strong>v{conflictData.submittedVersion}</strong></span>
                <span>Current Server Revision: <strong className="text-danger">v{conflictData.currentVersion}</strong></span>
              </div>
              <p className="conflict-explanation">
                Another user or session saved modifications to this work item while you were editing it. To prevent unintentionally overwriting changes, your save was rejected.
              </p>
              {conflictData.currentWorkItem && (
                <div className="conflict-server-preview">
                  <h4>Latest Server Snapshot:</h4>
                  <ul>
                    <li><strong>Title:</strong> {conflictData.currentWorkItem.title}</li>
                    <li><strong>Status:</strong> {conflictData.currentWorkItem.status}</li>
                    <li><strong>Priority:</strong> {conflictData.currentWorkItem.priority}</li>
                    <li>
                      <strong>Assigned To:</strong>{' '}
                      {conflictData.currentWorkItem.assignedTo?.name || 'Unassigned'}
                    </li>
                  </ul>
                </div>
              )}
            </div>
          )}

          {isClaimConflict && (
            <div className="conflict-diff-box">
              <p className="conflict-explanation">
                This unassigned work item was claimed or assigned by another user in a concurrent request.
              </p>
              {conflictData.assignedTo && (
                <div className="conflict-server-preview">
                  <p>
                    <strong>Currently Assigned To:</strong>{' '}
                    {conflictData.assignedTo.name} ({conflictData.assignedTo.email})
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Close
          </button>
          <button className="btn btn-primary" onClick={onResolveReload}>
            <RefreshCw size={16} /> Reconcile & Load Latest Data
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConflictModal;
