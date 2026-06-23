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
      <nav className="bottom-nav" aria-label="Primary navigation">
        <div className="bottom-nav__content">
          <NavLink to="/home" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
            <Home size={22} strokeWidth={1.5} />
            <span className="nav-label">Home</span>
          </NavLink>

          <NavLink to="/calendar" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
            <Calendar size={22} strokeWidth={1.5} />
            <span className="nav-label">Calendar</span>
          </NavLink>

          <div className="fab-container">
            <button
              type="button"
              className="fab-button active-scale"
              onClick={() => {
                haptics.medium();
                const input = document.getElementById('global-quick-capture-input');
                if (input) input.focus();
                onQuickAdd();
              }}
              aria-label="Quick Add"
            >
              <Plus size={24} strokeWidth={2} />
            </button>
          </div>

          <button
            type="button"
            className="nav-item nav-button active-scale"
            onClick={() => {
              haptics.light();
              setMenuOpen(true);
            }}
          >
            <LayoutGrid size={22} strokeWidth={1.5} />
            <span className="nav-label">Menu</span>
          </button>

          <NavLink to="/profile" className={({ isActive }) => `nav-item active-scale ${isActive ? 'active' : ''}`} onClick={() => haptics.light()}>
            <CircleUserRound size={22} strokeWidth={1.5} />
            <span className="nav-label">Me</span>
          </NavLink>
        </div>
        <div className="bottom-nav__safe-area" aria-hidden="true" />
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
