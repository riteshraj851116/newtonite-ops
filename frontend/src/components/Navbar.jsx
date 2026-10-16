import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Layers, LogOut, User, Menu, Shield } from 'lucide-react';

const Navbar = ({ onToggleSidebar }) => {
  const { user, logout } = useAuth();

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case 'Admin':
        return 'role-badge-admin';
      case 'Manager':
        return 'role-badge-manager';
      default:
        return 'role-badge-employee';
    }
  };

  return (
    <header className="app-topbar">
      <div className="topbar-left">
        <button
          className="btn-mobile-sidebar"
          onClick={onToggleSidebar}
          aria-label="Toggle navigation menu"
        >
          <Menu size={20} />
        </button>
        <Link to="/" className="topbar-brand">
          <div className="brand-logo-mark">
            <Layers size={20} />
          </div>
          <span className="brand-name">
            Newtonite <span>Ops</span>
          </span>
        </Link>
      </div>

      <div className="topbar-right">
        {user && (
          <>
            <div className="user-profile-badge">
              <span className={`role-pill ${getRoleBadgeClass(user.role)}`}>
                <Shield size={12} /> {user.role}
              </span>
              <Link to="/profile" className="user-name-link">
                <User size={16} />
                <span className="user-name-text">{user.name}</span>
              </Link>
            </div>

            <button
              className="btn btn-topbar-logout"
              onClick={logout}
              title="Log out of system"
            >
              <LogOut size={16} />
              <span className="logout-text">Logout</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
};

export default Navbar;
