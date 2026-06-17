import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckSquare, Repeat, Pill, Dumbbell } from 'lucide-react';
import { EntityCreator } from '../creator/EntityCreator';
import { createEntity } from '../../db/actions';

interface QuickAddSheetProps {
  onClose: () => void;
}

export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const location = useLocation();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [initialData, setInitialData] = useState<any>({});

  // Context-Aware Defaults
  useEffect(() => {
    const path = location.pathname;
    if (path.includes('health-search')) {
      // Could preselect medication, but menu is fine. If they pick medication, maybe pre-fill tags.
      setInitialData({ tags: ['health'] });
    } else if (path.includes('projects')) {
      // E.g. /projects/medicine
      // We don't have nested routes yet, but if we did we could extract the ID.
    }
  }, [location.pathname]);

  const handleSave = async (entityType: string, data: any) => {
    try {
      const { title, scheduledDate, tags, ...metadata } = data;
      await createEntity(entityType as any, title, metadata, scheduledDate ? 'scheduled' : 'active', scheduledDate, tags);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  if (selectedType) {
    return <EntityCreator entityType={selectedType} initialData={initialData} onClose={onClose} onSave={handleSave} />;
  }

  return (
    <div className="creator-overlay" onClick={onClose}>
      <div className="creator-sheet" onClick={e => e.stopPropagation()} style={{ padding: '24px 20px', paddingBottom: 'calc(24px + env(safe-area-inset-bottom))' }}>
        <div className="action-sheet-header">
           <span className="font-semibold" style={{ fontSize: '16px' }}>Create New</span>
        </div>
        <div className="action-sheet-menu">
            <button className="action-sheet-option" onClick={() => setSelectedType('task')}>
              <div className="action-icon-wrapper" style={{ backgroundColor: '#2563EB' }}><CheckSquare size={20} color="white" /></div>
              <div className="action-text"><span className="title">Task</span><span className="subtitle">Single action with optional date</span></div>
            </button>
            <button className="action-sheet-option" onClick={() => setSelectedType('habit')}>
              <div className="action-icon-wrapper" style={{ backgroundColor: '#10B981' }}><Repeat size={20} color="white" /></div>
              <div className="action-text"><span className="title">Habit</span><span className="subtitle">Recurring action</span></div>
            </button>
            <button className="action-sheet-option" onClick={() => setSelectedType('medication')}>
              <div className="action-icon-wrapper" style={{ backgroundColor: '#EF4444' }}><Pill size={20} color="white" /></div>
              <div className="action-text"><span className="title">Medication</span><span className="subtitle">Track dosage and stock</span></div>
            </button>
            <button className="action-sheet-option" onClick={() => setSelectedType('workout')}>
              <div className="action-icon-wrapper" style={{ backgroundColor: '#8B5CF6' }}><Dumbbell size={20} color="white" /></div>
              <div className="action-text"><span className="title">Workout</span><span className="subtitle">Create a workout template</span></div>
            </button>
        </div>
      </div>
    </div>
  );
}
