import { useState, useEffect } from 'react';

export function GridOverlay() {
  const [enabled, setEnabled] = useState(() => localStorage.getItem('rka_grid_overlay') === 'true');

  useEffect(() => {
    const handleToggle = () => {
      setEnabled(localStorage.getItem('rka_grid_overlay') === 'true');
    };
    window.addEventListener('rka-grid-toggle', handleToggle);
    return () => window.removeEventListener('rka-grid-toggle', handleToggle);
  }, []);

  if (!enabled) return null;

  return (
    <div style={{
      position: 'fixed',
      top: 0, left: 0, right: 0, bottom: 0,
      pointerEvents: 'none',
      zIndex: 9999,
      display: 'grid',
      gridTemplateColumns: 'repeat(4, 1fr)',
      gap: '16px',
      padding: '0 16px',
      alignItems: 'stretch'
    }}>
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(255, 0, 0, 0.05)', height: '100%' }} />
      ))}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(transparent, transparent 7px, rgba(0,100,255,0.08) 7px, rgba(0,100,255,0.08) 8px)' }} />
    </div>
  );
}
