import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, FolderKanban, Plus, LogOut, User, Pill, Dumbbell } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import './shell.css';

import { AppInfoModal } from './AppInfoModal';

interface SidebarNavProps {
  onQuickAdd: () => void;
}

export function SidebarNav({ onQuickAdd }: SidebarNavProps) {
  const { user, logout, localMode } = useAuth();
  const navigate = useNavigate();
  const [showAppInfo, setShowAppInfo] = useState(false);
  const accountLabel = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Signed in';

  return (
    <>
    <nav className="sidebar-nav">
      <div className="sidebar-header">
        <button 
          className="sidebar-logo" 
          onClick={() => setShowAppInfo(true)}
          style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none' }}
        >
          RKA OS
        </button>
        <button className="sidebar-fab" onClick={onQuickAdd} type="button">
          <Plus size={20} />
          <span>New</span>
        </button>
      </div>
      
      <div className="sidebar-links">
        <NavLink to="/home" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Home size={18} />
          <span>Home</span>
        </NavLink>
        <NavLink to="/calendar" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Calendar size={18} />
          <span>Calendar</span>
        </NavLink>
        <NavLink to="/projects" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <FolderKanban size={18} />
          <span>Projects</span>
        </NavLink>
        <NavLink to="/medications" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Pill size={18} />
          <span>Medications</span>
        </NavLink>
        <NavLink to="/workouts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`}>
          <Dumbbell size={18} />
          <span>Workouts</span>
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
    {showAppInfo && <AppInfoModal onClose={() => setShowAppInfo(false)} />}
    </>
  );
}
