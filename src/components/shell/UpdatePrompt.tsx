import { useRegisterSW } from 'virtual:pwa-register/react';
import { Button } from '../ui/primitives';
import { useEffect, useState, useRef } from 'react';

export function UpdatePrompt() {
  const [isIdle, setIsIdle] = useState(true);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const handleActivity = () => {
      lastActivity.current = Date.now();
      setIsIdle(false);
    };

    window.addEventListener('mousemove', handleActivity, { passive: true });
    window.addEventListener('keydown', handleActivity, { passive: true });
    window.addEventListener('touchstart', handleActivity, { passive: true });

    const interval = setInterval(() => {
      if (Date.now() - lastActivity.current > 5000) {
        setIsIdle(true);
      }
    }, 1000);

    return () => {
      window.removeEventListener('mousemove', handleActivity);
      window.removeEventListener('keydown', handleActivity);
      window.removeEventListener('touchstart', handleActivity);
      clearInterval(interval);
    };
  }, []);

  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegistered(r) {
      if (r) {
        // Check for updates every 30 seconds
        setInterval(() => {
          r.update().catch(console.error);
        }, 30 * 1000);

        // Check for updates when app becomes visible
        document.addEventListener('visibilitychange', () => {
          if (document.visibilityState === 'visible') {
            r.update().catch(console.error);
          }
        });
      }
    },
    onRegisterError(error) {
      console.error('SW registration error', error);
    },
  });

  useEffect(() => {
    if (needRefresh && isIdle) {
      updateServiceWorker(true);
    }
  }, [needRefresh, isIdle, updateServiceWorker]);

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
        ✨ Update Downloading...
      </div>
      <div style={{ color: '#94A3B8', fontSize: '13px', textAlign: 'center', maxWidth: '250px' }}>
        App will auto-refresh as soon as you are idle for 5 seconds.
      </div>
      <div style={{ display: 'flex', gap: '8px', marginTop: '4px', width: '100%' }}>
        <div style={{ flex: 1, display: 'flex' }}>
          <Button variant="primary" onClick={() => updateServiceWorker(true)}>
            Reload Now
          </Button>
        </div>
      </div>
    </div>
  );
}
