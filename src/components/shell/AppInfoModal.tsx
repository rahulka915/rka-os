import { Info } from 'lucide-react';
import { BottomSheet } from '../ui/primitives';

interface AppInfoModalProps {
  onClose: () => void;
}

export function AppInfoModal({ onClose }: AppInfoModalProps) {
  const buildDate = new Date(__BUILD_TIME__);
  const formattedDate = buildDate.toLocaleDateString(undefined, { 
    weekday: 'short', 
    month: 'short', 
    day: 'numeric',
    year: 'numeric'
  });
  const formattedTime = buildDate.toLocaleTimeString(undefined, {
    hour: 'numeric',
    minute: '2-digit',
    second: '2-digit'
  });

  return (
    <BottomSheet open title="App Info" onDismiss={onClose}>
      <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
        <div style={{ width: '64px', height: '64px', background: 'var(--rka-primary)', color: 'white', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', fontWeight: 700 }}>
          RKA
        </div>
        
        <div style={{ textAlign: 'center' }}>
          <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: 'var(--rka-text)' }}>RKA OS</h2>
          <p style={{ margin: '4px 0 0', fontSize: '14px', color: 'var(--rka-text-secondary)' }}>v{__APP_VERSION__}</p>
        </div>

        <div style={{ width: '100%', background: 'var(--rka-surface)', borderRadius: '12px', padding: '16px', marginTop: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '12px', color: 'var(--rka-text-secondary)', fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
            <Info size={16} /> Last Deployed
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <div style={{ fontSize: '15px', color: 'var(--rka-text)', fontWeight: 500 }}>{formattedDate}</div>
            <div style={{ fontSize: '14px', color: 'var(--rka-text-secondary)' }}>at {formattedTime}</div>
          </div>
        </div>
      </div>
    </BottomSheet>
  );
}
