import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';

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
      } else {
        lastWorkoutText = `${item.title} - ${daysAgo} day${daysAgo > 1 ? 's' : ''} ago`;
      }
    }
  }

  // Find recent medication
  const medLogs = logs.filter(l => l.actionType === 'medication-taken');
  let medText = 'Medication pending';
  let medColor = 'var(--text-muted)';
  if (medLogs.length > 0) {
    const lastMed = medLogs[0];
    const isToday = new Date(lastMed.timestamp).toDateString() === new Date().toDateString();
    if (isToday) {
      medText = 'Medication logged today';
      medColor = '#3B82F6';
    }
  }

  return (
    <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
      <Pill label={`💪 ${lastWorkoutText}`} variant="outline" color={workoutColor} />
      <Pill label={`💊 ${medText}`} variant="outline" color={medColor} />
    </div>
  );
}
