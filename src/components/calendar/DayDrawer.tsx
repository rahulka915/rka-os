import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import type { ItemType } from '../../db/db';
import { createEntity } from '../../db/actions';
import { useInspector } from '../shell/InspectorContext';
import { ActionList } from '../actions/ActionList';
import { Button, EmptyState, InspectorSection } from '../ui/primitives';
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
      'workout-block': 'New Workout Block',
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

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '24px' }}>
            <Button variant="secondary" icon={<CheckCircle2 size={16} />} onClick={() => handleQuickAdd('task')}>
              Add Task
            </Button>
            <Button variant="secondary" icon={<Dumbbell size={16} />} onClick={() => handleQuickAdd('workout-template')}>
              Add Workout
            </Button>
            <Button variant="secondary" icon={<Pill size={16} />} onClick={() => handleQuickAdd('medication')}>
              Add Meds
            </Button>
            <Button variant="secondary" icon={<ArrowRightSquare size={16} />} onClick={() => handleQuickAdd('habit')}>
              Add Habit
            </Button>
          </div>

          <InspectorSection title="Scheduled">
            {scheduledItems.length > 0 ? (
              <ActionList items={scheduledItems.map(item => {
                const instance = instances.find(i => i.itemId === item.id);
                return { item, instance };
              })} />
            ) : (
              <EmptyState title="Nothing scheduled" description="Add something to this day and it will appear here." />
            )}
          </InspectorSection>

          {dueItems.length > 0 && (
            <InspectorSection title="Due on this date">
              <ActionList items={dueItems.map(item => ({ item }))} />
            </InspectorSection>
          )}

        </div>
      </div>
    </div>
  );
}
