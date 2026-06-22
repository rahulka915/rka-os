import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { MedicationMetadata } from '../../db/db';
import { PlayCircle, CheckCircle2, AlertTriangle } from 'lucide-react';
import { Button } from '../ui/primitives';

interface MedicationDashboardProps {
  medicationId: string;
}

export function MedicationDashboard({ medicationId }: MedicationDashboardProps) {
  const [isLogging, setIsLogging] = useState(false);

  const medication = useLiveQuery(() => db.items.get(medicationId), [medicationId]);
  const logs = useLiveQuery(
    () => db.activityLogs.where('entityId').equals(medicationId).toArray(),
    [medicationId]
  );

  if (!medication) return null;

  const metadata = (medication.metadata || {}) as MedicationMetadata;
  const maxPerDay = metadata.maxPerDay;
  const minHours = metadata.minHoursBetweenDoses;

  const medLogs = (logs || []).filter(l => l.actionType === 'medication-taken').sort((a, b) => b.timestamp - a.timestamp);
  
  // Calculate constraints
  const now = Date.now();
  const twentyFourHoursAgo = now - (24 * 60 * 60 * 1000);
  
  const dosesLast24h = medLogs.filter(l => l.timestamp >= twentyFourHoursAgo).length;
  const lastDose = medLogs[0];
  const hoursSinceLastDose = lastDose ? (now - lastDose.timestamp) / (1000 * 60 * 60) : Infinity;

  const isOverDailyLimit = maxPerDay !== undefined && dosesLast24h >= maxPerDay;
  const isTooSoon = minHours !== undefined && hoursSinceLastDose < minHours;
  const isLocked = isOverDailyLimit || isTooSoon;

  const handleLogDose = async (startTimer: boolean) => {
    if (isLocked) return;
    setIsLogging(true);
    try {
      const dose = metadata.dose || '1 dose';

      await db.activityLogs.add({
        id: crypto.randomUUID(),
        entityId: medicationId,
        actionType: 'medication-taken',
        timestamp: Date.now(),
        createdAt: Date.now(),
        updatedAt: Date.now(),
        details: {
          dose,
          timerActive: startTimer,
          startedAt: startTimer ? Date.now() : undefined,
        }
      });
    } catch (e) {
      console.error(e);
    } finally {
      setIsLogging(false);
    }
  };

  return (
    <div className="medication-dashboard" style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '8px' }}>
      
      {isLocked && (
        <div style={{ background: 'var(--rka-red-soft)', color: 'var(--rka-red)', padding: '12px 16px', borderRadius: '12px', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
          <AlertTriangle size={20} style={{ flexShrink: 0, marginTop: '2px' }} />
          <div>
            <div style={{ fontWeight: 600, fontSize: '14px', marginBottom: '4px' }}>Medication Locked</div>
            <div style={{ fontSize: '13px', opacity: 0.9 }}>
              {isOverDailyLimit 
                ? `You have reached your daily limit of ${maxPerDay} dose${maxPerDay === 1 ? '' : 's'} in the last 24 hours.`
                : `You must wait at least ${minHours} hours between doses. (It has only been ${hoursSinceLastDose.toFixed(1)}h)`}
            </div>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: '12px' }}>
        <div style={{ flex: 1 }}>
          <Button 
            variant="secondary" 
            onClick={() => handleLogDose(false)}
            disabled={isLogging || isLocked}
          >
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center' }}>
              <CheckCircle2 size={18} /> Log Dose
            </span>
          </Button>
        </div>
        <div style={{ flex: 1 }}>
          <Button 
            variant="primary" 
            onClick={() => handleLogDose(true)}
            disabled={isLogging || isLocked}
          >
            <span style={{ display: 'flex', gap: '8px', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
              <PlayCircle size={18} /> Start Timer
            </span>
          </Button>
        </div>
      </div>

      <div style={{ marginTop: '24px' }}>
        <h3 style={{ fontSize: '15px', fontWeight: 600, marginBottom: '12px', color: 'var(--rka-text)' }}>History</h3>
        {medLogs.length === 0 ? (
          <div style={{ padding: '16px', background: 'var(--rka-surface)', borderRadius: '12px', textAlign: 'center', color: 'var(--rka-text-secondary)', fontSize: '14px' }}>
            No doses logged yet.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {medLogs.slice(0, 10).map((log) => {
              const date = new Date(log.timestamp);
              const isToday = new Date().toDateString() === date.toDateString();
              const dateStr = isToday ? 'Today' : date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
              const timeStr = date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
              
              return (
                <div key={log.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', background: 'var(--rka-surface)', border: '1px solid var(--rka-border)', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    <span style={{ fontSize: '14px', fontWeight: 500, color: 'var(--rka-text)' }}>{log.details?.dose || '1 dose'}</span>
                    <span style={{ fontSize: '12px', color: 'var(--rka-text-secondary)' }}>{dateStr} at {timeStr}</span>
                  </div>
                  {log.details?.timerActive && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--rka-blue)', background: 'var(--rka-blue-soft)', padding: '4px 8px', borderRadius: '12px', fontWeight: 500 }}>
                      <PlayCircle size={12} /> Timer
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
