import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Item, ItemInstance } from '../../db/db';
import { db } from '../../db/db';
import { toggleActionInstance } from '../../db/actions';
import { Check, Clock, Sun, Sunrise, Moon } from 'lucide-react';
import { useInspector } from '../shell/InspectorContext';
import { MetadataPill } from '../ui/primitives';
import './actions.css';

interface ActionItemProps {
  item: Item;
  instance?: ItemInstance;
}

export function ActionItem({ item, instance }: ActionItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const { inspectEntity } = useInspector();
  
  // Fetch tags for this item
  const tags = useLiveQuery(async () => {
    const mappings = await db.itemTags.where('itemId').equals(item.id).toArray();
    if (mappings.length === 0) return [];
    return db.tags.where('id').anyOf(mappings.map(m => m.tagId)).toArray();
  }, [item.id]);

  const isCompleted = instance ? instance.status === 'completed' : item.status === 'completed';

  const handleToggle = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setIsAnimating(true);
    
    setTimeout(async () => {
      if (instance) {
        await toggleActionInstance(instance.id, instance.status);
      } else {
        const newStatus = item.status === 'completed' ? 'inbox' : 'completed';
        await db.items.update(item.id, { status: newStatus, updatedAt: Date.now() });
      }
      setIsAnimating(false);
    }, 150);
  };

  const meta = item.metadata || {};
  const timeOfDay = meta.timeOfDay;
  const duration = meta.duration;

  // Helpers for time of day icon
  const getTimeIcon = (time: string) => {
    switch (time) {
      case 'morning': return <Sunrise size={12} />;
      case 'afternoon': return <Sun size={12} />;
      case 'evening': return <Moon size={12} />;
      default: return null;
    }
  };

  const getTimeLabel = (time: string) => {
    return time.charAt(0).toUpperCase() + time.slice(1);
  };

  return (
    <div className={`action-item ${isCompleted ? 'completed' : ''} ${isAnimating ? 'animating' : ''}`}>
      <button className="action-checkbox" onClick={handleToggle} aria-label="Toggle completion" type="button">
        {isCompleted && <Check size={15} strokeWidth={3} />}
      </button>
      <div 
        className="action-content" 
        style={{ display: 'flex', flexDirection: 'column', gap: '8px', cursor: 'pointer' }}
        onClick={() => inspectEntity(item.id, item.type)}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            inspectEntity(item.id, item.type);
          }
        }}
      >
        <span className="action-title">{item.title}</span>
        
        {/* Metadata Pills Row */}
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {duration && <MetadataPill label={duration} icon={<Clock size={12} />} />}
          {timeOfDay && timeOfDay !== 'anytime' && (
            <MetadataPill label={getTimeLabel(timeOfDay)} icon={getTimeIcon(timeOfDay)} tone="blue" />
          )}
          {tags?.map(tag => (
            <MetadataPill key={tag.id} label={tag.name} tone="gray" />
          ))}
        </div>
      </div>
    </div>
  );
}
