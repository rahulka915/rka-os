import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { useNavigate } from 'react-router-dom';
import { v4 as uuidv4 } from 'uuid';
import { useInspector } from '../shell/InspectorContext';
import { EntityActivity } from './EntityActivity';
import { EntityRelationships } from './EntityRelationships';
import { Button, InspectorSection, ListRow, MetadataPill, StatCard, Tabs } from '../ui/primitives';
import { Dumbbell, ChevronRight } from 'lucide-react';

export function WorkoutDashboard({ workoutId }: { workoutId: string }) {
  const navigate = useNavigate();
  const { closeInspector, inspectEntity } = useInspector();
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
      <Tabs
        value={activeTab}
        options={[
          { value: 'overview', label: 'Overview' },
          { value: 'exercises', label: 'Exercises' },
          { value: 'history', label: 'History' },
          { value: 'settings', label: 'Settings' },
        ]}
        onChange={setActiveTab}
      />

      <div style={{ flex: 1, overflowY: 'auto' }}>
        {activeTab === 'overview' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            <div className="rka-stat-grid">
              <StatCard label="Duration" value={template.metadata?.duration || '1h'} trend="planned session length" />
              <StatCard label="Exercises" value={totalExercises} trend="in template" />
            </div>

            {targetMuscles.length > 0 && (
              <InspectorSection title="Target Muscles">
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {targetMuscles.map(m => (
                    <MetadataPill key={m} label={m} tone="green" />
                  ))}
                </div>
              </InspectorSection>
            )}

            <InspectorSection title="Parents">
              <EntityRelationships entityId={workoutId} />
            </InspectorSection>

            <Button
              variant="primary"
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
            >
              Start Workout Session
            </Button>
          </div>
        )}

        {activeTab === 'exercises' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
            {blocksData.map((b) => (
              <InspectorSection key={b.block.id} title={b.block.title}>
                <div className="rka-list">
                  {b.exercises.map(ex => (
                    <ListRow
                      key={ex!.id}
                      title={ex!.title}
                      subtitle={ex!.metadata?.muscles?.length ? ex!.metadata.muscles.join(' · ') : 'No muscles set'}
                      leading={<Dumbbell size={18} />}
                      trailing={<ChevronRight size={16} color="var(--text-muted)" />}
                      onClick={() => inspectEntity(ex!.id, ex!.type)}
                    />
                  ))}
                </div>
              </InspectorSection>
            ))}
            <Button
              variant="secondary"
              onClick={() => {
                closeInspector();
                navigate(`/template-builder/${workoutId}`);
              }}
            >
              Edit Template
            </Button>
          </div>
        )}

        {activeTab === 'history' && (
          <div style={{ paddingBottom: '32px' }}>
            <EntityActivity entityId={workoutId} />
          </div>
        )}

        {activeTab === 'settings' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Button variant="secondary">Duplicate Template</Button>
            <Button variant="danger">Archive Template</Button>
          </div>
        )}
      </div>
    </div>
  );
}
