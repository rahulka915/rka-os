import { NavLink } from 'react-router-dom';
import { Home, Calendar, FolderKanban, Activity, Plus } from 'lucide-react';
import './shell.css';

interface SidebarNavProps {
  onQuickAdd: () => void;
}

export function SidebarNav({ onQuickAdd }: SidebarNavProps) {
  return (
    <nav className="sidebar-nav">
      <div className="sidebar-header">
        <div className="sidebar-logo">RKA OS</div>
        <button className="sidebar-fab" onClick={onQuickAdd}>
          <Plus size={20} />
          <span>New</span>
        </button>
      </div>
      
      <div className="sidebar-links">
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
    </nav>
  );
}
