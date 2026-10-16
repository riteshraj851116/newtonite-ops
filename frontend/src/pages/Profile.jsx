import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { authApi } from '../api/authApi';
import { User, Mail, Shield, Users, Save, CheckCircle } from 'lucide-react';

const Profile = () => {
  const { user, refreshUser } = useAuth();
  const { addToast } = useToast();

  const [name, setName] = useState(user?.name || '');
  const [saving, setSaving] = useState(false);

  const handleUpdate = async (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    setSaving(true);
    try {
      const res = await authApi.updateProfile({ name: name.trim() });
      if (res.success) {
        addToast('Profile updated successfully!', 'success');
        refreshUser();
      }
    } catch (err) {
      addToast(err.response?.data?.message || 'Failed to update profile.', 'error');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="page-container max-w-3xl">
      <div className="page-header">
        <div>
          <h1 className="page-title">User Profile</h1>
          <p className="page-subtitle">Account credentials, assigned roles, and organizational context.</p>
        </div>
      </div>

      <div className="card profile-card mb-6">
        <div className="profile-header-banner">
          <div className="profile-avatar">
            <User size={36} />
          </div>
          <div>
            <h2 className="profile-name">{user?.name}</h2>
            <p className="profile-email">{user?.email}</p>
            <span className={`role-pill role-badge-${user?.role?.toLowerCase()}`}>
              <Shield size={12} /> {user?.role}
            </span>
          </div>
        </div>

        <div className="card-body">
          <form onSubmit={handleUpdate} className="profile-form">
            <div className="form-group">
              <label htmlFor="name">Display Name</label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="email">Registered Email</label>
              <input id="email" type="email" value={user?.email || ''} disabled readOnly />
              <span className="form-help-text">Email address cannot be changed directly.</span>
            </div>

            <div className="form-group">
              <label>System Role & Permissions</label>
              <input type="text" value={user?.role || ''} disabled readOnly />
              <span className="form-help-text">
                {user?.role === 'Admin' && 'Full administrative access across all teams and resources.'}
                {user?.role === 'Manager' && 'Authorized to manage teams and assign operational tasks.'}
                {user?.role === 'Employee' && 'Can view team items, claim unassigned tasks, and report progress.'}
              </span>
            </div>

            <div className="form-actions-bar">
              <button type="submit" className="btn btn-primary" disabled={saving}>
                <Save size={16} />
                <span>{saving ? 'Saving...' : 'Update Name'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <div className="card-title-group">
            <Users size={18} />
            <h3>Assigned Teams</h3>
          </div>
        </div>
        <div className="card-body">
          {!user?.teams || user.teams.length === 0 ? (
            <p className="text-muted">You are not currently assigned to any specific team.</p>
          ) : (
            <div className="profile-teams-list">
              {user.teams.map((tm) => (
                <div key={tm._id || tm} className="profile-team-item">
                  <strong>{tm.name || 'Team'}</strong>
                  {tm.description && <p className="text-muted text-xs">{tm.description}</p>}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Profile;
