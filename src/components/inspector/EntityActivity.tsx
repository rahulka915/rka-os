import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Dumbbell, Pill as PillIcon, CheckCircle2, Clock } from 'lucide-react';

export function EntityActivity({ entityId }: { entityId: string }) {
  const logs = useLiveQuery(
    () => db.activityLogs.where('entityId').equals(entityId).reverse().toArray(),
    [entityId]
  );

  if (!logs || logs.length === 0) {
    return <div className="text-muted" style={{ fontSize: '14px', fontStyle: 'italic' }}>No activity recorded yet.</div>;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {logs.map(log => {
        const date = new Date(log.timestamp);
        const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

        if (log.actionType === 'workout-session' && log.details?.sessionId) {
          const durationStr = log.details.duration ? `${Math.floor(log.details.duration / 60)} min` : '';
          const volumeStr = log.details.volume ? `${log.details.volume}kg Volume` : '';

          return (
            <div key={log.id} style={{ display: 'flex', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ background: 'var(--accent-color)', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <Dumbbell size={18} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>Completed Session</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{dateStr}</span>
                </div>
                
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '13px', color: 'var(--accent-color)', marginBottom: '12px' }}>
                  {durationStr && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                      <Clock size={12} />
                      <span>{durationStr}</span>
                    </div>
                  )}
                  {volumeStr && (
                    <span style={{ background: 'rgba(255,149,0,0.1)', padding: '2px 6px', borderRadius: '4px' }}>{volumeStr}</span>
                  )}
                </div>

                <div style={{ display: 'flex', gap: '8px' }}>
                  <button style={{ flex: 1, padding: '8px', background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: 'none', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
                    View Session
                  </button>
                </div>
              </div>
            </div>
          );
        }

        if (log.actionType === 'medication-taken') {
          return (
            <div key={log.id} style={{ display: 'flex', gap: '12px', background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <div style={{ background: '#10B981', color: '#fff', width: '36px', height: '36px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                <PillIcon size={18} />
              </div>
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                  <span style={{ fontWeight: 600, color: '#fff', fontSize: '15px' }}>Medication Taken</span>
                  <span style={{ fontSize: '13px', color: 'var(--text-muted)', marginLeft: '12px' }}>{dateStr} at {timeStr}</span>
                </div>
                {log.details?.dose && (
                  <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>Dose: <span style={{ color: '#fff' }}>{log.details.dose}</span></div>
                )}
              </div>
            </div>
          );
        }

        // Generic fallback for status-changed, created, etc.
        return (
          <div key={log.id} style={{ display: 'flex', gap: '12px', fontSize: '14px', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-muted)', minWidth: '90px' }}>
              {dateStr} {timeStr}
            </div>
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', gap: '6px' }}>
              <CheckCircle2 size={14} color="var(--text-muted)" />
              <span style={{ fontWeight: 500, color: '#fff', textTransform: 'capitalize' }}>{log.actionType.replace('-', ' ')}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
