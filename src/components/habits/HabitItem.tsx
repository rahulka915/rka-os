import { useState } from 'react';
import type { Item, ItemInstance, HabitMetadata } from '../../db/db';
import { completeHabit, toggleActionInstance } from '../../db/actions';
import { Flame } from 'lucide-react';
import '../actions/actions.css';

interface HabitItemProps {
  item: Item;
  instance: ItemInstance;
}

export function HabitItem({ item, instance }: HabitItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const isCompleted = instance.status === 'completed';
  const meta = item.metadata as HabitMetadata;
  
  const streak = meta?.currentStreak || 0;

  const handleToggle = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setIsAnimating(true);
    
    setTimeout(async () => {
      if (isCompleted) {
        await toggleActionInstance(instance.id, instance.status);
      } else {
        await completeHabit(instance.id);
      }
      setIsAnimating(false);
    }, 150);
  };

  return (
    <div className={`action-item ${isCompleted ? 'completed' : ''} ${isAnimating ? 'animating' : ''}`}>
      <button className="action-checkbox" onClick={handleToggle} aria-label="Complete Habit" style={{ borderRadius: '50%' }}>
        {isCompleted && (
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
             <polyline points="20 6 9 17 4 12"></polyline>
           </svg>
        )}
      </button>
      <div className="action-content">
        <span className="action-title">{item.title}</span>
        {streak > 0 && (
          <div className="flex items-center gap-1 mt-1" style={{ fontSize: '0.8rem', color: 'var(--warning)', fontWeight: 600 }}>
            <Flame size={14} />
            <span>{streak} Day Streak</span>
          </div>
        )}
      </div>
    </div>
  );
}
