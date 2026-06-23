import { useState, useEffect } from 'react';
import { CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { getSyncStatus, type SyncStatus } from '../../data/sync';

export function AppHeader() {
  const [status, setStatus] = useState<SyncStatus>(getSyncStatus());

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
    <div className="app-header-container hide-on-desktop">
      <div className="hide-on-desktop" style={{ fontWeight: 800, fontSize: '18px', letterSpacing: '-0.5px' }}>
        RKA OS
      </div>
      
      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: 'var(--rka-text-secondary)', fontWeight: 600 }}>
        {status === 'offline' && <><CloudOff size={14} /> Offline</>}
        {status === 'syncing' && <><RefreshCw size={14} className="spin" /> Syncing</>}
        {status === 'error' && <><CloudOff size={14} color="var(--rka-red)" /> Error</>}
        {status === 'idle' && <><CheckCircle2 size={14} color="var(--rka-green)" /> Synced</>}
      </div>
    </div>
  );
}
