import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useInspector } from '../shell/InspectorContext';

export function WorkoutDashboard({ workoutId }: { workoutId: string }) {
  const navigate = useNavigate();
  const { closeInspector } = useInspector();

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
                <span style={{ color: 'var(--text-muted)', fontSize: '14px', width: '20px', flexShrink: 0 }}>{index + 1}</span>
                <span style={{ fontSize: '14px', fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', flex: 1 }}>{ex.title}</span>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', flexShrink: 0 }}>{ex.metadata?.equipment || 'Any'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <button 
        onClick={async () => {
          const sessionId = uuidv4();
          await db.workoutSessions.add({
            id: sessionId,
            templateId: workoutId,
            date: Date.now(),
            duration: 0,
            createdAt: Date.now()
          });
          
          if (exercises && exercises.length > 0) {
            let order = 0;
            for (const ex of exercises) {
              const exSessionId = uuidv4();
              await db.exerciseSessions.add({
                id: exSessionId,
                workoutSessionId: sessionId,
                exerciseId: ex.id,
                order: order++
              });
              // Add one empty set by default
              await db.setEntries.add({
                id: uuidv4(),
                exerciseSessionId: exSessionId,
                setNumber: 1,
                reps: 0,
                weight: 0,
                completed: false
              });
            }
          }
          closeInspector();
          navigate(`/active-workout/${sessionId}`);
        }}
        style={{ marginTop: '16px', padding: '16px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'pointer' }}
      >
        Start Workout Session
      </button>

      <button style={{ padding: '12px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', marginTop: '8px' }}>
        Edit Template
      </button>

    </div>
  );
}
