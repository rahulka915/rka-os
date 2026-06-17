import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { MedicationMetadata, WorkoutMetadata } from '../db/db';
import { Pill as PillIcon, Dumbbell, Activity, Calendar } from 'lucide-react';
import { Pill } from '../components/ui/Pill';
import { useInspector } from '../components/shell/InspectorContext';
import './health.css';

export function HealthSearch() {
  const { inspectEntity } = useInspector();
  const allItems = useLiveQuery(() => db.items.toArray());
  const meds = allItems?.filter(i => i.type === 'medication') || [];
  const workouts = allItems?.filter(i => i.type === 'workout-template') || [];
  
  return (
    <div className="health-container">
      <h1 className="mt-8 mb-6" style={{ fontSize: '1.6rem', fontWeight: 600 }}>Health Dashboard</h1>
      
      <div className="health-grid">
        <section>
          <h3 className="section-title">Prescriptions</h3>
          {meds.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {meds.map(item => {
                const meta = item.metadata as MedicationMetadata;
                return (
                  <div 
                    key={item.id} 
                    className="dashboard-card" 
                    style={{ cursor: 'pointer' }}
                    onClick={() => inspectEntity(item.id, 'medication')}
                  >
                    <span className="font-semibold block mb-3" style={{ fontSize: '15px' }}>{item.title}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <Pill label={meta.dose} variant="solid" color="#EF4444" />
                      <Pill 
                        label={`${meta.stockRemaining} left`} 
                        variant="outline" 
                        color={meta.stockRemaining <= meta.refillThreshold ? '#FF453A' : undefined} 
                      />
                      <Pill label="Daily" icon={<Calendar size={12} />} variant="outline" />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="empty-state">
              <PillIcon size={32} className="empty-state-icon" />
              <div className="empty-state-text">No active prescriptions.</div>
            </div>
          )}
        </section>

        <section>
          <h3 className="section-title">Workout Regimen</h3>
          {workouts.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {workouts.map(item => {
                const meta = item.metadata as WorkoutMetadata;
                const exercisesCount = meta?.exercises?.length || 0;
                return (
                  <div 
                    key={item.id} 
                    className="dashboard-card"
                    style={{ cursor: 'pointer' }}
                    onClick={() => inspectEntity(item.id, 'workout')}
                  >
                    <span className="font-semibold block mb-3" style={{ fontSize: '15px' }}>{item.title}</span>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
                      <Pill label={`${exercisesCount} exercises`} icon={<Activity size={12} />} variant="outline" />
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
      </div>
    </div>
  );
}
