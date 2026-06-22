import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata, WorkoutMetadata } from '../db/db';
import { Pill as PillIcon, Dumbbell, Activity, AlertTriangle, PlayCircle, ChevronRight, Plus } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { EmptyState, ListRow, MetadataPill, PageHeader, StatCard } from '../components/ui/primitives';
import { EntityCreator } from '../components/creator/EntityCreator';
import { createEntity, importExerciseLibrary } from '../db/actions';
import './health.css';

export function Health() {
  const navigate = useNavigate();
  const { inspectEntity } = useInspector();
  const [creatorType, setCreatorType] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  const allItems = useLiveQuery(() => db.items.toArray());
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

  const meds = allItems?.filter(i => i.type === 'medication') || [];
  const workouts = allItems?.filter(i => i.type === 'workout-template') || [];
  const exercises = allItems?.filter(i => i.type === 'exercise') || [];
  const lowStockCount = meds.filter(item => {
    const meta = item.metadata as MedicationMetadata;
    return meta.stockRemaining !== undefined && meta.stockRemaining !== null && meta.stockRemaining <= (meta.refillThreshold || 5);
  }).length;

  const handleSaveEntity = async (entityType: string, data: any) => {
    try {
      console.log(`[HealthTab] Attempting to save entityType: ${entityType}`);
      console.log(`[HealthTab] Raw form data:`, data);

      const { title, scheduledDate, tags, ...metadata } = data;
      const safeTitle = title || (entityType === 'medication' ? 'Untitled Medication' : 'Untitled Template');
      const safeTags = tags || [];
      
      if (entityType === 'medication' && metadata.initialStock !== undefined) {
        metadata.stockRemaining = metadata.initialStock;
      }

      console.log(`[HealthTab] Calling createEntity with safeTitle: "${safeTitle}", safeTags:`, safeTags, `metadata:`, metadata);

      const id = await createEntity(entityType as any, safeTitle, metadata, 'active', scheduledDate, safeTags);
      
      console.log(`[HealthTab] Successfully saved entity with ID: ${id}`);
      setCreatorType(null);
    } catch (e) {
      console.error('[HealthTab] FAILED to create entity:', e);
    }
  };

  return (
    <div className="rka-page health-container">
      <PageHeader
        title="Health"
        subtitle="A gentle overview of medication, movement, and recent activity."
      />

      <div className="rka-stat-grid health-summary-grid">
        <StatCard label="Medication" value={meds.length} trend={lowStockCount > 0 ? `${lowStockCount} low stock` : 'tracked items'} />
        <StatCard label="Workouts" value={workouts.length} trend="templates" />
        <StatCard label="Exercises" value={exercises.length} trend="in library" />
        <StatCard label="Recent" value="0" trend="sessions logged" />
      </div>
      
      <div className="health-grid">
        
        <section className="rka-section">
          <div className="rka-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="rka-section-title" style={{ marginBottom: 0 }}>Medications</h3>
            <button className="rka-icon-button" onClick={() => setCreatorType('medication')} aria-label="Add Medication">
              <Plus size={20} />
            </button>
          </div>
          {meds.length > 0 ? (
            <div className="rka-list">
              {meds.map(item => {
                const meta = item.metadata as MedicationMetadata;
                const hasStock = meta.stockRemaining !== undefined && meta.stockRemaining !== null;
                const isLowStock = hasStock && meta.stockRemaining <= (meta.refillThreshold || 5);
                
                return (
                  <ListRow
                    key={item.id} 
                    title={item.title}
                    subtitle={meta.dose || 'Dose unset'}
                    leading={<PillIcon size={18} />}
                    metadata={
                      <>
                        {!hasStock ? (
                          <MetadataPill label="Set stock" tone="gray" />
                        ) : (
                          <MetadataPill
                            label={`${meta.stockRemaining} left`}
                            tone={isLowStock ? 'red' : 'green'}
                            icon={isLowStock ? <AlertTriangle size={12} /> : undefined}
                          />
                        )}
                        <MetadataPill label="Daily" tone="blue" />
                      </>
                    }
                    trailing={<ChevronRight size={18} />}
                    onClick={() => inspectEntity(item.id, 'medication')}
                  />
                );
              })}
            </div>
          ) : (
            <EmptyState icon={<PillIcon size={30} />} title="No active medications" />
          )}
        </section>

        <section className="rka-section">
          <div className="rka-section-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
            <h3 className="rka-section-title" style={{ marginBottom: 0 }}>Workout Templates</h3>
            <button className="rka-icon-button" onClick={() => setCreatorType('workout-template')} aria-label="Create Template">
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

      {creatorType && (
        <EntityCreator 
          entityType={creatorType} 
          onClose={() => setCreatorType(null)} 
          onSave={handleSaveEntity} 
        />
      )}
    </div>
  );
}

export { Health as HealthSearch };
