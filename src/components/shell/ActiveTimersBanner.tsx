import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { StopCircle, Pill as PillIcon, GripHorizontal, ChevronDown } from 'lucide-react';
import './active-timers.css';

export function ActiveTimersBanner() {
  const [now, setNow] = useState(Date.now());

  const [position, setPosition] = useState<{x: number, y: number}>(() => {
    const saved = localStorage.getItem('rka_timer_pos');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) {}
    }
    return { x: 20, y: window.innerHeight - 150 };
  });

  const [isMinimized, setIsMinimized] = useState(() => {
    return localStorage.getItem('rka_timer_min') === 'true';
  });

  const isDragging = useRef(false);
  const dragStart = useRef({ x: 0, y: 0 });
  const initialPos = useRef({ x: 0, y: 0 });

  useEffect(() => {
    localStorage.setItem('rka_timer_pos', JSON.stringify(position));
  }, [position]);

  useEffect(() => {
    localStorage.setItem('rka_timer_min', isMinimized.toString());
  }, [isMinimized]);

  const onPointerDown = (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
    isDragging.current = true;
    dragStart.current = { x: e.clientX, y: e.clientY };
    initialPos.current = { ...position };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragStart.current.x;
    const dy = e.clientY - dragStart.current.y;
    setPosition({
      x: initialPos.current.x + dx,
      y: initialPos.current.y + dy
    });
  };

  const onPointerUp = (e: React.PointerEvent) => {
    if (!isDragging.current) return;
    isDragging.current = false;
    (e.target as HTMLElement).releasePointerCapture(e.pointerId);
    
    setPosition((prev: {x: number, y: number}) => {
       const padding = 16;
       let nx = prev.x;
       let ny = prev.y;
       if (nx < padding) nx = padding;
       if (ny < padding) ny = padding;
       if (nx > window.innerWidth - 60) nx = window.innerWidth - 60;
       if (ny > window.innerHeight - 80) ny = window.innerHeight - 80;
       return { x: nx, y: ny };
    });
  };

  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission().catch(console.error);
    }
  }, []);

  const activeTimers = useLiveQuery(async () => {
    const logs = await db.activityLogs.where('actionType').equals('medication-taken').toArray();
    const active = logs.filter(log => log.details?.timerActive === true && log.details?.startedAt);
    const enriched = await Promise.all(active.map(async (log) => {
      const med = await db.items.get(log.entityId);
      return { log, med };
    }));
    return enriched;
  });

  const handleStopTimer = async (logId: string) => {
    try {
      const log = await db.activityLogs.get(logId);
      if (log && log.details) {
        log.details.timerActive = false;
        log.details.stoppedAt = Date.now();
        await db.activityLogs.put(log);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const markNotified = async (logId: string) => {
    try {
      const log = await db.activityLogs.get(logId);
      if (log && log.details && !log.details.notified) {
        log.details.notified = true;
        await db.activityLogs.put(log);
      }
    } catch (e) {}
  };

  useEffect(() => {
    if (!activeTimers) return;
    activeTimers.forEach(({ log, med }) => {
      const start = log.details?.startedAt;
      if (!start) return;
      const minHours = med?.metadata?.minHoursBetweenDoses;
      if (minHours) {
        const target = start + (minHours * 60 * 60 * 1000);
        if (now >= target && !log.details.notified) {
          if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Medication Reminder', {
              body: `It has been ${minHours}h. You can now take your next dose of ${med?.title || 'medication'}.`,
              icon: '/vite.svg'
            });
          }
          markNotified(log.id);
        }
      }
    });
  }, [now, activeTimers]);

  if (!activeTimers || activeTimers.length === 0) return null;

  const firstTimer = activeTimers[0];
  const firstElapsedMs = now - firstTimer.log.details.startedAt;
  const firstElapsedMins = Math.floor(firstElapsedMs / 60000);
  const firstH = Math.floor(firstElapsedMins / 60);
  const firstM = firstElapsedMins % 60;
  const firstTimeStr = firstH > 0 ? `${firstH}h ${firstM}m` : `${firstM}m`;

  return (
    <div 
      className="active-timer-widget"
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`
      }}
    >
      {isMinimized ? (
        <div className="active-timer-pill">
          <div 
            className="active-timer-drag-handle"
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerUp}
            onPointerCancel={onPointerUp}
          >
            <GripHorizontal size={16} />
          </div>
          <div className="active-timer-pill-content" onClick={() => setIsMinimized(false)}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
               <PillIcon size={18} color="var(--rka-red)" />
               <div style={{ display: 'flex', flexDirection: 'column' }}>
                 <span style={{ fontSize: '13px', fontWeight: 700, lineHeight: 1.2 }}>{firstTimeStr} elapsed</span>
                 {activeTimers.length > 1 && (
                   <span style={{ fontSize: '11px', color: 'var(--rka-text-secondary)' }}>+{activeTimers.length - 1} more</span>
                 )}
               </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="active-timer-banner">
          <div className="active-timer-header">
            <div 
              className="active-timer-drag-handle"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            >
              <GripHorizontal size={20} />
            </div>
            <button 
              className="active-timer-minimize rka-icon-button"
              onClick={() => setIsMinimized(true)}
              aria-label="Minimize"
            >
              <ChevronDown size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: activeTimers.length > 1 ? '12px' : '0' }}>
            {activeTimers.length > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px', marginBottom: '4px' }}>
                <PillIcon size={16} style={{ opacity: 0.9 }} />
                <span style={{ fontWeight: 700, fontSize: '14px' }}>{activeTimers.length} Active Medications</span>
              </div>
            )}

            {activeTimers.map(({ log, med }) => {
              const start = log.details.startedAt;
              const elapsedMs = now - start;
              const elapsedMins = Math.floor(elapsedMs / 60000);
              const hours = Math.floor(elapsedMins / 60);
              const mins = elapsedMins % 60;
              let timeStr = '';
              if (hours > 0) timeStr += `${hours}h `;
              timeStr += `${mins}m elapsed`;
              
              let isReadyForNext = false;
              const minHours = med?.metadata?.minHoursBetweenDoses;
              if (minHours) {
                const target = start + (minHours * 60 * 60 * 1000);
                if (now >= target) isReadyForNext = true;
              }

              return (
                <div key={log.id} className={isReadyForNext ? 'is-ready' : ''} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div className="active-timer-info">
                    {activeTimers.length === 1 && <PillIcon size={16} className="active-timer-icon" />}
                    <div className="active-timer-text">
                      <span className="active-timer-title">{med?.title || 'Unknown Medication'}</span>
                      <span className="active-timer-duration">Active for {timeStr}</span>
                    </div>
                  </div>
                  <button 
                    className="active-timer-stop rka-icon-button"
                    onClick={() => handleStopTimer(log.id)}
                    aria-label="Stop Timer"
                  >
                    <StopCircle size={20} /> Stop
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
