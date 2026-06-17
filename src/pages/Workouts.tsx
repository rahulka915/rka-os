import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { createEntity } from '../db/actions';
import type { WorkoutMetadata } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { formatDate } from '../db/actions';
import { Dumbbell } from 'lucide-react';

export function Workouts() {
  const templates = useLiveQuery(() => db.items.where('type').equals('workout-template').toArray());

  const handleCreateTemplate = async () => {
    const title = prompt('Workout Name (e.g. Pull Day):');
    if (!title) return;
    
    // Quick demo template creation since complex UI form is out of scope for phase 4 initial build
    await createEntity('workout-template', title);
  };

  const handleScheduleToday = async (id: string) => {
    const now = Date.now();
    await db.itemInstances.add({
      id: uuidv4(),
      itemId: id,
      scheduledDate: formatDate(new Date()),
      status: 'pending',
      createdAt: now,
      updatedAt: now
    });
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mt-4 mb-4">
        <h1>Workouts</h1>
        <button onClick={handleCreateTemplate} style={{background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600}}>New Template</button>
      </div>
      
      {templates?.length === 0 && <p className="text-muted">No workout templates defined.</p>}
      
      <div className="action-list">
        {templates?.map(t => {
          const meta = t.metadata as WorkoutMetadata;
          return (
            <div key={t.id} className="action-item flex-col" style={{alignItems: 'flex-start', padding: '16px 0'}}>
              <div className="flex justify-between items-center" style={{width: '100%'}}>
                <strong className="flex items-center gap-2"><Dumbbell size={16}/> {t.title}</strong>
                <button onClick={() => handleScheduleToday(t.id)} style={{background: 'transparent', border: '1px solid var(--border-color)', color: 'var(--text-primary)', padding: '4px 8px', borderRadius: '4px'}}>+ Today</button>
              </div>
              <div className="text-muted mt-2" style={{fontSize: '0.85rem'}}>
                {meta.exercises.length} Exercises: {meta.exercises.map(e => e.name).join(', ')}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
