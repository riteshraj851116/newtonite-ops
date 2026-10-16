import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { workItemApi } from '../api/workItemApi';
import { teamApi } from '../api/teamApi';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ArrowLeft, Save, PlusCircle, ShieldCheck, KeyRound, AlertTriangle } from 'lucide-react';

const generateIdempotencyKey = () => {
  return 'idem-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 9);
};

const CreateWorkItem = () => {
  const { user } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'Task',
    priority: 'Medium',
    teamId: '',
    assigneeId: '',
    dueDate: '',
  });

  const [idempotencyKey, setIdempotencyKey] = useState(generateIdempotencyKey());
  const [error, setError] = useState('');

  // Fetch authorized teams
  const { data: teamsData, isLoading: loadingTeams } = useQuery({
    queryKey: ['teams'],
    queryFn: () => teamApi.getTeams(),
  });
  const teams = teamsData?.teams || [];

  // Default to the first team when teams data loads
  useEffect(() => {
    if (teams.length > 0 && !formData.teamId) {
      setFormData((prev) => ({ ...prev, teamId: teams[0].id }));
    }
  }, [teams, formData.teamId]);

  // Selected team object & user's role in this team
  const selectedTeam = teams.find((t) => t.id === formData.teamId);
  const userTeamRole = selectedTeam?.myRole || null;
  const isViewer = userTeamRole === 'Viewer';
  const teamMembers = selectedTeam?.members || [];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      // If team changes, reset assignee
      ...(name === 'teamId' ? { assigneeId: '' } : {}),
    }));
  };

  const createMutation = useMutation({
    mutationFn: async (payload) => {
      return await workItemApi.createItem(payload, idempotencyKey);
    },
    onSuccess: (data) => {
      addToast('Work item created successfully!', 'success');
      queryClient.invalidateQueries({ queryKey: ['workItems'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardSummary'] });
      const createdId = data.item?.id || data.workItem?.id;
      navigate(`/work-items/${createdId}`);
    },
    onError: (err) => {
      const msg = err.response?.data?.message || 'Failed to create work item.';
      setError(msg);
      addToast(msg, 'error');
      // On real failure, generate fresh idempotency key
      setIdempotencyKey(generateIdempotencyKey());
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
    if (!formData.teamId) {
      setError('Please select an authorized team.');
      return;
    }
    if (isViewer) {
      setError('Viewers cannot create work items in this team.');
      return;
    }

    const payload = {
      title: formData.title.trim(),
      description: formData.description.trim(),
      type: formData.type,
      priority: formData.priority,
      teamId: formData.teamId,
      assigneeId: formData.assigneeId || null,
      dueDate: formData.dueDate ? new Date(formData.dueDate).toISOString() : null,
    };

    createMutation.mutate(payload);
  };

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <Link to="/work-items" className="back-link">
            <ArrowLeft size={16} /> Back to Work Items
          </Link>
          <h1 className="page-title mt-2">Create Work Item</h1>
          <p className="page-subtitle">
            Register a new operational incident, task, or customer request with transactional activity logging.
          </p>
        </div>
      </div>

      <div className="form-card card max-w-3xl">
        {error && <div className="alert-box alert-error mb-4">{error}</div>}

        {isViewer && (
          <div className="alert-box alert-error mb-4 flex items-center gap-2">
            <AlertTriangle size={18} />
            <span>
              Your role in <strong>{selectedTeam?.name}</strong> is <strong>Viewer</strong>. Viewers have read-only permissions and cannot create work items.
            </span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          {/* Title */}
          <div className="form-group">
            <label htmlFor="title">Item Title *</label>
            <input
              id="title"
              name="title"
              type="text"
              placeholder="e.g., Database connection pool exhaustion under load"
              value={formData.title}
              onChange={handleChange}
              required
              disabled={createMutation.isPending || isViewer}
            />
            <span className="form-help-text">Concise summary of the operation (min 3 characters).</span>
          </div>

          {/* Description */}
          <div className="form-group">
            <label htmlFor="description">Detailed Description *</label>
            <textarea
              id="description"
              name="description"
              rows={5}
              placeholder="Provide complete operational context, reproduction steps, or SLA constraints..."
              value={formData.description}
              onChange={handleChange}
              required
              disabled={createMutation.isPending || isViewer}
            />
          </div>

          <div className="form-row-2">
            {/* Type */}
            <div className="form-group">
              <label htmlFor="type">Work Item Type</label>
              <select
                id="type"
                name="type"
                value={formData.type}
                onChange={handleChange}
                disabled={createMutation.isPending || isViewer}
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
              <label htmlFor="priority">Priority Level</label>
              <select
                id="priority"
                name="priority"
                value={formData.priority}
                onChange={handleChange}
                disabled={createMutation.isPending || isViewer}
              >
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
                <option value="Urgent">Urgent</option>
              </select>
            </div>
          </div>

          <div className="form-row-3">
            {/* Team */}
            <div className="form-group">
              <label htmlFor="teamId">Team *</label>
              <select
                id="teamId"
                name="teamId"
                value={formData.teamId}
                onChange={handleChange}
                required
                disabled={createMutation.isPending}
              >
                {teams.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.myRole})
                  </option>
                ))}
              </select>
            </div>

            {/* Assignee */}
            <div className="form-group">
              <label htmlFor="assigneeId">Initial Assignee</label>
              <select
                id="assigneeId"
                name="assigneeId"
                value={formData.assigneeId}
                onChange={handleChange}
                disabled={createMutation.isPending || isViewer}
              >
                <option value="">Leave Unassigned (Claimable)</option>
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
                disabled={createMutation.isPending || isViewer}
              />
            </div>
          </div>

          {/* Idempotency Key Info Notice */}
          <div className="idempotency-badge-box">
            <KeyRound size={16} />
            <div>
              <strong>Idempotency Protected:</strong> Request header{' '}
              <code>Idempotency-Key: {idempotencyKey}</code> attached. Duplicate retries will not produce duplicate items.
            </div>
          </div>

          <div className="form-actions mt-6 flex justify-end gap-3">
            <Link to="/work-items" className="btn btn-secondary">
              Cancel
            </Link>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={createMutation.isPending || isViewer || loadingTeams}
            >
              <Save size={16} />
              <span>{createMutation.isPending ? 'Creating...' : 'Create Work Item'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default CreateWorkItem;
