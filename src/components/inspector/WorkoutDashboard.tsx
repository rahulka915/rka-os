import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { Pill } from '../ui/Pill';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useInspector } from '../shell/InspectorContext';
import { EntityActivity } from './EntityActivity';
import { EntityRelationships } from './EntityRelationships';

export function WorkoutDashboard({ workoutId }: { workoutId: string }) {
  const navigate = useNavigate();
  const { closeInspector } = useInspector();
  const [activeTab, setActiveTab] = useState<'overview' | 'exercises' | 'history' | 'settings'>('overview');

  const template = useLiveQuery(() => db.items.get(workoutId), [workoutId]);

  // Load blocks and exercises
  const blocksData = useLiveQuery(async () => {
    const blockLinks = await db.entityLinks.where({ sourceId: workoutId, linkType: 'contains' }).toArray();
    const blocks = await Promise.all(blockLinks.map(l => db.items.get(l.targetId)));
    
    const result = [];
    for (const block of blocks) {
      if (!block || block.type !== 'workout-block') continue;
      const exLinks = await db.entityLinks.where({ sourceId: block.id, linkType: 'includes_exercise' }).toArray();
      const exercises = await Promise.all(exLinks.map(l => db.items.get(l.targetId)));
      result.push({ block, exercises: exercises.filter(Boolean) });
    }
    return result.sort((a, b) => (a.block.metadata?.order || 0) - (b.block.metadata?.order || 0));
  }, [workoutId]);

  if (!template || !blocksData) return null;

  // Calculate target muscles
  const muscleSet = new Set<string>();
  let totalExercises = 0;
  blocksData.forEach(b => {
    b.exercises.forEach(ex => {
      totalExercises++;
      const m = ex!.metadata?.muscles || [];
      m.forEach((muscle: string) => muscleSet.add(muscle));
    });
  });
  const targetMuscles = Array.from(muscleSet);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Tabs */}
      <div style={{ display: 'flex', gap: '24px', borderBottom: '1px solid var(--border-color)', marginBottom: '24px', overflowX: 'auto', paddingBottom: '8px' }}>
        {(['overview', 'exercises', 'history', 'settings'] as const).map(tab => (
          <button 
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{ 
              background: 'transparent', border: 'none', color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
              fontSize: '14px', fontWeight: 600, cursor: 'pointer', textTransform: 'capitalize', padding: 0,
              borderBottom: activeTab === tab ? '2px solid var(--accent-color)' : 'none'
            }}
          >
            {tab}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Duration</span>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{template.metadata?.duration || '1h'}</div>
              </div>
              <div style={{ background: 'var(--bg-secondary)', padding: '16px', borderRadius: '12px' }}>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '8px', display: 'block' }}>Exercises</span>
                <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{totalExercises}</div>
              </div>
            </div>

            {targetMuscles.length > 0 && (
              <div>
                <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Target Muscles</span>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {targetMuscles.map(m => (
                    <Pill key={m} label={m} variant="solid" color="#10B981" />
                  ))}
                </div>
              </div>
            )}

            <div>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>Parents</span>
              <EntityRelationships entityId={workoutId} />
            </div>

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
                
                let order = 0;
                for (const block of blocksData) {
                  for (const ex of block.exercises) {
                    const exSessionId = uuidv4();
                    await db.exerciseSessions.add({
                      id: exSessionId,
                      workoutSessionId: sessionId,
                      exerciseId: ex!.id,
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
              style={{ marginTop: '16px', padding: '16px', background: 'var(--accent-color)', color: '#fff', border: 'none', borderRadius: '12px', fontSize: '16px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              Start Workout Session
            </button>
          </div>
        )}

        {activeTab === 'exercises' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {blocksData.map((b) => (
              <div key={b.block.id}>
                <span style={{ fontSize: '13px', color: 'var(--accent-color)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '12px', display: 'block' }}>
                  {b.block.title}
                </span>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {b.exercises.map(ex => (
                    <div key={ex!.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '8px' }}>
                      <span style={{ fontSize: '15px', fontWeight: 500 }}>{ex!.title}</span>
                      <span style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{ex!.metadata?.equipment || 'Any'}</span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
            <button 
              onClick={() => {
                closeInspector();
                navigate(`/template-builder/${workoutId}`);
              }}
              style={{ padding: '14px', background: 'transparent', color: 'var(--accent-color)', border: '1px dashed var(--accent-color)', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', width: '100%' }}
            >
              Edit Template
            </button>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ paddingBottom: '32px' }}>
            <EntityActivity entityId={workoutId} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <button style={{ padding: '16px', background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '1px solid var(--border-color)', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Duplicate Template
            </button>
            <button style={{ padding: '16px', background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '12px', fontSize: '15px', fontWeight: 600, cursor: 'pointer', textAlign: 'left' }}>
              Archive Template
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
