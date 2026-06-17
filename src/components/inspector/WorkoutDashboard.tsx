import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';

export function WorkoutDashboard({ workoutId }: { workoutId: string }) {
  const exercises = useLiveQuery(async () => {
    const links = await db.entityLinks.where({ sourceId: workoutId, linkType: 'includes_exercise' }).toArray();
    const itemIds = links.map(l => l.targetId);
    return db.items.where('id').anyOf(itemIds).toArray();
  }, [workoutId]);

  if (!exercises) return null;

  // Calculate target muscles
  const muscleSet = new Set<string>();
  exercises.forEach(ex => {
    const m = ex.metadata?.muscles || [];
    m.forEach((muscle: string) => muscleSet.add(muscle));
  });
  const targetMuscles = Array.from(muscleSet);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '24px' }}>
      
      {targetMuscles.length > 0 && (
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Target Muscles</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
            {targetMuscles.map(m => (
              <Pill key={m} label={m} variant="solid" color="#10B981" />
            ))}
          </div>
        </div>
      )}

      {exercises.length > 0 && (
        <div>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Exercises ({exercises.length})</span>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {exercises.map((ex, index) => (
              <div key={ex.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '8px 0', borderBottom: '1px solid var(--border-color)' }}>
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', width: '20px' }}>{index + 1}</span>
                <span style={{ fontSize: '14px', fontWeight: 500 }}>{ex.title}</span>
                <span style={{ marginLeft: 'auto', fontSize: '12px', color: 'var(--text-muted)' }}>{ex.metadata?.equipment || 'Any'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button style={{ marginTop: '16px', padding: '12px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '8px', fontWeight: 600, cursor: 'pointer' }}>
        Start Workout Session
      </button>

    </div>
  );
}
