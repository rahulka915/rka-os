import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const data = useLiveQuery(async () => {
    const exercise = await db.items.get(exerciseId);
    if (!exercise) return null;

    const sessions = await db.exerciseSessions.where({ exerciseId }).toArray();
    
    // Get all sets for these sessions
    const sessionIds = sessions.map(s => s.id);
    const sets = await db.setEntries.where('exerciseSessionId').anyOf(sessionIds).toArray();
    
    // Get parent workout sessions to get the dates
    const workoutSessionIds = [...new Set(sessions.map(s => s.workoutSessionId))];
    const workouts = await db.workoutSessions.where('id').anyOf(workoutSessionIds).toArray();
    
    // Calculate stats
    let maxWeight = 0;
    let maxWeightReps = 0;
    let totalCompletedSets = 0;
    
    sets.forEach(set => {
      if (set.completed) {
        totalCompletedSets++;
        if (set.weight > maxWeight) {
          maxWeight = set.weight;
          maxWeightReps = set.reps;
        } else if (set.weight === maxWeight && set.reps > maxWeightReps) {
          maxWeightReps = set.reps;
        }
      }
    });

    // Group history
    const history = workouts.map(ws => {
      const exSession = sessions.find(s => s.workoutSessionId === ws.id);
      if (!exSession) return null;
      const exSets = sets.filter(s => s.exerciseSessionId === exSession.id && s.completed);
      if (exSets.length === 0) return null;
      
      return {
        date: ws.date,
        sets: exSets.sort((a,b) => a.setNumber - b.setNumber)
      };
    }).filter(Boolean).sort((a, b) => b!.date - a!.date);

    return {
      exercise,
      stats: {
        sessionsCount: workouts.length,
        totalCompletedSets,
        bestSet: maxWeight > 0 ? `${maxWeight}kg × ${maxWeightReps}` : null,
        lastPerformed: workouts.length > 0 ? Math.max(...workouts.map(w => w.date)) : null
      },
      history
    };
  }, [exerciseId]);

  if (!data) return <div className="p-4" style={{ color: 'var(--text-muted)' }}>Loading exercise details...</div>;

  const { exercise, stats, history } = data;
  const meta = exercise.metadata || {};

  const formatDaysAgo = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
      
      {/* Properties */}
      <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap' }}>
        {meta.muscles && meta.muscles.length > 0 && (
          <div style={{ flex: 1, minWidth: '120px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Muscles</span>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              {meta.muscles.map((m: string) => <Pill key={m} label={m} variant="solid" color="#10B981" />)}
            </div>
          </div>
        )}
        
        {meta.equipment && (
          <div style={{ flex: 1, minWidth: '120px' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Equipment</span>
            <Pill label={meta.equipment} variant="outline" />
          </div>
        )}
      </div>

      {/* Stats Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Sessions Completed</span>
          <span style={{ fontSize: '20px', fontWeight: 600, color: '#FFF' }}>{stats.sessionsCount}</span>
        </div>
        <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Best Set</span>
          <span style={{ fontSize: '20px', fontWeight: 600, color: 'var(--accent-color)' }}>{stats.bestSet || '-'}</span>
        </div>
        {stats.lastPerformed && (
          <div style={{ background: 'var(--bg-tertiary)', padding: '16px', borderRadius: '12px', gridColumn: 'span 2' }}>
            <span style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Last Performed</span>
            <span style={{ fontSize: '16px', fontWeight: 500, color: '#FFF' }}>{formatDaysAgo(stats.lastPerformed)}</span>
          </div>
        )}
      </div>

      {/* Recent Progression */}
      <section>
        <h3 style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Recent Progression</h3>
        {history.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {history.slice(0, 5).map((h, i) => (
              <div key={i} style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border-color)', borderRadius: '12px', padding: '12px' }}>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>
                  {new Date(h!.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {h!.sets.map((s, j) => (
                    <div key={j} style={{ fontSize: '14px', fontWeight: 500, background: 'var(--bg-tertiary)', padding: '4px 8px', borderRadius: '6px' }}>
                      {s.weight}kg × {s.reps}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ color: 'var(--text-muted)', fontSize: '14px', fontStyle: 'italic' }}>No logged history yet.</div>
        )}
      </section>

    </div>
  );
}
