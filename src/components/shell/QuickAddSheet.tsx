import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { CheckSquare, Repeat, Pill, Dumbbell } from 'lucide-react';
import { EntityCreator } from '../creator/EntityCreator';
import { createEntity } from '../../db/actions';
import { BottomSheet, ListRow, MetadataPill } from '../ui/primitives';

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
      const status =
        entityType === 'task'
          ? (scheduledDate ? 'scheduled' : 'inbox')
          : (scheduledDate ? 'scheduled' : 'active');
      await createEntity(entityType as any, title, metadata, status, scheduledDate, tags);
      onClose();
    } catch (e) {
      console.error(e);
    }
  };

  if (selectedType) {
    return <EntityCreator entityType={selectedType} initialData={initialData} onClose={onClose} onSave={handleSave} />;
  }

  return (
    <BottomSheet open title="Create New" onDismiss={onClose}>
      <div className="quick-add-menu rka-list">
        <ListRow
          title="Task"
          subtitle="Single action with optional date"
          leading={<span className="action-icon-wrapper is-blue"><CheckSquare size={20} /></span>}
          trailing={<MetadataPill label="Quick" tone="blue" />}
          onClick={() => setSelectedType('task')}
        />
        <ListRow
          title="Habit"
          subtitle="Recurring action"
          leading={<span className="action-icon-wrapper is-green"><Repeat size={20} /></span>}
          trailing={<MetadataPill label="Repeat" tone="green" />}
          onClick={() => setSelectedType('habit')}
        />
        <ListRow
          title="Medication"
          subtitle="Track dosage and stock"
          leading={<span className="action-icon-wrapper is-red"><Pill size={20} /></span>}
          trailing={<MetadataPill label="Health" tone="red" />}
          onClick={() => setSelectedType('medication')}
        />
        <ListRow
          title="Workout"
          subtitle="Create a workout template"
          leading={<span className="action-icon-wrapper is-orange"><Dumbbell size={20} /></span>}
          trailing={<MetadataPill label="Train" tone="orange" />}
          onClick={() => setSelectedType('workout-template')}
        />
      </div>
    </BottomSheet>
  );
}
