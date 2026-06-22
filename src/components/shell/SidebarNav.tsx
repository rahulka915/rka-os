import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, FolderKanban, Activity, Plus, LogOut, User, Inbox } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import './shell.css';

interface SidebarNavProps {
  onQuickAdd: () => void;
}

export function SidebarNav({ onQuickAdd }: SidebarNavProps) {
  const { user, logout, localMode } = useAuth();
  const navigate = useNavigate();
  const accountLabel = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Signed in';

  return (
    <nav className="sidebar-nav">
      <div className="sidebar-header">
        <div className="sidebar-logo">RKA OS</div>
        <button className="sidebar-fab" onClick={onQuickAdd} type="button">
          <Plus size={20} />
          <span>New</span>
        </button>
      </div>
      
      <div className="sidebar-links">
        <NavLink to="/inbox" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Inbox size={18} />
          <span>Inbox</span>
        </NavLink>
        <NavLink to="/home" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/today" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Activity size={18} />
          <span>Today</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Calendar size={18} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FolderKanban size={18} />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/health-search" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Activity size={18} />
          <span>Health</span>
        </NavLink>
      </div>

      <div className="sidebar-footer">
        <button className="sidebar-account" onClick={() => navigate('/profile')} type="button">
          <User size={16} />
          <span>{localMode ? 'Local mode' : accountLabel}</span>
        </button>
        {!localMode && (
          <button className="sidebar-logout" onClick={logout} type="button">
            <LogOut size={16} />
            <span>Sign out</span>
          </button>
        )}
      </div>
    </nav>
  );
}
