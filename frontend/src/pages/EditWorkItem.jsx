import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '../api/workItemApi';
import { teamApi } from '../api/teamApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import ConflictModal from '../components/ConflictModal';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { ArrowLeft, Save, AlertTriangle, ShieldAlert } from 'lucide-react';

const EditWorkItem = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();
  const { addToast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Task',
    priority: 'Medium',
    assigneeId: '',
    dueDate: '',
  });

  const [conflictModalOpen, setConflictModalOpen] = useState(false);
  const [conflictData, setConflictData] = useState(null);
  const [error, setError] = useState('');

  // 1. Fetch current item state
  const {
    data: itemData,
    isLoading: loadingItem,
    error: fetchError,
    refetch,
  } = useQuery({
    queryKey: ['workItem', id],
    queryFn: () => workItemApi.getItemById(id),
  });

  const item = itemData?.item;
  const userRole = itemData?.userRole;
  const isViewer = userRole === 'Viewer';

  // 2. Fetch team members for assignee dropdown
  const { data: teamData } = useQuery({
    queryKey: ['team', item?.teamId],
    queryFn: () => teamApi.getTeamById(item?.teamId),
    enabled: !!item?.teamId,
  });

  const teamMembers = teamData?.team?.members || [];

  // Populate form with current values
  useEffect(() => {
    if (item) {
      setFormData({
        title: item.title || '',
        description: item.description || '',
        type: item.type || 'Task',
        priority: item.priority || 'Medium',
        assigneeId: item.assigneeId || '',
        dueDate: item.dueDate ? item.dueDate.split('T')[0] : '',
      });
    }
  }, [item]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  // Optimistic Locking Update Mutation (Critical Requirement B)
  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      // Must pass version matching the item fetched from server
      return await workItemApi.updateItem(id, {
        ...payload,
        version: item.version,
      });
    },
    onSuccess: () => {
      addToast('Work item updated successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['workItem', id] });
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      navigate(`/work-items/${id}`);
    },
    onError: (err) => {
      if (err.response?.status === 409) {
        // Optimistic locking conflict detected!
        setConflictData(err.response.data);
        setConflictModalOpen(true);
      } else {
        const msg = err.response?.data?.message || 'Failed to update work item.';
        setError(msg);
        addToast(msg, 'error');
      }
    },
  });

  const handleSubmit = (e) => {
    e.preventDefault();
    setError('');

    if (formData.title.trim().length < 3) {
      setError('Title must be at least 3 characters.');
      return;
    }
    if (formData.description.trim().length < 5) {
      setError('Description must be at least 5 characters.');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      priority: formData.priority,
      assigneeId: formData.assigneeId || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };

    updateMutation.mutate(payload);
  };

  if (loadingItem) {
    return <LoadingSpinner text="Loading work item for editing..." />;
  }

  if (fetchError || !item) {
    return (
      <div className="p-8 text-center text-danger">
        <p>Could not load work item details.</p>
        <Link to="/work-items" className="btn btn-primary mt-3">
          Back to Work Items
        </Link>
      </div>
    );
  }

  if (isViewer) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-xl font-bold text-danger mb-2">Permission Denied</h2>
        <p className="text-muted mb-4">Viewers have read-only access and cannot modify work items.</p>
        <Link to={`/work-items/${id}`} className="btn btn-primary">
          Back to Item Details
        </Link>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to={`/work-items/${id}`} className="back-link">
            <ArrowLeft size={16} /> Cancel and Back to Details
          </Link>
          <div className="flex items-center gap-3 mt-2">
            <h1 className="page-title">Edit Work Item</h1>
            <span className="version-tag-pill">Target v{item.version}</span>
          </div>
          <p className="page-subtitle">
            Changes are protected by Optimistic Concurrency Control (OCC) against version collisions.
          </p>
        </div>
      </div>

      <div className="form-card card max-w-3xl">
        {error && <div className="alert-box alert-error mb-4">{error}</div>}

        <div className="concurrency-warning-box mb-6">
          <ShieldAlert size={16} />
          <div>
            <strong>Optimistic Locking Active:</strong> Your client is editing revision <code>v{item.version}</code>. If another operator saves changes before you, the system will detect the stale revision and prompt you with a conflict resolution dialog.
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              value={formData.title}
              onChange={handleChange}
              required
              disabled={updateMutation.isPending}
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Description *</label>
            <textarea
              id="description"
              name="description"
              rows={5}
              value={formData.description}
              onChange={handleChange}
              required
              disabled={updateMutation.isPending}
            />
          </div>

          <div className="form-row-2">
            {/* Type */}
            <div className="form-group">
              <label htmlFor="type">Type</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                disabled={updateMutation.isPending}
              >
                <option value="Incident">Incident</option>
                <option value="Customer_Issue">Customer Issue</option>
                <option value="Payment">Payment</option>
                <option value="Compliance">Compliance</option>
                <option value="Task">Task</option>
              </select>
            </div>

            {/* Priority */}
            <div className="form-group">
              <label htmlFor="priority">Priority</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={updateMutation.isPending}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-row-2">
            {/* Assignee */}
            <div className="form-group">
              <label htmlFor="assigneeId">Assignee</label>
              <select
                id="assigneeId"
                name="assigneeId"
                value={formData.assigneeId}
                onChange={handleChange}
                disabled={updateMutation.isPending}
              >
                <option value="">Unassigned</option>
                {teamMembers.map((m) => (
                  <option key={m.userId} value={m.userId}>
                    {m.name} ({m.role})
                  </option>
                ))}
              </select>
            </div>

            {/* Due Date */}
            <div className="form-group">
              <label htmlFor="dueDate">Due Date</label>
              <input
                id="dueDate"
                name="dueDate"
                type="date"
                value={formData.dueDate}
                onChange={handleChange}
                disabled={updateMutation.isPending}
              />
            </div>
          </div>

          <div className="form-actions mt-6 flex justify-end gap-3">
            <Link to={`/work-items/${id}`} className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={updateMutation.isPending}
            >
              <Save size={16} />
              <span>{updateMutation.isPending ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Optimistic Locking Conflict Modal (Critical Requirement B) */}
      <ConflictModal
        isOpen={conflictModalOpen}
        conflictData={conflictData}
        onClose={() => setConflictModalOpen(false)}
        onResolveReload={() => {
          setConflictModalOpen(false);
          refetch();
          addToast('Form reloaded with latest server data.', 'info');
        }}
      />
    </div>
  );
};

export default EditWorkItem;
