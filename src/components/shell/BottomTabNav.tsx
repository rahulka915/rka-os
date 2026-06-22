import { NavLink } from 'react-router-dom';
import { Home, Calendar, FolderOpen, Plus, Heart, CircleUserRound } from 'lucide-react';

interface BottomTabNavProps {
  onQuickAdd: () => void;
}

export function BottomTabNav({ onQuickAdd }: BottomTabNavProps) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/home" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Home size={22} strokeWidth={1.5} />
        <span style={{ fontSize: '10px', marginTop: '4px' }}>Today</span>
      </NavLink>

      <NavLink to="/calendar" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Calendar size={22} strokeWidth={1.5} />
        <span style={{ fontSize: '10px', marginTop: '4px' }}>Calendar</span>
      </NavLink>

      <div className="fab-container">
        <button className="fab-button" onClick={onQuickAdd} aria-label="Quick Add">
          <Plus size={24} strokeWidth={2} />
        </button>
      </div>

      <NavLink to="/projects" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <FolderOpen size={22} strokeWidth={1.5} />
        <span style={{ fontSize: '10px', marginTop: '4px' }}>Projects</span>
      </NavLink>

      <NavLink to="/health-search" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Heart size={22} strokeWidth={1.5} />
        <span style={{ fontSize: '10px', marginTop: '4px' }}>Health</span>
      </NavLink>

      <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <CircleUserRound size={22} strokeWidth={1.5} />
        <span style={{ fontSize: '10px', marginTop: '4px' }}>Me</span>
      </NavLink>
    </nav>
  );
}
