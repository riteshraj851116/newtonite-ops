import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { dashboardApi } from '../api/dashboardApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import { LoadingSpinner, EmptyState } from '../components/LoadingSpinner';
import {
  Briefcase,
  AlertOctagon,
  Clock,
  CheckCircle,
  AlertTriangle,
  Flame,
  ArrowUpRight,
  PlusCircle,
  RefreshCw,
  FolderGit2,
  ClockAlert,
  UserCheck2,
  ShieldCheck,
} from 'lucide-react';

const Dashboard = () => {
  const { user } = useAuth();
  const { addToast } = useToast();

  const {
    data,
    isLoading,
    isFetching,
    error,
    refetch,
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: () => dashboardApi.getSummary(),
  });

  const summary = data?.summary || {
    totalOpen: 0,
    inProgress: 0,
    urgentUnassigned: 0,
    awaitingApproval: 0,
    assignedToMe: 0,
    totalItems: 0,
  };

  const priorityBreakdown = data?.priorityBreakdown || {
    Low: 0,
    Medium: 0,
    High: 0,
    Urgent: 0,
  };

  const recentItems = data?.recentItems || [];
  const urgentItems = data?.urgentItems || [];

  const handleRefresh = async () => {
    await refetch();
    addToast('Dashboard metrics refreshed.', 'info', 1500);
  };

  if (isLoading) {
    return <LoadingSpinner text="Aggregating operational statistics from PostgreSQL..." />;
  }

  if (error) {
    return (
      <div className="p-8 text-center text-danger">
        <p>Failed to load dashboard metrics: {error.response?.data?.message || error.message}</p>
        <button className="btn btn-secondary mt-3" onClick={() => refetch()}>
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="page-container dashboard-page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Operations Mission Control</h1>
          <p className="page-subtitle">
            Welcome, <strong>{user?.name}</strong>. Real-time telemetry for your authorized teams.
          </p>
        </div>
        <div className="page-header-actions">
          <button
            className="btn btn-secondary"
            onClick={handleRefresh}
            disabled={isFetching}
            title="Refresh dashboard metrics"
          >
            <RefreshCw size={16} className={isFetching ? 'spinner-animate' : ''} />
            <span>Refresh</span>
          </button>
          <Link to="/work-items/create" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Create Work Item</span>
          </Link>
        </div>
      </div>

      {/* KPI Summary Cards Grid */}
      <div className="kpi-grid">
        {/* Total Items */}
        <Link to="/work-items" className="kpi-card hover:border-blue-400 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">Total Work Items</span>
            <span className="kpi-icon kpi-icon-blue">
              <Briefcase size={20} />
            </span>
          </div>
          <div className="kpi-value">{summary.totalItems}</div>
          <div className="kpi-subtext">Across your teams</div>
        </Link>

        {/* Total Open */}
        <Link to="/work-items?status=Open" className="kpi-card hover:border-sky-400 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">Open Backlog</span>
            <span className="kpi-icon kpi-icon-sky">
              <Clock size={20} />
            </span>
          </div>
          <div className="kpi-value">{summary.totalOpen}</div>
          <div className="kpi-subtext">Ready for execution</div>
        </Link>

        {/* In Progress */}
        <Link to="/work-items?status=In_Progress" className="kpi-card hover:border-amber-400 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">In Progress</span>
            <span className="kpi-icon kpi-icon-amber">
              <AlertTriangle size={20} />
            </span>
          </div>
          <div className="kpi-value">{summary.inProgress}</div>
          <div className="kpi-subtext">Currently active</div>
        </Link>

        {/* Urgent Unassigned */}
        <Link to="/work-items/unassigned-urgent" className="kpi-card kpi-card-highlight hover:border-red-500 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">Urgent Unassigned</span>
            <span className="kpi-icon kpi-icon-red">
              <Flame size={20} />
            </span>
          </div>
          <div className="kpi-value text-urgent">{summary.urgentUnassigned}</div>
          <div className="kpi-subtext">Immediate action required</div>
        </Link>

        {/* Awaiting Approval */}
        <Link to="/work-items/awaiting-approval" className="kpi-card hover:border-purple-400 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">Awaiting Approval</span>
            <span className="kpi-icon kpi-icon-rose">
              <ClockAlert size={20} />
            </span>
          </div>
          <div className="kpi-value">{summary.awaitingApproval}</div>
          <div className="kpi-subtext">Pending Lead sign-off</div>
        </Link>

        {/* Assigned to Me */}
        <Link to="/work-items/my-assigned" className="kpi-card hover:border-emerald-400 transition-colors">
          <div className="kpi-header">
            <span className="kpi-label">Assigned To Me</span>
            <span className="kpi-icon kpi-icon-emerald">
              <UserCheck2 size={20} />
            </span>
          </div>
          <div className="kpi-value">{summary.assignedToMe}</div>
          <div className="kpi-subtext">Your assigned tasks</div>
        </Link>
      </div>

      {/* Main Content Layout Grid */}
      <div className="dashboard-content-grid">
        {/* Left Column: Urgent Unassigned Items */}
        <div className="dashboard-card card">
          <div className="card-header-with-action">
            <div className="card-title-group">
              <Flame size={18} className="text-urgent" />
              <h3>Urgent Items Requiring Attention</h3>
            </div>
            <Link to="/work-items/unassigned-urgent" className="link-subtle">
              View all unassigned <ArrowUpRight size={14} />
            </Link>
          </div>

          <div className="card-body p-0">
            {urgentItems.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  title="No urgent unassigned alerts"
                  description="All urgent tasks are currently assigned or resolved."
                />
              </div>
            ) : (
              <div className="table-responsive">
                <table className="table table-compact">
                  <thead>
                    <tr>
                      <th>Title</th>
                      <th>Team</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {urgentItems.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <Link to={`/work-items/${item.id}`} className="table-row-title-link">
                            {item.title}
                          </Link>
                        </td>
                        <td>
                          <span className="team-pill">{item.team?.name || 'Authorized'}</span>
                        </td>
                        <td>
                          <StatusBadge status={item.status} />
                        </td>
                        <td>
                          <Link to={`/work-items/${item.id}`} className="btn btn-xs btn-primary">
                            Inspect
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Priority Distribution & Quick Nav */}
        <div className="dashboard-card card">
          <div className="card-header">
            <div className="card-title-group">
              <FolderGit2 size={18} />
              <h3>Priority Distribution</h3>
            </div>
          </div>
          <div className="card-body">
            <div className="priority-breakdown-list">
              <div className="priority-bar-item">
                <div className="priority-bar-label">
                  <span>Urgent</span>
                  <strong>{priorityBreakdown.Urgent}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill fill-urgent"
                    style={{
                      width: `${summary.totalItems ? (priorityBreakdown.Urgent / summary.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="priority-bar-item">
                <div className="priority-bar-label">
                  <span>High</span>
                  <strong>{priorityBreakdown.High}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill fill-high"
                    style={{
                      width: `${summary.totalItems ? (priorityBreakdown.High / summary.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="priority-bar-item">
                <div className="priority-bar-label">
                  <span>Medium</span>
                  <strong>{priorityBreakdown.Medium}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill fill-medium"
                    style={{
                      width: `${summary.totalItems ? (priorityBreakdown.Medium / summary.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>

              <div className="priority-bar-item">
                <div className="priority-bar-label">
                  <span>Low</span>
                  <strong>{priorityBreakdown.Low}</strong>
                </div>
                <div className="progress-track">
                  <div
                    className="progress-fill fill-low"
                    style={{
                      width: `${summary.totalItems ? (priorityBreakdown.Low / summary.totalItems) * 100 : 0}%`,
                    }}
                  />
                </div>
              </div>
            </div>

            <div className="quick-actions-box mt-4">
              <h4>Direct Navigation</h4>
              <div className="quick-buttons-row">
                <Link to="/work-items/my-assigned" className="btn btn-outline btn-sm">
                  My Assigned Work Items
                </Link>
                <Link to="/work-items/awaiting-approval" className="btn btn-outline btn-sm">
                  Awaiting My Approval
                </Link>
                <Link to="/teams" className="btn btn-outline btn-sm">
                  Team Work Items
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Recently Updated Work Items */}
      <div className="dashboard-card card mt-6">
        <div className="card-header-with-action">
          <div className="card-title-group">
            <Clock size={18} />
            <h3>Recently Updated Work Items</h3>
          </div>
          <Link to="/work-items" className="link-subtle">
            All work items <ArrowUpRight size={14} />
          </Link>
        </div>

        <div className="card-body p-0">
          {recentItems.length === 0 ? (
            <div className="p-6">
              <EmptyState title="No recent items" description="No work items recorded yet." />
            </div>
          ) : (
            <div className="table-responsive">
              <table className="table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Status</th>
                    <th>Priority</th>
                    <th>Team</th>
                    <th>Assignee</th>
                    <th>Revision</th>
                    <th>Last Activity</th>
                    <th className="text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {recentItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <Link to={`/work-items/${item.id}`} className="table-row-title-link">
                          {item.title}
                        </Link>
                      </td>
                      <td>
                        <StatusBadge status={item.status} />
                      </td>
                      <td>
                        <PriorityBadge priority={item.priority} />
                      </td>
                      <td>
                        <span className="team-pill">{item.team?.name || 'Authorized'}</span>
                      </td>
                      <td>
                        <span className="assignee-text">
                          {item.assignee ? item.assignee.name : 'Unassigned'}
                        </span>
                      </td>
                      <td>
                        <span className="version-tag">v{item.version}</span>
                      </td>
                      <td className="text-muted text-xs">
                        {new Date(item.updatedAt).toLocaleString(undefined, {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="text-right">
                        <Link to={`/work-items/${item.id}`} className="btn btn-xs btn-secondary">
                          View
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
