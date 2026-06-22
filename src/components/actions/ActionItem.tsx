import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import type { Item, ItemInstance } from '../../db/db';
import { db } from '../../db/db';
import { toggleActionInstance } from '../../db/actions';
import { Check } from 'lucide-react';
import { useInspector } from '../shell/InspectorContext';
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
  const duration = meta.duration;

  // Format exact time if present
  const exactTime = meta.time;
  
  // Format completion time if completed today
  let completionTime = '';
  if (isCompleted && instance?.completedAt) {
    const d = new Date(instance.completedAt);
    completionTime = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  }

  // Get generic item icon
  const getItemIcon = () => {
    switch (item.type) {
      case 'medication': return <span style={{ color: 'var(--rka-red)' }}>💊</span>;
      case 'workout-template': return <span style={{ color: 'var(--rka-green)' }}>🏋️</span>;
      case 'habit': return <span style={{ color: 'var(--rka-orange)' }}>🔄</span>;
      default: return <span style={{ color: 'var(--rka-blue)' }}>📋</span>;
    }
  };

  return (
    <div className={`action-item ${isCompleted ? 'completed' : ''} ${isAnimating ? 'animating' : ''}`}>
      <div className="action-icon-wrap">
        {getItemIcon()}
      </div>
      
      <div 
        className="action-content" 
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
        
        <div className="action-time-row">
          {completionTime ? (
            <span style={{ color: 'var(--rka-green)' }}>✓ {completionTime}</span>
          ) : exactTime ? (
            <span>{exactTime}</span>
          ) : duration ? (
            <span>{duration}</span>
          ) : null}
          
          {(!completionTime && !exactTime && duration) && <span style={{ opacity: 0.5 }}>•</span>}
          
          {tags?.map(tag => (
            <span key={tag.id} style={{ color: 'var(--rka-text-tertiary)' }}>#{tag.name}</span>
          ))}
        </div>
      </div>

      <button className="action-checkbox" onClick={handleToggle} aria-label="Toggle completion" type="button">
        {isCompleted && <Check size={14} strokeWidth={3} />}
      </button>
    </div>
  );
}
