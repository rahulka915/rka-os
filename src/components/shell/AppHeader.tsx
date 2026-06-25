import { useState, useEffect } from 'react';
import { CloudOff, RefreshCw, CheckCircle2, CircleUserRound } from 'lucide-react';
import { NavLink } from 'react-router-dom';
import { getSyncStatus, type SyncStatus } from '../../data/sync';
import { VersionHistoryModal } from '../ui/VersionHistoryModal';
import { haptics } from '../../utils/haptics';

export function AppHeader() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());
  const [isVersionModalOpen, setIsVersionModalOpen] = useState(false);

  useEffect(() => {
    const handleStatus = (e: any) => setStatus(e.detail);
    window.addEventListener('rka-sync-status', handleStatus);
    
    // Also listen to online/offline native events
    const handleOnline = () => setStatus('idle');
    const handleOffline = () => setStatus('offline');
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
      <VersionHistoryModal isOpen={isVersionModalOpen} onClose={() => setIsVersionModalOpen(false)} />
      <div className="app-header-container hide-on-desktop" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <NavLink
          to="/profile"
          className={({ isActive }) => `${isActive ? 'active' : ''}`}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '44px', height: '44px', cursor: 'pointer' }}
          onClick={() => haptics.light()}
        >
          <CircleUserRound size={24} strokeWidth={1.5} />
        </NavLink>

        <div
          style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px', cursor: 'pointer' }}
          onClick={() => setIsVersionModalOpen(true)}
        >
          RKA OS
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--rka-text-secondary)', fontWeight: 600 }}>
          {status === 'offline' && <><CloudOff size={14} /> Offline</>}
          {status === 'syncing' && <><RefreshCw size={14} className="spin" /> Syncing</>}
          {status === 'error' && <><CloudOff size={14} color="var(--rka-red)" /> Error</>}
          {status === 'idle' && <><CheckCircle2 size={14} color="var(--rka-green)" /> Synced</>}
        </div>
      </div>
    </>
  );
}
