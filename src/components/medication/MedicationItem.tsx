import { useState } from 'react';
import type { Item, ItemInstance, MedicationMetadata } from '../../db/db';
import { takeMedication, toggleActionInstance } from '../../db/actions';
import { AlertCircle } from 'lucide-react';
import '../actions/actions.css';

interface MedicationItemProps {
  item: Item;
  instance: ItemInstance;
}

export function MedicationItem({ item, instance }: MedicationItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const isCompleted = instance.status === 'completed';
  const meta = item.metadata as MedicationMetadata;
  const isLowStock = meta && meta.stock <= 5;

  const handleToggle = () => {
    if (navigator.vibrate) navigator.vibrate(40);
    setIsAnimating(true);
    
    setTimeout(async () => {
      if (isCompleted) {
        // Unchecking just changes status, doesn't refund stock (safeguard against accidental double dose stock inflation)
        await toggleActionInstance(instance.id, instance.status);
      } else {
        await takeMedication(instance.id);
      }
      setIsAnimating(false);
    }, 150);
  };

  return (
    <div className={`action-item ${isCompleted ? 'completed' : ''} ${isAnimating ? 'animating' : ''}`}>
      <button className="action-checkbox" onClick={handleToggle} aria-label="Take medication">
        {isCompleted && (
           <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="16" height="16">
             <polyline points="20 6 9 17 4 12"></polyline>
           </svg>
        )}
      </button>
      <div className="action-content">
        <span className="action-title">{item.title}</span>
        {meta && (
          <div className="flex items-center gap-2 mt-1" style={{ fontSize: '0.8rem', color: isLowStock ? 'var(--warning)' : 'var(--text-muted)' }}>
            <span>{meta.dosage}</span>
            {isLowStock && <AlertCircle size={14} />}
            {isLowStock && <span>Low Stock ({meta.stock} left)</span>}
          </div>
        )}
      </div>
    </div>
  );
}
