import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { Layers, Lock, Mail, User, Shield, ArrowRight } from 'lucide-react';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    role: 'Employee',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const { register } = useAuth();
  const { addToast } = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData((prev) => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const data = await register({
        name: formData.name,
        email: formData.email,
        password: formData.password,
        role: formData.role,
      });
      addToast(`Account created successfully! Welcome, ${data.user.name}.`, 'success');
      navigate('/');
    } catch (err) {
      const msg = err.response?.data?.message || 'Registration failed. Please try again.';
      setError(msg);
      addToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-page-container">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-brand-icon">
            <Layers size={28} />
          </div>
          <h2>Create Account</h2>
          <p className="auth-subtitle">Join the Newtonite Operations Management Platform</p>
        </div>

        {error && <div className="alert-box alert-error">{error}</div>}

        <form onSubmit={handleSubmit} className="auth-form">
          <div className="form-group">
            <label htmlFor="name">Full Name</label>
            <div className="input-with-icon">
              <User size={18} className="input-icon" />
              <input
                id="name"
                name="name"
                type="text"
                placeholder="Jane Doe"
                value={formData.name}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email">Work Email</label>
            <div className="input-with-icon">
              <Mail size={18} className="input-icon" />
              <input
                id="email"
                name="email"
                type="email"
                placeholder="jane@newtonite.io"
                value={formData.email}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="role">Role</label>
            <div className="input-with-icon">
              <Shield size={18} className="input-icon" />
              <select
                id="role"
                name="role"
                value={formData.role}
                onChange={handleChange}
              >
                <option value="Employee">Employee (Developer / QA / Ops)</option>
                <option value="Manager">Manager (Team Lead / Coordinator)</option>
                <option value="Admin">Administrator (Full Access)</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password">Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="password"
                name="password"
                type="password"
                placeholder="Minimum 6 characters"
                value={formData.password}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <div className="input-with-icon">
              <Lock size={18} className="input-icon" />
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Repeat password"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-block btn-lg"
            disabled={submitting}
          >
            {submitting ? 'Creating account...' : 'Create Account'} <ArrowRight size={18} />
          </button>
        </form>

        <div className="auth-footer">
          <p>
            Already have an account? <Link to="/login">Sign in here</Link>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Register;
