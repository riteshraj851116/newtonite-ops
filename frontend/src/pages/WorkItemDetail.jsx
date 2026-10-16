import React, { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '../api/workItemApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import ConflictModal from '../components/ConflictModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import {
  ArrowLeft,
  Edit,
  Hand,
  CheckCircle,
  Clock,
  User,
  Users,
  Calendar,
  Send,
  MessageSquare,
  ShieldAlert,
  GitCommit,
  RefreshCw,
  AlertTriangle,
  FileText,
  CheckSquare,
} from 'lucide-react';

const WorkItemDetail = () => {
  const { id } = useParams();
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [commentText, setCommentText] = useState('');
  const [transitionNote, setTransitionNote] = useState('');
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null);

  // 1. Fetch Work Item details
  const {
    data: itemData,
    isLoading: loadingItem,
    error: itemError,
    refetch: refetchItem,
  } = useQuery({
    queryKey: ['workItem', id],
    queryFn: () => workItemApi.getItemById(id),
    retry: false,
  });

  // 2. Fetch Activity Timeline
  const {
    data: activityData,
    isLoading: loadingActivity,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ['workItemActivity', id],
    queryFn: () => workItemApi.getActivity(id),
    enabled: !!id,
  });

  // 3. Fetch Comments
  const {
    data: commentsData,
    isLoading: loadingComments,
    refetch: refetchComments,
  } = useQuery({
    queryKey: ['workItemComments', id],
    queryFn: () => workItemApi.getComments(id),
    enabled: !!id,
  });

  const item = itemData?.item;
  const userRole = itemData?.userRole;
  const isLead = userRole === 'Lead' || userRole === 'Admin';
  const isViewer = userRole === 'Viewer';
  const activities = activityData?.events || [];
  const comments = commentsData?.comments || [];

  // Claim mutation (Critical Requirement A)
  const claimMutation = useMutation({
    mutationFn: async () => {
      return await workItemApi.claimItem(id);
    },
    onSuccess: () => {
      addToast('You have successfully claimed this work item!', 'success');
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItemActivity', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        setConflictData(err.response.data);
        setConflictModalOpen(true);
      } else {
        addToast(err.response?.data?.message || 'Failed to claim work item.', 'error');
      }
    },
  });

  // Workflow transition mutation (Workflow Engine + Critical Requirement B Optimistic Locking)
  const transitionMutation = useMutation({
    mutationFn: async ({ targetStatus, note }) => {
      return await workItemApi.transitionItem(id, targetStatus, item.version, note);
    },
    onSuccess: (data, variables) => {
      addToast(`Status updated to ${variables.targetStatus.replace('_', ' ')}!`, 'success');
      setTransitionNote('');
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItemActivity', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        setConflictData(err.response.data);
        setConflictModalOpen(true);
      } else {
        addToast(err.response?.data?.message || 'Invalid workflow transition.', 'error');
      }
    },
  });

  // Add Comment mutation
  const commentMutation = useMutation({
    mutationFn: async (content) => {
      return await workItemApi.addComment(id, content);
    },
    onSuccess: () => {
      setCommentText('');
      addToast('Comment posted.', 'success');
      queryClient.invalidateQueries({ queryKey: ['workItemComments', id] });
      queryClient.invalidateQueries({ queryKey: ['workItemActivity', id] });
    },
    onError: (err) => {
      addToast(err.response?.data?.message || 'Failed to post comment.', 'error');
    },
  });

  const handleAddComment = (e) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    commentMutation.mutate(commentText.trim());
  };

  if (loadingItem) {
    return <LoadingSpinner text="Retrieving operational work item details..." />;
  }

  if (itemError) {
    const status = itemError.response?.status;
    if (status === 403) {
      return (
        <div className="p-8 text-center">
          <h2 className="text-xl font-bold text-danger mb-2">Access Denied (HTTP 403)</h2>
          <p className="text-muted mb-4">You do not belong to the team that owns this work item.</p>
          <Link to="/work-items" className="btn btn-primary">
            Return to Work Items
          </Link>
        </div>
      );
    }
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-danger mb-2">Item Not Found (HTTP 404)</h2>
        <p className="text-muted mb-4">The requested work item does not exist or has been removed.</p>
        <Link to="/work-items" className="btn btn-primary">
          Return to Work Items
        </Link>
      </div>
    );
  }

  if (!item) return null;

  const isUnassigned = !item.assignee && !item.assigneeId;
  const isClaimable = isUnassigned && !isViewer && item.status !== 'Resolved' && item.status !== 'Closed';

  return (
    <div className="page-container">
      {/* Header Bar */}
      <div className="page-header">
        <div>
          <Link to="/work-items" className="back-link">
            <ArrowLeft size={16} /> Back to Work Items
          </Link>
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            <h1 className="page-title">{item.title}</h1>
            <span className="version-tag-pill" title="Optimistic Concurrency Version">
              v{item.version}
            </span>
          </div>
          <p className="page-subtitle">
            Item ID: <code className="font-mono text-xs">{item.id}</code> · Team:{' '}
            <strong>{item.team?.name}</strong> (Your role: <strong>{userRole}</strong>)
          </p>
        </div>

        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={() => {
              refetchItem();
              refetchActivity();
              refetchComments();
              addToast('Work item refreshed.', 'info', 1500);
            }}
            title="Refresh current state"
          >
            <RefreshCw size={16} />
            <span>Reload</span>
          </button>

          {!isViewer && (
            <Link to={`/work-items/${item.id}/edit`} className="btn btn-secondary">
              <Edit size={16} />
              <span>Edit Details</span>
            </Link>
          )}

          {isClaimable && (
            <button
              className="btn btn-primary"
              onClick={() => claimMutation.mutate()}
              disabled={claimMutation.isPending}
            >
              <Hand size={16} />
              <span>{claimMutation.isPending ? 'Claiming...' : 'Claim This Item'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Grid: Details + Workflow Actions & History */}
      <div className="work-item-layout-grid">
        {/* Left Column: Details, Comments */}
        <div className="work-item-main-col">
          {/* Item Meta Box */}
          <div className="card mb-6">
            <div className="card-header flex items-center justify-between">
              <h3>Work Item Overview</h3>
              <div className="flex items-center gap-2">
                <StatusBadge status={item.status} />
                <PriorityBadge priority={item.priority} />
              </div>
            </div>
            <div className="card-body">
              <div className="description-section mb-6">
                <h4 className="text-xs uppercase text-muted font-bold tracking-wider mb-2">
                  Operational Description
                </h4>
                <div className="description-text whitespace-pre-wrap">{item.description}</div>
              </div>

              <div className="metadata-grid">
                <div className="meta-item">
                  <span className="meta-label">Type</span>
                  <span className="meta-value font-medium">{(item.type || 'Task').replace('_', ' ')}</span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Assigned To</span>
                  <span className="meta-value font-medium">
                    {item.assignee ? (
                      <span className="flex items-center gap-1.5">
                        <User size={14} className="text-muted" />
                        {item.assignee.name}
                      </span>
                    ) : (
                      <span className="badge badge-unassigned">Unassigned</span>
                    )}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created By</span>
                  <span className="meta-value font-medium">
                    {item.createdBy?.name || 'System Operator'}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Due Date</span>
                  <span className="meta-value font-medium">
                    {item.dueDate ? (
                      <span className="flex items-center gap-1.5">
                        <Calendar size={14} className="text-muted" />
                        {new Date(item.dueDate).toLocaleDateString()}
                      </span>
                    ) : (
                      'None'
                    )}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Created</span>
                  <span className="meta-value text-muted text-xs">
                    {new Date(item.createdAt).toLocaleString()}
                  </span>
                </div>
                <div className="meta-item">
                  <span className="meta-label">Last Modified</span>
                  <span className="meta-value text-muted text-xs">
                    {new Date(item.updatedAt).toLocaleString()}
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Comments Section */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-primary" />
                <h3>Discussion & Comments ({comments.length})</h3>
              </div>
            </div>
            <div className="card-body">
              {!isViewer && (
                <form onSubmit={handleAddComment} className="comment-form mb-6">
                  <textarea
                    rows={3}
                    placeholder="Add an operational note or status update..."
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    disabled={commentMutation.isPending}
                    required
                  />
                  <div className="flex justify-end mt-2">
                    <button
                      type="submit"
                      className="btn btn-primary btn-sm"
                      disabled={commentMutation.isPending || !commentText.trim()}
                    >
                      <Send size={14} />
                      <span>{commentMutation.isPending ? 'Posting...' : 'Post Comment'}</span>
                    </button>
                  </div>
                </form>
              )}

              {loadingComments ? (
                <LoadingSpinner text="Loading discussion..." />
              ) : comments.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">
                  No comments yet. Operational discussions will appear here.
                </p>
              ) : (
                <div className="comments-stream">
                  {comments.map((c) => (
                    <div key={c.id} className="comment-bubble">
                      <div className="comment-header">
                        <span className="comment-author">{c.author?.name || 'Operator'}</span>
                        <span className="comment-time">
                          {new Date(c.createdAt).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <div className="comment-body">{c.content}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Workflow Actions & Transactional Activity History */}
        <div className="work-item-side-col">
          {/* Workflow Transitions Box */}
          <div className="card mb-6">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <CheckSquare size={18} className="text-primary" />
                <h3>Workflow State Machine</h3>
              </div>
            </div>
            <div className="card-body">
              <div className="workflow-stepper mb-4">
                <div className={`step-node ${item.status === 'Open' ? 'current' : 'done'}`}>
                  <span>Open</span>
                </div>
                <div className="step-arrow">→</div>
                <div className={`step-node ${item.status === 'In_Progress' ? 'current' : item.status === 'Awaiting_Approval' || item.status === 'Resolved' || item.status === 'Closed' ? 'done' : ''}`}>
                  <span>In Progress</span>
                </div>
                <div className="step-arrow">→</div>
                <div className={`step-node ${item.status === 'Awaiting_Approval' ? 'current' : item.status === 'Resolved' || item.status === 'Closed' ? 'done' : ''}`}>
                  <span>Awaiting Approval</span>
                </div>
                <div className="step-arrow">→</div>
                <div className={`step-node ${item.status === 'Resolved' ? 'current' : item.status === 'Closed' ? 'done' : ''}`}>
                  <span>Resolved</span>
                </div>
                <div className="step-arrow">→</div>
                <div className={`step-node ${item.status === 'Closed' ? 'current' : ''}`}>
                  <span>Closed</span>
                </div>
              </div>

              {/* Action Buttons based on current state and role */}
              <div className="workflow-actions-area">
                {item.status === 'Open' && (
                  <div>
                    {!isViewer ? (
                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => transitionMutation.mutate({ targetStatus: 'In_Progress' })}
                        disabled={transitionMutation.isPending}
                      >
                        Start Work (Move to In Progress)
                      </button>
                    ) : (
                      <p className="text-xs text-muted">Viewers cannot transition status.</p>
                    )}
                  </div>
                )}

                {item.status === 'In_Progress' && (
                  <div>
                    {!isViewer ? (
                      <button
                        className="btn btn-primary btn-block"
                        onClick={() => transitionMutation.mutate({ targetStatus: 'Awaiting_Approval' })}
                        disabled={transitionMutation.isPending}
                      >
                        Submit for Approval
                      </button>
                    ) : (
                      <p className="text-xs text-muted">Viewers cannot transition status.</p>
                    )}
                  </div>
                )}

                {item.status === 'Awaiting_Approval' && (
                  <div>
                    {isLead ? (
                      <div className="flex flex-col gap-2">
                        <div className="alert-box alert-info text-xs mb-2">
                          As an authorized <strong>{userRole}</strong> in this team, you can approve or return this item.
                        </div>
                        <button
                          className="btn btn-primary btn-block"
                          onClick={() => transitionMutation.mutate({ targetStatus: 'Resolved' })}
                          disabled={transitionMutation.isPending}
                        >
                          <CheckCircle size={16} /> Approve & Resolve Item
                        </button>
                        <button
                          className="btn btn-secondary btn-block btn-sm"
                          onClick={() => transitionMutation.mutate({ targetStatus: 'In_Progress', note: 'Returned for revisions.' })}
                          disabled={transitionMutation.isPending}
                        >
                          Return to In Progress
                        </button>
                      </div>
                    ) : (
                      <div className="alert-box alert-warning text-xs">
                        <AlertTriangle size={14} className="inline mr-1" />
                        This item requires sign-off from a <strong>Team Lead</strong> or <strong>Admin</strong>. Your role is {userRole}.
                      </div>
                    )}
                  </div>
                )}

                {item.status === 'Resolved' && (
                  <div>
                    {isLead ? (
                      <button
                        className="btn btn-secondary btn-block"
                        onClick={() => transitionMutation.mutate({ targetStatus: 'Closed' })}
                        disabled={transitionMutation.isPending}
                      >
                        Close Work Item
                      </button>
                    ) : (
                      <div className="text-xs text-muted">
                        Item resolved. Only a Team Lead or Admin can close this item.
                      </div>
                    )}
                  </div>
                )}

                {item.status === 'Closed' && (
                  <div className="alert-box alert-success text-xs text-center">
                    This work item has completed its operational lifecycle and is closed.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Transactional Activity Timeline (Critical Requirement E) */}
          <div className="card">
            <div className="card-header">
              <div className="flex items-center gap-2">
                <GitCommit size={18} className="text-primary" />
                <h3>Activity Timeline ({activities.length})</h3>
              </div>
            </div>
            <div className="card-body">
              {loadingActivity ? (
                <LoadingSpinner text="Fetching audit timeline..." />
              ) : activities.length === 0 ? (
                <p className="text-muted text-sm text-center py-4">No activity events recorded.</p>
              ) : (
                <div className="activity-timeline">
                  {activities.map((ev) => (
                    <div key={ev.id} className="timeline-item">
                      <div className="timeline-dot" />
                      <div className="timeline-content">
                        <div className="timeline-header">
                          <span className="timeline-actor">{ev.actor?.name || 'Operator'}</span>
                          <span className="timeline-type">{ev.eventType.replace('_', ' ')}</span>
                        </div>
                        <div className="timeline-time">
                          {new Date(ev.timestamp).toLocaleString(undefined, {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </div>
                        {ev.details && (
                          <div className="timeline-details">
                            {ev.details.note && <p className="italic mb-1">"{ev.details.note}"</p>}
                            {ev.details.fromStatus && ev.details.toStatus && (
                              <p>
                                Transitioned from <code>{ev.details.fromStatus.replace('_', ' ')}</code> →{' '}
                                <code>{ev.details.toStatus.replace('_', ' ')}</code>
                              </p>
                            )}
                            {ev.details.changes && (
                              <ul className="text-xs mt-1 list-disc pl-4">
                                {Object.keys(ev.details.changes).map((k) => (
                                  <li key={k}>
                                    Changed <strong>{k}</strong>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Concurrency Conflict Modal (Critical Requirement A & B) */}
      <ConflictModal
        isOpen={conflictModalOpen}
        conflictData={conflictData}
        onClose={() => setConflictModalOpen(false)}
        onResolveReload={() => {
          setConflictModalOpen(false);
          refetchItem();
          refetchActivity();
          refetchComments();
        }}
      />
    </div>
  );
};

export default WorkItemDetail;
