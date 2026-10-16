import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  PlusCircle,
  Users,
  UserCheck,
  ShieldCheck,
  Flame,
  UserCheck2,
  ClockAlert,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const Sidebar = ({ isOpen, onCloseMobile }) => {
  const { user, isLeadInAnyTeam } = useAuth();

  return (
    <>
      {isOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`app-sidebar ${isOpen ? 'sidebar-open' : ''}`}>
        <div className="sidebar-section">
          <span className="sidebar-heading">Operations</span>
          <nav className="sidebar-nav">
            <NavLink
              to="/"
              end
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <LayoutDashboard size={17} />
              <span>Dashboard</span>
            </NavLink>

            <NavLink
              to="/work-items"
              end
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <CheckSquare size={17} />
              <span>All Work Items</span>
            </NavLink>

            <NavLink
              to="/work-items/my-assigned"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <UserCheck2 size={17} />
              <span>My Assigned Items</span>
            </NavLink>

            <NavLink
              to="/work-items/unassigned-urgent"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <Flame size={17} className="text-urgent" />
              <span>Unassigned Urgent</span>
            </NavLink>

            <NavLink
              to="/work-items/awaiting-approval"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <ClockAlert size={17} />
              <span>Awaiting Approval</span>
            </NavLink>

            <NavLink
              to="/work-items/create"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <PlusCircle size={17} />
              <span>New Work Item</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-section">
          <span className="sidebar-heading">Organization</span>
          <nav className="sidebar-nav">
            <NavLink
              to="/teams"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <Users size={17} />
              <span>Team Work Items</span>
            </NavLink>

            <NavLink
              to="/profile"
              className={({ isActive }) =>
                `sidebar-link ${isActive ? 'sidebar-link-active' : ''}`
              }
              onClick={onCloseMobile}
            >
              <UserCheck size={17} />
              <span>User Profile</span>
            </NavLink>
          </nav>
        </div>

        <div className="sidebar-footer">
          <div className="sidebar-context-card">
            <div className="context-card-role">
              <ShieldCheck size={14} />
              <span>Active Session</span>
            </div>
            <p className="context-card-user">{user?.name || 'Authorized User'}</p>
            <p className="context-card-email">{user?.email}</p>
          </div>
        </div>
      </aside>
    </>
  );
};

export default Sidebar;
