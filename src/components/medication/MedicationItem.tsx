import { useState } from 'react';
import type { Item, ItemInstance, MedicationMetadata } from '../../db/db';
import { logMedicationTaken, toggleActionInstance } from '../../db/actions';
import { AlertCircle } from 'lucide-react';
import { MedicationConfirmModal } from './MedicationConfirmModal';
import '../actions/actions.css';

interface MedicationItemProps {
  item: Item;
  instance: ItemInstance;
}

export function MedicationItem({ item, instance }: MedicationItemProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  
  const isCompleted = instance.status === 'completed';
  const meta = item.metadata as MedicationMetadata;
  const isLowStock = meta && meta.stockRemaining <= (meta.refillThreshold || 0);

  const handleToggle = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!isCompleted) {
      if (navigator.vibrate) navigator.vibrate(40);
      setShowConfirm(true);
    } else {
      setIsAnimating(true);
      setTimeout(async () => {
        await toggleActionInstance(instance.id, instance.status);
        setIsAnimating(false);
      }, 150);
    }
  };

  const handleConfirm = async () => {
    setShowConfirm(false);
    setIsAnimating(true);
    setTimeout(async () => {
      await logMedicationTaken(item.id, meta?.dose || '1 dose', 1);
      await toggleActionInstance(instance.id, instance.status);
      setIsAnimating(false);
    }, 150);
  };

  return (
    <>
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
              <span>{meta.dose}</span>
              {isLowStock && <AlertCircle size={14} />}
              {isLowStock && <span>Low Stock ({meta.stockRemaining} left)</span>}
            </div>
          )}
        </div>
      </div>

      {showConfirm && (
        <MedicationConfirmModal 
          item={item} 
          onConfirm={handleConfirm} 
          onCancel={() => setShowConfirm(false)} 
        />
      )}
    </>
  );
}
