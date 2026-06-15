import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ActionList } from '../components/actions/ActionList';
import { MedicationItem } from '../components/medication/MedicationItem';
import { HabitItem } from '../components/habits/HabitItem';
import { WorkoutItem } from '../components/workouts/WorkoutItem';
import { formatDate } from '../db/actions';

export function Today() {
  const todayDate = formatDate(new Date());

  const instances = useLiveQuery(
    () => db.itemInstances.where('scheduledDate').equals(todayDate).toArray(),
    []
  );

  const itemsWithInstances = useLiveQuery(async () => {
    if (!instances) return [];
    
    const parentItems = await Promise.all(
      instances.map(inst => db.items.get(inst.itemId))
    );
    
    return instances.map((instance, index) => ({
      instance,
      item: parentItems[index]!
    })).filter(entry => entry.item !== undefined);
  }, [instances]);

  const meds = itemsWithInstances?.filter(i => i.item.type === 'medication') || [];
  const workouts = itemsWithInstances?.filter(i => i.item.type === 'workout') || [];
  const habits = itemsWithInstances?.filter(i => i.item.type === 'habit') || [];
  const tasks = itemsWithInstances?.filter(i => i.item.type !== 'medication' && i.item.type !== 'habit' && i.item.type !== 'workout') || [];

  return (
    <div className="p-4">
      <h1 className="mt-4">Today</h1>
      
      {workouts.length > 0 && (
        <div className="mb-6">
          <div className="action-list">
            {workouts.map(({ item, instance }) => (
              <WorkoutItem key={instance.id} item={item} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {meds.length > 0 && (
        <div className="mb-6">
          <h3 className="text-muted" style={{fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Medication</h3>
          <div className="action-list">
            {meds.map(({ item, instance }) => (
              <MedicationItem key={instance.id} item={item} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {habits.length > 0 && (
        <div className="mb-6">
          <h3 className="text-muted" style={{fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Habits</h3>
          <div className="action-list">
            {habits.map(({ item, instance }) => (
              <HabitItem key={instance.id} item={item} instance={instance} />
            ))}
          </div>
        </div>
      )}

      {tasks.length > 0 && (
        <div className="mb-4">
           {(meds.length > 0 || habits.length > 0) && <h3 className="text-muted" style={{fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '8px'}}>Actions</h3>}
           <ActionList items={tasks} emptyMessage="" />
        </div>
      )}

      {meds.length === 0 && habits.length === 0 && tasks.length === 0 && workouts.length === 0 && (
        <p className="text-muted empty-state">No actions scheduled for today.</p>
      )}
    </div>
  );
}
