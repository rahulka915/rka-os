import { useLiveQuery } from 'dexie-react-hooks';
import { Activity, ChevronRight, Clock, Dumbbell, ImageOff } from 'lucide-react';
import { db } from '../../db/db';
import { useInspector } from '../shell/InspectorContext';
import { EmptyState, InspectorSection, ListRow, MetadataPill, StatCard } from '../ui/primitives';

export function ExerciseDetail({ exerciseId }: { exerciseId: string }) {
  const { inspectEntity } = useInspector();

  const data = useLiveQuery(async () => {
    const exercise = await db.items.get(exerciseId);
    if (!exercise) return null;

    const sessions = await db.exerciseSessions.where({ exerciseId }).toArray();
    const sessionIds = sessions.map(s => s.id);
    const sets = await db.setEntries.where('exerciseSessionId').anyOf(sessionIds).toArray();

    const workoutSessionIds = [...new Set(sessions.map(s => s.workoutSessionId))];
    const workouts = await db.workoutSessions.where('id').anyOf(workoutSessionIds).toArray();

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

    const history = workouts
      .map(ws => {
        const exSession = sessions.find(s => s.workoutSessionId === ws.id);
        if (!exSession) return null;

        const exSets = sets.filter(s => s.exerciseSessionId === exSession.id && s.completed);
        if (exSets.length === 0) return null;

        return {
          date: ws.date,
          sets: exSets.sort((a, b) => a.setNumber - b.setNumber),
        };
      })
      .filter(Boolean)
      .sort((a, b) => b!.date - a!.date) as { date: number; sets: typeof sets }[];

    const variationLinks = await db.entityLinks.where({ sourceId: exerciseId, linkType: 'contains' }).toArray();
    const variations = await Promise.all(variationLinks.map(l => db.items.get(l.targetId)));

    return {
      exercise,
      variations: variations.filter(Boolean),
      stats: {
        sessionsCount: workouts.length,
        totalCompletedSets,
        bestSet: maxWeight > 0 ? `${maxWeight}kg × ${maxWeightReps}` : null,
        lastPerformed: workouts.length > 0 ? Math.max(...workouts.map(w => w.date)) : null,
      },
      history,
    };
  }, [exerciseId]);

  if (!data) {
    return <div className="p-4" style={{ color: 'var(--text-muted)' }}>Loading exercise details...</div>;
  }

  const { exercise, stats, history } = data;
  const meta = exercise.metadata || {};

  const formatDaysAgo = (timestamp: number) => {
    const days = Math.floor((Date.now() - timestamp) / (1000 * 60 * 60 * 24));
    if (days === 0) return 'Today';
    if (days === 1) return 'Yesterday';
    return `${days} days ago`;
  };

  const formatDate = (timestamp: number) =>
    new Date(timestamp).toLocaleDateString(undefined, {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    });

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <EmptyState
        icon={<ImageOff size={24} />}
        title="Media coming soon"
        description="Exercise photos and clips will sit here once available."
      />

      <InspectorSection title="At a glance">
        <div className="rka-stat-grid">
          <StatCard label="Sessions" value={stats.sessionsCount} trend="completed workouts" />
          <StatCard label="Best Set" value={stats.bestSet || '—'} trend="top logged load" />
          {stats.lastPerformed && (
            <StatCard label="Last Performed" value={formatDaysAgo(stats.lastPerformed)} trend="most recent session" />
          )}
          <StatCard label="Completed Sets" value={stats.totalCompletedSets} trend="all logged sets" />
        </div>
      </InspectorSection>

      {meta.muscles?.length ? (
        <InspectorSection title="Muscles">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
            {meta.muscles.map((m: string) => (
              <MetadataPill key={m} label={m} tone="green" />
            ))}
          </div>
        </InspectorSection>
      ) : null}

      {meta.equipment ? (
        <InspectorSection title="Equipment">
          <MetadataPill label={meta.equipment} tone="blue" />
        </InspectorSection>
      ) : null}

      {data.variations.length > 0 && (
        <InspectorSection title="Variations">
          <div className="rka-list">
            {data.variations.map(v => (
              <ListRow
                key={v!.id}
                title={v!.title}
                subtitle="Open variation"
                leading={<Dumbbell size={18} />}
                trailing={<ChevronRight size={16} color="var(--text-muted)" />}
                onClick={() => inspectEntity(v!.id, v!.type)}
              />
            ))}
          </div>
        </InspectorSection>
      )}

      <InspectorSection title="Technique & Execution">
        <div
          style={{
            padding: '16px',
            borderRadius: 'var(--rka-radius-card)',
            background: 'var(--rka-surface)',
            color: meta.notes ? 'var(--rka-text)' : 'var(--rka-text-secondary)',
            boxShadow: 'var(--rka-shadow-soft)',
            fontSize: '14px',
            lineHeight: '1.5',
          }}
        >
          {meta.notes || 'No coaching cues added yet.'}
        </div>
      </InspectorSection>

      <InspectorSection title="Progression">
        <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '4px' }}>
          <div
            style={{
              minWidth: '180px',
              padding: '16px',
              borderRadius: 'var(--rka-radius-card)',
              background: 'var(--rka-surface)',
              boxShadow: 'var(--rka-shadow-soft)',
            }}
          >
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Load Trend</div>
            <div style={{ color: 'var(--rka-text)', fontSize: '16px', fontWeight: 600 }}>Coming soon</div>
          </div>
          <div
            style={{
              minWidth: '180px',
              padding: '16px',
              borderRadius: 'var(--rka-radius-card)',
              background: 'var(--rka-surface)',
              boxShadow: 'var(--rka-shadow-soft)',
            }}
          >
            <div style={{ color: 'var(--rka-text-secondary)', fontSize: '12px', fontWeight: 700, marginBottom: '6px' }}>Volume History</div>
            <div style={{ color: 'var(--rka-text)', fontSize: '16px', fontWeight: 600 }}>Coming soon</div>
          </div>
        </div>
      </InspectorSection>

      <InspectorSection title="Recent Progression">
        {history.length > 0 ? (
          <div className="rka-list">
            {history.slice(0, 5).map((h, i) => (
              <ListRow
                key={i}
                title={formatDate(h.date)}
                subtitle={`${h.sets.length} completed set${h.sets.length === 1 ? '' : 's'}`}
                leading={<Activity size={18} />}
                metadata={
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                    {h.sets.slice(0, 3).map((s, j) => (
                      <MetadataPill key={j} label={`${s.weight}kg × ${s.reps}`} tone="gray" />
                    ))}
                  </div>
                }
              />
            ))}
          </div>
        ) : (
          <EmptyState
            icon={<Clock size={24} />}
            title="No logged history yet."
            description="Once you complete this movement in a session, progression will show up here."
          />
        )}
      </InspectorSection>
    </div>
  );
}
