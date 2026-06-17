import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { ItemType } from '../../db/db';
import { createEntity } from '../../db/actions';
import { useInspector } from '../shell/InspectorContext';
import { ActionList } from '../actions/ActionList';
import { X, CheckCircle2, Dumbbell, Pill, ArrowRightSquare } from 'lucide-react';
import '../inspector/inspector.css';

interface DayDrawerProps {
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

export function DayDrawer({ date, onClose }: DayDrawerProps) {
  const { inspectEntity } = useInspector();

  // Load instances and items for this date
  const items = useLiveQuery(() => db.items.toArray());
  const instances = useLiveQuery(() => db.itemInstances.where('scheduledDate').equals(date).toArray());

  if (!items || !instances) return null;

  // Items explicitly scheduled via an instance
  const scheduledItemIds = instances.map(i => i.itemId);
  const scheduledItems = items.filter(i => scheduledItemIds.includes(i.id));

  // Items due on this date (that might not be scheduled for execution today)
  const dueItems = items.filter(i => i.metadata?.dueDate === date && !scheduledItemIds.includes(i.id));

  const handleQuickAdd = async (type: ItemType) => {
    const defaultTitles: Record<ItemType, string> = {
      task: 'New Task',
      habit: 'New Habit',
      medication: 'New Medication',
      exercise: 'New Exercise',
      'workout-template': 'New Workout',
      project: 'New Project',
      area: 'New Area',
      meal: 'New Meal'
    };
    
    // Create the entity and schedule it for this date
    const id = await createEntity(type, defaultTitles[type], {}, 'scheduled', date);
    
    // For tasks, we want to immediately add an instance so it shows up in the schedule
    if (type === 'task') {
       await db.itemInstances.add({
         id: crypto.randomUUID(),
         itemId: id,
         scheduledDate: date,
         status: 'pending',
         createdAt: Date.now(),
         updatedAt: Date.now()
       });
    }

    inspectEntity(id, type);
  };

  const parsedDate = new Date(date);
  const dateLabel = parsedDate.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <div className="inspector-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="inspector-panel" onClick={e => e.stopPropagation()}>
        
        <div className="inspector-header">
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Day Plan</span>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 600 }}>{dateLabel}</h2>
          </div>
          <button className="inspector-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="inspector-body" style={{ padding: '24px' }}>
          
          <div style={{ display: 'flex', gap: '8px', marginBottom: '24px', overflowX: 'auto', paddingBottom: '4px' }}>
            <button onClick={() => handleQuickAdd('task')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <CheckCircle2 size={16} color="var(--accent-color)" /> Add Task
            </button>
            <button onClick={() => handleQuickAdd('workout-template')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Dumbbell size={16} color="#10B981" /> Add Workout
            </button>
            <button onClick={() => handleQuickAdd('medication')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <Pill size={16} color="#EF4444" /> Add Meds
            </button>
            <button onClick={() => handleQuickAdd('habit')} style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', color: 'var(--text-primary)', cursor: 'pointer', whiteSpace: 'nowrap' }}>
              <ArrowRightSquare size={16} color="#F59E0B" /> Add Habit
            </button>
          </div>

          <section style={{ marginBottom: '32px' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>SCHEDULED</h3>
            {scheduledItems.length > 0 ? (
              <ActionList items={scheduledItems.map(item => {
                const instance = instances.find(i => i.itemId === item.id);
                return { item, instance };
              })} />
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '0.9rem', fontStyle: 'italic' }}>Nothing scheduled for this day.</div>
            )}
          </section>

          {dueItems.length > 0 && (
            <section>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600 }}>DUE ON THIS DATE</h3>
              <ActionList items={dueItems.map(item => ({ item }))} />
            </section>
          )}

        </div>
      </div>
    </div>
  );
}
