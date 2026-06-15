import { NavLink } from 'react-router-dom';
import { Calendar, Repeat, Plus, Activity, Dumbbell } from 'lucide-react';

interface BottomTabNavProps {
  onQuickAdd: () => void;
}

export function BottomTabNav({ onQuickAdd }: BottomTabNavProps) {
  return (
    <nav className="bottom-nav">
      <NavLink to="/today" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Calendar size={20} />
        <span>Today</span>
      </NavLink>

      <NavLink to="/workouts" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Dumbbell size={20} />
        <span>Workouts</span>
      </NavLink>

      <div className="fab-container">
        <button className="fab-button" onClick={onQuickAdd} aria-label="Quick Add">
          <Plus size={28} />
        </button>
      </div>

      <NavLink to="/habits" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Repeat size={20} />
        <span>Habits</span>
      </NavLink>

      <NavLink to="/health" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Activity size={20} />
        <span>Health</span>
      </NavLink>
    </nav>
  );
}
