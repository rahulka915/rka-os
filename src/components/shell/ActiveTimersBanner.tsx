import { useState, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { StopCircle, Pill as PillIcon } from 'lucide-react';
import './active-timers.css';

export function ActiveTimersBanner() {
  const [now, setNow] = useState(Date.now());

  // Force re-render every minute to update elapsed time
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
    
    // Enrich with medication title and metadata
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
        log.details.timerActive = false; // Auto-stop timer when done
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

  return (
    <div className="active-timers-container">
      <div 
        className="active-timer-banner" 
        style={{ 
          flexDirection: 'column', 
          alignItems: 'stretch', 
          gap: activeTimers.length > 1 ? '12px' : '0' 
        }}
      >
        {activeTimers.length > 1 && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid rgba(255,255,255,0.2)', paddingBottom: '12px', marginBottom: '4px' }}>
            <PillIcon size={16} style={{ opacity: 0.9 }} />
            <span style={{ fontWeight: 700, fontSize: '14px' }}>{activeTimers.length} Active Medications</span>
          </div>
        )}

        {activeTimers.map(({ log, med }) => {
          const start = log.details.startedAt;
          
          // Stopwatch logic (elapsed time)
          const elapsedMs = now - start;
          const elapsedMins = Math.floor(elapsedMs / 60000);
          const hours = Math.floor(elapsedMins / 60);
          const mins = elapsedMins % 60;
          
          let timeStr = '';
          if (hours > 0) timeStr += `${hours}h `;
          timeStr += `${mins}m elapsed`;

          const minHours = med?.metadata?.minHoursBetweenDoses;
          let isReadyForNext = false;
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
  );
}
