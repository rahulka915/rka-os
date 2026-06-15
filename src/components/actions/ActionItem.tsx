import { useState } from 'react';
import type { Item, ItemInstance } from '../../db/db';
import { toggleActionInstance } from '../../db/actions';
import './actions.css';

interface ActionItemProps {
  item: Item;
  instance?: ItemInstance; 
  onInboxComplete?: (item: Item) => void;
}

export function ActionItem({ item, instance, onInboxComplete }: ActionItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const isCompleted = instance?.status === 'completed';

  const handleToggle = () => {
    // Basic Haptic Feedback
    if (navigator.vibrate) {
      navigator.vibrate(40);
    }
    
    setIsAnimating(true);
    
    setTimeout(async () => {
      if (instance) {
        await toggleActionInstance(instance.id, instance.status);
      } else if (onInboxComplete) {
        onInboxComplete(item);
      }
      setIsAnimating(false);
    }, 150); // slight delay for visual feedback before DB update removes it or crosses it
  };

  return (
    <div className={`action-item ${isCompleted ? 'completed' : ''} ${isAnimating ? 'animating' : ''}`}>
      <button className="action-checkbox" onClick={handleToggle} aria-label="Toggle completion">
        {isCompleted && (
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
             <polyline points="20 6 9 17 4 12"></polyline>
           </svg>
        )}
      </button>
      <div className="action-content">
        <span className="action-title">{item.title}</span>
      </div>
    </div>
  );
}
