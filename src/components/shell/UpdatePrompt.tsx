import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/primitives';

export function UpdatePrompt() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        setInterval(() => {
          r.update();
        }, 60 * 60 * 1000); // Check for updates every hour
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  if (!needRefresh) return null;

  return (
    <div style={{
      position: 'fixed',
      bottom: '100px',
      left: '50%',
      transform: 'translateX(-50%)',
      background: 'rgba(21, 23, 30, 0.95)',
      padding: '16px 20px',
      borderRadius: '24px',
      boxShadow: '0 12px 48px rgba(0,0,0,0.6)',
      border: '1px solid rgba(255,255,255,0.1)',
      zIndex: 9999,
      display: 'flex',
      flexDirection: 'column',
      gap: '12px',
      alignItems: 'center',
      backdropFilter: 'blur(20px)',
      width: 'max-content',
      maxWidth: '90vw'
    }}>
      <div style={{ color: '#F8FAFC', fontWeight: 600, fontSize: '15px', textAlign: 'center' }}>
        ✨ Update Available!
      </div>
      <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', maxWidth: '250px' }}>
        A new version of RKA OS is ready. Reload to apply changes.
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <Button variant="secondary" onClick={() => setNeedRefresh(false)}>
            Later
          </Button>
        </div>
        <div style={{ flex: 1, display: 'flex' }}>
          <Button variant="primary" onClick={() => updateServiceWorker(true)}>
            Reload
          </Button>
        </div>
      </div>
    </div>
  );
}
