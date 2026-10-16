import React, { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Layers, Lock, Mail, ArrowRight, ShieldCheck, Info } from 'lucide-react';

const DEMO_USERS = [
  {
    role: 'Admin',
    name: 'Elena Rostova',
    email: 'admin@newtonite.io',
    description: 'Global Admin across all teams. Full administrative privileges.',
  },
  {
    role: 'Lead',
    name: 'Marcus Vance',
    email: 'lead.infra@newtonite.io',
    description: 'Platform Infra Lead. Can approve workflow items awaiting approval.',
  },
  {
    role: 'Member',
    name: 'Alex Rivera',
    email: 'member.alex@newtonite.io',
    description: 'Core Engineering Member. Can create, edit, claim, and comment.',
  },
  {
    role: 'Viewer',
    name: 'Rachel Green',
    email: 'viewer.rachel@newtonite.io',
    description: 'Read-only Auditor/Analyst. Can inspect items and audit history.',
  },
];

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { login } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();
  const location = useLocation();

  const from = location.state?.from?.pathname || '/';

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!email || !password) {
      setError('Please provide both email and password.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await login(email, password);
      addToast(`Welcome back, ${data.user.name}!`, 'success');
      navigate(from, { replace: true });
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please verify credentials.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSelectDemo = (demoEmail) => {
    setEmail(demoEmail);
    setPassword('Password123!');
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-icon">
            <Layers size={28} />
          </div>
          <h2>Newtonite Ops</h2>
          <p className="auth-subtitle">Operations Under Pressure — Resilient Mission Control</p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="email">Email Address</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                type="email"
                placeholder="user@newtonite.io"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                autoComplete="email"
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={submitting}
          >
            {submitting ? 'Authenticating...' : 'Sign In'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="demo-accounts-section">
          <div className="demo-accounts-title">
            <ShieldCheck size={16} /> Seeded Demo Credentials (Click to prefill)
          </div>
          <div className="demo-users-list">
            {DEMO_USERS.map((u) => (
              <button
                key={u.email}
                type="button"
                className={`demo-user-card ${email === u.email ? 'active' : ''}`}
                onClick={() => handleSelectDemo(u.email)}
              >
                <div className="demo-user-header">
                  <span className={`role-badge role-badge-${u.role.toLowerCase()}`}>
                    {u.role}
                  </span>
                  <span className="demo-user-name">{u.name}</span>
                </div>
                <div className="demo-user-email">{u.email}</div>
                <div className="demo-user-desc">{u.description}</div>
              </button>
            ))}
          </div>
          <p className="demo-pwd-note">
            <Info size={13} /> Common demo password: <code>Password123!</code>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
