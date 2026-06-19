import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { MedicationMetadata } from '../../db/db';
import { CheckCircle2, Clock3, AlertTriangle } from 'lucide-react';
import { MetadataPill } from '../ui/primitives';

export function HomeContextBar() {
  const logs = useLiveQuery(() => db.activityLogs.reverse().toArray());
  const items = useLiveQuery(() => db.items.toArray());

  if (!logs || !items) return null;

  // Find last workout
  const workoutLogs = logs.filter(l => l.actionType === 'workout-session');
  let lastWorkoutText = 'No recent workouts';
  let workoutColor = 'var(--text-muted)';
  if (workoutLogs.length > 0) {
    const lastWorkout = workoutLogs[0];
    const item = items.find(i => i.id === lastWorkout.entityId);
    if (item) {
      const daysAgo = Math.floor((Date.now() - lastWorkout.timestamp) / (1000 * 60 * 60 * 24));
      if (daysAgo === 0) {
        lastWorkoutText = `${item.title} completed today`;
        workoutColor = '#10B981';
      } else if (daysAgo === 1) {
        lastWorkoutText = `${item.title} completed yesterday`;
        workoutColor = '#10B981';
      } else {
        lastWorkoutText = `${item.title} - ${daysAgo} days ago`;
      }
    }
  }

  // Find recent medication
  const medLogs = logs.filter(l => l.actionType === 'medication-taken');
  let medText = 'Medication pending';
  let medColor = 'var(--text-muted)';
  if (medLogs.length > 0) {
    const lastMed = medLogs[0];
    const item = items.find(i => i.id === lastMed.entityId);
    if (item) {
      const hoursAgo = Math.floor((Date.now() - lastMed.timestamp) / (1000 * 60 * 60));
      if (hoursAgo < 24) {
        medText = `Last ${item.title} taken ${hoursAgo}h ago`;
        medColor = '#3B82F6';
      } else {
        const daysAgo = Math.floor(hoursAgo / 24);
        medText = `Last ${item.title} taken ${daysAgo}d ago`;
      }
    }
  }

  // Check for refill alerts
  const meds = items.filter(i => i.type === 'medication');
  let refillAlertText = '';
  const lowMeds = meds.filter(m => {
    const meta = m.metadata as MedicationMetadata;
    return meta.stockRemaining !== undefined && meta.stockRemaining <= (meta.refillThreshold || 5);
  });
  if (lowMeds.length > 0) {
    refillAlertText = `${lowMeds[0].title} refill due soon`;
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', overflowX: 'auto', paddingBottom: '4px', scrollbarWidth: 'none', msOverflowStyle: 'none', flexWrap: 'wrap' }}>
      <MetadataPill
        label={lastWorkoutText}
        icon={<CheckCircle2 size={12} />}
        tone={workoutColor === '#10B981' ? 'green' : 'gray'}
      />
      <MetadataPill
        label={medText}
        icon={<Clock3 size={12} />}
        tone={medColor === '#3B82F6' ? 'blue' : 'gray'}
      />
      {refillAlertText && (
        <MetadataPill
          label={refillAlertText}
          icon={<AlertTriangle size={12} />}
          tone="red"
        />
      )}
    </div>
  );
}
