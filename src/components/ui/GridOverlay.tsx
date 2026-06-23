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
      gridTemplateColumns: 'repeat(12, 1fr)',
      gap: '16px',
      padding: '0 16px'
    }}>
      {Array.from({ length: 12 }).map((_, i) => (
        <div key={i} style={{ background: 'rgba(255, 0, 0, 0.05)', height: '100%' }} />
      ))}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'repeating-linear-gradient(transparent, transparent 7px, rgba(0,0,255,0.05) 7px, rgba(0,0,255,0.05) 8px)' }} />
    </div>
  );
}
