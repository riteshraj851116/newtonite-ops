import React, { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '../api/workItemApi';
import { teamApi } from '../api/teamApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import StatusBadge from '../components/StatusBadge';
import PriorityBadge from '../components/PriorityBadge';
import Pagination from '../components/Pagination';
import ConflictModal from '../components/ConflictModal';
import { LoadingSpinner, EmptyState } from '../components/LoadingSpinner';
import {
  Search,
  Filter,
  PlusCircle,
  RotateCcw,
  Hand,
  Calendar,
  Flame,
  ClockAlert,
  UserCheck2,
  CheckSquare,
} from 'lucide-react';

const WorkItemList = ({ viewMode = 'all' }) => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  // Search and filter parameters
  const [search, setSearch] = useState(searchParams.get('search') || '');
  const [status, setStatus] = useState(searchParams.get('status') || '');
  const [priority, setPriority] = useState(
    viewMode === 'unassigned-urgent' ? 'Urgent' : searchParams.get('priority') || ''
  );
  const [teamId, setTeamId] = useState(searchParams.get('teamId') || '');
  const [assigneeId, setAssigneeId] = useState(
    viewMode === 'my-assigned'
      ? 'me'
      : viewMode === 'unassigned-urgent'
      ? 'unassigned'
      : searchParams.get('assigneeId') || ''
  );
  const [sortBy, setSortBy] = useState(searchParams.get('sortBy') || 'updatedAt');
  const [sortOrder, setSortOrder] = useState(searchParams.get('sortOrder') || 'desc');
  const [page, setPage] = useState(parseInt(searchParams.get('page') || '1', 10));

  // Modals & local UI state
  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [claimingId, setClaimingId] = useState(null);

  // Sync state if viewMode changes
  useEffect(() => {
    if (viewMode === 'my-assigned') {
      setAssigneeId('me');
    } else if (viewMode === 'unassigned-urgent') {
      setPriority('Urgent');
      setAssigneeId('unassigned');
    } else if (viewMode === 'awaiting-approval') {
      setStatus('Awaiting_Approval');
    }
    setPage(1);
  }, [viewMode]);

  // Load authorized teams for filter dropdown
  const { data: teamsData } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamApi.getTeams(),
    staleTime: 1000 * 60 * 5, // 5 minutes
  });
  const teams = teamsData?.teams || [];

  // Build query params payload for server-side processing
  const queryParams = {
    page,
    limit: 15,
    sortBy,
    sortOrder,
  };
  if (search.trim()) queryParams.search = search.trim();
  if (status) queryParams.status = status;
  if (priority) queryParams.priority = priority;
  if (teamId) queryParams.teamId = teamId;
  if (assigneeId) queryParams.assigneeId = assigneeId;
  if (viewMode === 'awaiting-approval') queryParams.awaitingMyApproval = 'true';

  // TanStack Query for Work Items
  const {
    data: itemsData,
    isLoading,
    isFetching,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ['workItems', queryParams],
    queryFn: () => workItemApi.getItems(queryParams),
    keepPreviousData: true,
  });

  const workItems = itemsData?.items || [];
  const total = itemsData?.total || 0;
  const totalPages = itemsData?.pages || 1;

  // Claim mutation with atomic concurrency handling
  const claimMutation = useMutation({
    mutationFn: async (itemId) => {
      setClaimingId(itemId);
      return await workItemApi.claimItem(itemId);
    },
    onSuccess: (data, itemId) => {
      addToast('Work item successfully claimed!', 'success');
      // Invalidate queries to reflect updated assignment
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        // Concurrency collision occurred!
        setConflictData(err.response.data);
        setConflictModalOpen(true);
      } else {
        addToast(err.response?.data?.message || 'Failed to claim work item.', 'error');
      }
    },
    onSettled: () => {
      setClaimingId(null);
    },
  });

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatus('');
    setPriority(viewMode === 'unassigned-urgent' ? 'Urgent' : '');
    setTeamId('');
    setAssigneeId(
      viewMode === 'my-assigned'
        ? 'me'
        : viewMode === 'unassigned-urgent'
        ? 'unassigned'
        : ''
    );
    setSortBy('updatedAt');
    setSortOrder('desc');
    setPage(1);
    setSearchParams({});
  };

  // Header content based on active view mode
  const renderHeader = () => {
    switch (viewMode) {
      case 'my-assigned':
        return {
          title: 'My Assigned Work Items',
          subtitle: `Active operational tasks assigned to you (${user?.name}). Total: ${total}`,
          icon: <UserCheck2 size={24} className="text-primary" />,
        };
      case 'unassigned-urgent':
        return {
          title: 'Unassigned Urgent Work Items',
          subtitle: `Urgent operational incidents that require immediate assignment. Total: ${total}`,
          icon: <Flame size={24} className="text-urgent" />,
        };
      case 'awaiting-approval':
        return {
          title: 'Work Items Awaiting Approval',
          subtitle: `Tasks in your teams submitted for Lead or Admin sign-off. Total: ${total}`,
          icon: <ClockAlert size={24} className="text-amber-500" />,
        };
      default:
        return {
          title: 'All Work Items',
          subtitle: `Browse, filter, and track operations across all authorized teams. Total registered: ${total}`,
          icon: <CheckSquare size={24} className="text-primary" />,
        };
    }
  };

  const headerInfo = renderHeader();

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <div className="flex items-center gap-2 mb-1">
            {headerInfo.icon}
            <h1 className="page-title">{headerInfo.title}</h1>
          </div>
          <p className="page-subtitle">{headerInfo.subtitle}</p>
        </div>
        <div className="page-header-actions">
          <Link to="/work-items/create" className="btn btn-primary">
            <PlusCircle size={16} />
            <span>Create Work Item</span>
          </Link>
        </div>
      </div>

      {/* Filter and Search Panel */}
      <div className="filter-panel">
        <form onSubmit={handleSearchSubmit} className="search-form">
          <div className="search-input-wrapper">
            <Search size={18} className="search-icon" />
            <input
              type="text"
              placeholder="Search title or description across thousands of items..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="search-input"
            />
          </div>
          <button type="submit" className="btn btn-secondary">
            Search
          </button>
        </form>

        <div className="filter-controls-row">
          <div className="filter-group">
            <Filter size={16} className="text-muted" />
            <span className="filter-label">Filters:</span>

            {/* Status Filter */}
            {viewMode !== 'awaiting-approval' && (
              <select
                value={status}
                onChange={(e) => {
                  setStatus(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In_Progress">In Progress</option>
                <option value="Awaiting_Approval">Awaiting Approval</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>
            )}

            {/* Priority Filter */}
            {viewMode !== 'unassigned-urgent' && (
              <select
                value={priority}
                onChange={(e) => {
                  setPriority(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="">All Priorities</option>
                <option value="Urgent">Urgent</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
              </select>
            )}

            {/* Team Filter */}
            <select
              value={teamId}
              onChange={(e) => {
                setTeamId(e.target.value);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="">All Authorized Teams</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                </option>
              ))}
            </select>

            {/* Assignee Filter */}
            {viewMode === 'all' && (
              <select
                value={assigneeId}
                onChange={(e) => {
                  setAssigneeId(e.target.value);
                  setPage(1);
                }}
                className="filter-select"
              >
                <option value="">All Assignees</option>
                <option value="me">Assigned to Me</option>
                <option value="unassigned">Unassigned (Claimable)</option>
              </select>
            )}
          </div>

          <div className="sort-group">
            <span className="filter-label">Sort:</span>
            <select
              value={`${sortBy}-${sortOrder}`}
              onChange={(e) => {
                const [sb, so] = e.target.value.split('-');
                setSortBy(sb);
                setSortOrder(so);
                setPage(1);
              }}
              className="filter-select"
            >
              <option value="updatedAt-desc">Recently Updated</option>
              <option value="updatedAt-asc">Oldest Updated</option>
              <option value="createdAt-desc">Newest Created</option>
              <option value="dueDate-asc">Due Date (Earliest)</option>
              <option value="title-asc">Title (A-Z)</option>
            </select>

            {(status || priority || teamId || assigneeId || search) && (
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={handleResetFilters}
                title="Reset active filters"
              >
                <RotateCcw size={14} /> Clear
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main Table View */}
      <div className="card table-card">
        {isLoading ? (
          <div className="p-8">
            <LoadingSpinner text="Querying operational work items..." />
          </div>
        ) : fetchError ? (
          <div className="p-8 text-center text-danger">
            <p>Error loading work items: {fetchError.response?.data?.message || fetchError.message}</p>
            <button className="btn btn-secondary mt-3" onClick={() => refetch()}>
              Retry
            </button>
          </div>
        ) : workItems.length === 0 ? (
          <div className="p-8">
            <EmptyState
              title="No work items matched"
              description="No tasks match the active filters. Try adjusting search criteria or create a new item."
              action={
                <button className="btn btn-secondary" onClick={handleResetFilters}>
                  Reset Filters
                </button>
              }
            />
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table table-hover">
              <thead>
                <tr>
                  <th>Title</th>
                  <th>Type</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Team</th>
                  <th>Assignee</th>
                  <th>Due Date</th>
                  <th>Revision</th>
                  <th>Updated</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {workItems.map((item) => {
                  const itemId = item.id || item._id;
                  const isUnassigned = !item.assignee && !item.assigneeId;
                  const isClaimable = isUnassigned && item.status !== 'Resolved' && item.status !== 'Closed';

                  return (
                    <tr key={itemId}>
                      <td>
                        <Link to={`/work-items/${itemId}`} className="table-row-title-link">
                          {item.title}
                        </Link>
                      </td>
                      <td>
                        <span className="mini-tag">{(item.type || 'Task').replace('_', ' ')}</span>
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
                        {item.assignee ? (
                          <span className="assignee-text">{item.assignee.name}</span>
                        ) : (
                          <span className="badge badge-unassigned">Unassigned</span>
                        )}
                      </td>
                      <td>
                        {item.dueDate ? (
                          <span
                            className={`due-date-cell ${
                              new Date(item.dueDate) < new Date() &&
                              item.status !== 'Resolved' &&
                              item.status !== 'Closed'
                                ? 'text-danger font-semibold'
                                : 'text-muted'
                            }`}
                          >
                            <Calendar size={13} />
                            {new Date(item.dueDate).toLocaleDateString()}
                          </span>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td>
                        <span className="version-tag">v{item.version}</span>
                      </td>
                      <td className="text-muted font-mono text-xs">
                        {new Date(item.updatedAt).toLocaleDateString()}
                      </td>
                      <td className="text-right">
                        <div className="table-actions-cell">
                          {isClaimable && (
                            <button
                              className="btn btn-xs btn-primary"
                              onClick={() => claimMutation.mutate(itemId)}
                              disabled={claimingId === itemId}
                              title="Claim this unassigned work item"
                            >
                              <Hand size={12} /> Claim
                            </button>
                          )}
                          <Link to={`/work-items/${itemId}`} className="btn btn-xs btn-secondary">
                            View
                          </Link>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={total}
          limit={15}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>

      {/* Concurrency Conflict Modal (Critical Requirement A) */}
      <ConflictModal
        isOpen={conflictModalOpen}
        conflictData={conflictData}
        onClose={() => setConflictModalOpen(false)}
        onResolveReload={() => {
          setConflictModalOpen(false);
          refetch();
        }}
      />
    </div>
  );
};

export default WorkItemList;
