import { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { Home, Calendar, FolderKanban, Plus, LogOut, User, Pill, Dumbbell, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { useAuth } from '../../auth/AuthProvider';
import { getSyncStatus, type SyncStatus } from '../../data/sync';
import './shell.css';

import { AppInfoModal } from './AppInfoModal';

interface SidebarNavProps {
  onQuickAdd: () => void;
}

export function SidebarNav({ onQuickAdd }: SidebarNavProps) {
  const { user, logout, localMode } = useAuth();
  const navigate = useNavigate();
  const [showAppInfo, setShowAppInfo] = useState(false);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(getSyncStatus());
  const accountLabel = user?.user_metadata?.name || user?.user_metadata?.full_name || user?.email || 'Signed in';

  useEffect(() => {
    const handleStatus = (e: any) => setSyncStatus(e.detail);
    window.addEventListener('rka-sync-status', handleStatus);
    
    const handleOnline = () => setSyncStatus('idle');
    const handleOffline = () => setSyncStatus('offline');
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('rka-sync-status', handleStatus);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <>
    <nav className="sidebar-nav">
      <div className="sidebar-header">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '24px', paddingLeft: '12px', paddingRight: '4px' }}>
          <button 
            className="sidebar-logo" 
            onClick={() => setShowAppInfo(true)}
            style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', outline: 'none', marginBottom: 0 }}
          >
            RKA OS
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: 'var(--rka-text-secondary)', fontWeight: 600 }}>
            {syncStatus === 'offline' && <><CloudOff size={12} /> Offline</>}
            {syncStatus === 'syncing' && <><RefreshCw size={12} className="spin" /> Syncing</>}
            {syncStatus === 'error' && <><CloudOff size={12} color="var(--rka-red)" /> Error</>}
            {syncStatus === 'idle' && <><CheckCircle2 size={12} color="var(--rka-green)" /> Synced</>}
          </div>
        </div>
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
