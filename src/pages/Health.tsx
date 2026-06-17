import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata, WorkoutMetadata } from '../db/db';
import { Pill as PillIcon, Dumbbell, Activity, Calendar, AlertTriangle, PlayCircle } from 'lucide-react';
import { Pill } from '../components/ui/Pill';
import { useInspector } from '../components/shell/InspectorContext';
import './health.css';

export function HealthSearch() {
  const { inspectEntity } = useInspector();
  const allItems = useLiveQuery(() => db.items.toArray());
  const meds = allItems?.filter(i => i.type === 'medication') || [];
  const workouts = allItems?.filter(i => i.type === 'workout-template') || [];
  const exercises = allItems?.filter(i => i.type === 'exercise') || [];
  
  // Future queries: e.g. recentSessions from activityLogs

  return (
    <div className="health-container">
      <h1 className="mt-8 mb-6" style={{ fontSize: '1.6rem', fontWeight: 600 }}>Health Dashboard</h1>
      
      <div className="health-grid">
        
        {/* Medications */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Medications</h3>
          </div>
          {meds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {meds.map(item => {
                const meta = item.metadata as MedicationMetadata;
                const hasStock = meta.stockRemaining !== undefined && meta.stockRemaining !== null;
                const isLowStock = hasStock && meta.stockRemaining <= (meta.refillThreshold || 5);
                
                return (
                  <div 
                    key={item.id} 
                    className="dashboard-card" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => inspectEntity(item.id, 'medication')}
                  >
                    <span className="font-semibold block mb-3" style={{ fontSize: '15px' }}>{item.title}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <Pill label={meta.dose || 'Dose unset'} variant="solid" color="#EF4444" />
                      {!hasStock ? (
                        <Pill label="Stock not set" variant="outline" color="#888" />
                      ) : (
                        <Pill 
                          label={`${meta.stockRemaining} left`} 
                          variant="outline" 
                          color={isLowStock ? '#FF453A' : undefined} 
                          icon={isLowStock ? <AlertTriangle size={12} /> : undefined}
                        />
                      )}
                      <Pill label="Daily" icon={<Calendar size={12} />} variant="outline" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <PillIcon size={32} className="empty-state-icon" />
              <div className="empty-state-text">No active medications.</div>
            </div>
          )}
        </section>

        {/* Workout Templates */}
        <section>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 className="section-title" style={{ margin: 0 }}>Workout Templates</h3>
          </div>
          {workouts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workouts.map(item => {
                const meta = item.metadata as WorkoutMetadata;
                const exercisesCount = meta?.exercises?.length || 0;
                return (
                  <div 
                    key={item.id} 
                    className="dashboard-card"
                    style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                    onClick={() => inspectEntity(item.id, 'workout-template')}
                  >
                    <div>
                      <span className="font-semibold block mb-2" style={{ fontSize: '15px' }}>{item.title}</span>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                        <Pill label={`${exercisesCount} exercises`} icon={<Activity size={12} />} variant="outline" />
                      </div>
                    </div>
                    <div style={{ color: 'var(--accent-color)', padding: '8px' }}>
                      <PlayCircle size={24} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <Dumbbell size={32} className="empty-state-icon" />
              <div className="empty-state-text">No workout templates found.</div>
            </div>
          )}
        </section>

        {/* Exercise Library Preview */}
        <section>
          <h3 className="section-title">Exercise Library</h3>
          <div className="dashboard-card" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
              {exercises.length} Exercises Available
            </div>
            <Pill label="Manage" variant="outline" />
          </div>
        </section>

        {/* Recent Sessions Placeholder */}
        <section>
          <h3 className="section-title">Recent Sessions</h3>
          <div className="empty-state" style={{ minHeight: '80px' }}>
            <Activity size={24} className="empty-state-icon" style={{ opacity: 0.5 }} />
            <div className="empty-state-text" style={{ fontSize: '13px' }}>No recent workout sessions logged.</div>
          </div>
        </section>

      </div>
    </div>
  );
}
