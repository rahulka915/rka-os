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

  const activeTimers = useLiveQuery(async () => {
    const logs = await db.activityLogs.where('actionType').equals('medication-taken').toArray();
    const active = logs.filter(log => log.details?.timerActive === true && log.details?.startedAt);
    
    // Enrich with medication title
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

  if (!activeTimers || activeTimers.length === 0) return null;

  return (
    <div className="active-timers-container">
      {activeTimers.map(({ log, med }) => {
        const start = log.details.startedAt;
        const elapsedMs = now - start;
        const elapsedMins = Math.floor(elapsedMs / 60000);
        const hours = Math.floor(elapsedMins / 60);
        const mins = elapsedMins % 60;
        
        let timeStr = '';
        if (hours > 0) timeStr += `${hours}h `;
        timeStr += `${mins}m`;

        return (
          <div key={log.id} className="active-timer-banner">
            <div className="active-timer-info">
              <PillIcon size={16} className="active-timer-icon" />
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
  );
}
