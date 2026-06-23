import { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, Plus, CircleUserRound, LayoutGrid, FolderKanban, Dumbbell, Pill } from 'lucide-react';
import { BottomSheet, ListRow } from '../ui/primitives';
import { haptics } from '../../utils/haptics';

interface BottomTabNavProps {
  onQuickAdd: () => void;
}

export function BottomTabNav({ onQuickAdd }: BottomTabNavProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const navigate = useNavigate();

  const handleMenuNavigate = (path: string) => {
    navigate(path);
    setMenuOpen(false);
  };

  return (
    <>
      <nav className="bottom-nav">
        <NavLink to="/home" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
          <Home size={22} strokeWidth={1.5} />
          <span style={{ fontSize: '10px', marginTop: '4px' }}>Home</span>
        </NavLink>

        <NavLink to="/calendar" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
          <Calendar size={22} strokeWidth={1.5} />
          <span style={{ fontSize: '10px', marginTop: '4px' }}>Calendar</span>
        </NavLink>

        <div className="fab-container">
          <button className="fab-button active-scale" onClick={() => { haptics.medium(); onQuickAdd(); }} aria-label="Quick Add">
            <Plus size={24} strokeWidth={2} />
          </button>
        </div>

        <button className="nav-item active-scale" onClick={() => { haptics.light(); setMenuOpen(true); }} style={{ background: 'none', border: 'none', cursor: 'pointer' }}>
          <LayoutGrid size={22} strokeWidth={1.5} />
          <span style={{ fontSize: '10px', marginTop: '4px' }}>Menu</span>
        </button>

        <NavLink to="/profile" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
          <CircleUserRound size={22} strokeWidth={1.5} />
          <span style={{ fontSize: '10px', marginTop: '4px' }}>Me</span>
        </NavLink>
      </nav>

      {menuOpen && (
        <BottomSheet open title="Apps" onDismiss={() => setMenuOpen(false)}>
          <div className="rka-list" style={{ paddingBottom: '16px' }}>
            <ListRow
              title="Projects"
              subtitle="Manage your projects and tasks"
              leading={<FolderKanban size={18} />}
              onClick={() => handleMenuNavigate('/projects')}
            />
            <ListRow
              title="Workouts"
              subtitle="Templates and exercise library"
              leading={<Dumbbell size={18} />}
              onClick={() => handleMenuNavigate('/workouts')}
            />
            <ListRow
              title="Medications"
              subtitle="Inventory and schedules"
              leading={<Pill size={18} />}
              onClick={() => handleMenuNavigate('/medications')}
            />
          </div>
        </BottomSheet>
      )}
    </>
  );
}
