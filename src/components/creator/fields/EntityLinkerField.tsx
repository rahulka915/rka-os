import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/db';
import type { FieldSchema } from '../../../schema/entitySchema';
import { Pill } from '../../ui/Pill';

interface EntityLinkerFieldProps {
  field: FieldSchema;
  value: string[]; // array of linked entity IDs
  onChange: (value: string[]) => void;
}

export function EntityLinkerField({ field, value = [], onChange }: EntityLinkerFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const targetType = field.targetEntityType || 'task';

  const availableEntities = useLiveQuery(() => 
    db.items.where('type').equals(targetType).toArray()
  );

  const selectedEntities = availableEntities?.filter(e => value.includes(e.id)) || [];

  const handleSelect = (id: string) => {
    if (value.includes(id)) {
      onChange(value.filter(v => v !== id));
    } else {
      onChange([...value, id]);
    }
  };

  return (
    <div style={{ position: 'relative' }}>
      <div 
        style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', minHeight: '36px', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedEntities.length > 0 ? (
          selectedEntities.map(e => (
            <Pill key={e.id} label={e.title} variant="solid" color="var(--accent-color)" />
          ))
        ) : (
          <span className="text-muted" style={{ fontSize: '14px' }}>Select {targetType}s...</span>
        )}
      </div>

      {isOpen && availableEntities && (
        <div style={{ position: 'absolute', top: '100%', left: 0, right: 0, background: 'var(--bg-tertiary)', border: '1px solid var(--border-color)', borderRadius: '8px', padding: '8px', marginTop: '4px', zIndex: 10, display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '200px', overflowY: 'auto' }}>
          {availableEntities.map(e => {
            const isSelected = value.includes(e.id);
            return (
              <div 
                key={e.id}
                onClick={() => handleSelect(e.id)}
                style={{ padding: '6px 12px', fontSize: '14px', borderRadius: '4px', cursor: 'pointer', background: isSelected ? 'var(--accent-color)' : 'transparent', color: isSelected ? '#fff' : 'var(--text-primary)' }}
              >
                {e.title}
              </div>
            );
          })}
          {availableEntities.length === 0 && <div className="text-muted p-2" style={{ fontSize: '12px' }}>No {targetType}s found</div>}
        </div>
      )}
    </div>
  );
}
