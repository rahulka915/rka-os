import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { WorkoutMetadata } from '../db/db';
import { Dumbbell, Activity, PlayCircle, ChevronRight, Plus } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { EmptyState, ListRow, PageHeader, StatCard } from '../components/ui/primitives';
import { EntityCreator } from '../components/creator/EntityCreator';
import { createEntity, importExerciseLibrary } from '../db/actions';
import './health.css';

export function Workouts() {
  const navigate = useNavigate();
  const { inspectEntity } = useInspector();
  const [creatorOpen, setCreatorOpen] = useState(false);
  const [isImporting, setIsImporting] = useState(false);

  const workouts = useLiveQuery(() => db.items.where('type').equals('workout-template').toArray()) || [];
  const exercises = useLiveQuery(() => db.items.where('type').equals('exercise').toArray()) || [];
  
  const workoutExerciseCounts = useLiveQuery(async () => {
    const templates = await db.items.where('type').equals('workout-template').toArray();
    const counts = new Map<string, number>();

    for (const template of templates) {
      const blockLinks = await db.entityLinks.where({ sourceId: template.id, linkType: 'contains' }).toArray();
      let totalExercises = 0;

      for (const blockLink of blockLinks) {
        const exerciseLinks = await db.entityLinks.where({ sourceId: blockLink.targetId, linkType: 'includes_exercise' }).toArray();
        totalExercises += exerciseLinks.length;
      }

      counts.set(template.id, totalExercises);
    }

    return counts;
  }, []);

  const handleSaveEntity = async (_: string, data: any) => {
    try {
      const { title, scheduledDate, tags, ...metadata } = data;
      const safeTitle = title || 'Untitled Template';
      const safeTags = tags || [];
      
      const id = await createEntity('workout-template', safeTitle, metadata, 'active', scheduledDate, safeTags);
      setCreatorOpen(false);
      navigate(`/template-builder/${id}`);
    } catch (e) {
      console.error('[Workouts] FAILED to create entity:', e);
    }
  };

  return (
    <div className="rka-page health-container">
      <PageHeader
        title="Workouts"
        subtitle="Manage your training templates and exercise library."
      />

      <div className="rka-stat-grid health-summary-grid">
        <StatCard label="Workouts" value={workouts.length} trend="templates" />
        <StatCard label="Exercises" value={exercises.length} trend="in library" />
        <StatCard label="Recent" value="0" trend="sessions logged" />
      </div>
      
      <div className="health-grid">
        <section className="rka-section">
          <div className="rka-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="rka-section-title" style={{ marginBottom: 0 }}>Workout Templates</h3>
            <button className="rka-icon-button" onClick={() => setCreatorOpen(true)} aria-label="Create Template">
              <Plus size={20} />
            </button>
          </div>
          {workouts.length > 0 ? (
            <div className="rka-list">
              {workouts.map(item => {
                const fallbackMeta = item.metadata as WorkoutMetadata | undefined;
                const exercisesCount = workoutExerciseCounts?.get(item.id) ?? fallbackMeta?.exercises?.length ?? 0;
                return (
                  <ListRow
                    key={item.id} 
                    title={item.title}
                    subtitle={`${exercisesCount} exercise${exercisesCount === 1 ? '' : 's'}`}
                    leading={<Dumbbell size={18} />}
                    trailing={<PlayCircle size={24} />}
                    onClick={() => inspectEntity(item.id, 'workout-template')}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<Dumbbell size={30} />} title="No workout templates" />
          )}
        </section>

        <section className="rka-section">
          <div className="rka-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="rka-section-title" style={{ marginBottom: 0 }}>Exercise Library</h3>
            {exercises.length === 0 && (
              <button 
                className="rka-button rka-button-secondary" 
                style={{ fontSize: '12px', padding: '4px 12px' }}
                disabled={isImporting}
                onClick={async () => {
                  setIsImporting(true);
                  try {
                    await importExerciseLibrary();
                  } catch (e) {
                    console.error(e);
                  } finally {
                    setIsImporting(false);
                  }
                }}
              >
                {isImporting ? 'Importing...' : 'Import Default Library'}
              </button>
            )}
          </div>
          <div className="rka-list">
            <ListRow
              title={`${exercises.length} exercises available`}
              subtitle="Browse exercise records and movement metadata."
              leading={<Activity size={18} />}
              trailing={<ChevronRight size={18} />}
              onClick={() => navigate('/exercise-library')}
            />
          </div>
        </section>

        <section className="rka-section">
          <h3 className="rka-section-title">Recent Sessions</h3>
          <EmptyState
            icon={<Activity size={24} />}
            title="No sessions yet"
            description="Workout history will appear here once sessions are logged."
          />
        </section>

      </div>

      {creatorOpen && (
        <EntityCreator 
          entityType="workout-template" 
          onClose={() => setCreatorOpen(false)} 
          onSave={handleSaveEntity} 
        />
      )}
    </div>
  );
}
