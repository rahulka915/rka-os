import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata, WorkoutMetadata } from '../db/db';
import { Pill as PillIcon, Dumbbell, Activity, AlertTriangle, PlayCircle, ChevronRight } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { EmptyState, ListRow, MetadataPill, PageHeader, StatCard } from '../components/ui/primitives';
import './health.css';

export function HealthSearch() {
  const { inspectEntity } = useInspector();
  const allItems = useLiveQuery(() => db.items.toArray());
  const meds = allItems?.filter(i => i.type === 'medication') || [];
  const workouts = allItems?.filter(i => i.type === 'workout-template') || [];
  const exercises = allItems?.filter(i => i.type === 'exercise') || [];
  const lowStockCount = meds.filter(item => {
    const meta = item.metadata as MedicationMetadata;
    return meta.stockRemaining !== undefined && meta.stockRemaining !== null && meta.stockRemaining <= (meta.refillThreshold || 5);
  }).length;
  
  // Future queries: e.g. recentSessions from activityLogs

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
          <h3 className="rka-section-title">Medications</h3>
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
          <h3 className="rka-section-title">Workout Templates</h3>
          {workouts.length > 0 ? (
            <div className="rka-list">
              {workouts.map(item => {
                const meta = item.metadata as WorkoutMetadata;
                const exercisesCount = meta?.exercises?.length || 0;
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
          <h3 className="rka-section-title">Exercise Library</h3>
          <div className="rka-list">
            <ListRow
              title={`${exercises.length} exercises available`}
              subtitle="Browse exercise records and movement metadata."
              leading={<Activity size={18} />}
              trailing={<ChevronRight size={18} />}
              onClick={() => {
                if (exercises[0]) inspectEntity(exercises[0].id, 'exercise');
              }}
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
    </div>
  );
}
