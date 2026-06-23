import { useState, useEffect } from 'react';
import './actions.css';

export function CurrentTimeIndicator() {
  const [timeStr, setTimeStr] = useState('');

  useEffect(() => {
    const update = () => {
      setTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
    };
    update();
    const interval = setInterval(update, 30000); // update every 30s
    return () => clearInterval(interval);
  }, []);

  return (
    <div style={{ display: 'flex', alignItems: 'center', margin: '4px 0', opacity: 0.9 }}>
      <div style={{ color: 'var(--rka-red)', fontSize: '12px', fontWeight: 700, width: '56px', flexShrink: 0 }}>
        {timeStr}
      </div>
      <div style={{ flex: 1, height: '2px', background: 'var(--rka-red)', borderRadius: '1px', position: 'relative' }}>
        <div style={{ position: 'absolute', left: '-5px', top: '-3.5px', width: '9px', height: '9px', borderRadius: '50%', background: 'var(--rka-red)' }} />
      </div>
    </div>
  );
}
