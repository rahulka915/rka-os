import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../../db/db';
import type { FieldSchema } from '../../../schema/entitySchema';
import { Check } from 'lucide-react';
import { MetadataPill } from '../../ui/primitives';

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
        style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', minHeight: '44px', alignItems: 'center', cursor: 'pointer' }}
        onClick={() => setIsOpen(!isOpen)}
      >
        {selectedEntities.length > 0 ? (
          selectedEntities.map(e => (
            <MetadataPill key={e.id} label={e.title} tone="blue" />
          ))
        ) : (
          <span className="text-muted" style={{ fontSize: '14px' }}>Select {targetType}s...</span>
        )}
      </div>

      {isOpen && availableEntities && (
        <div className="dropdown-menu">
          {availableEntities.map(e => {
            const isSelected = value.includes(e.id);
            return (
              <button 
                key={e.id}
                type="button"
                className="dropdown-item"
                onClick={() => handleSelect(e.id)}
                style={{ background: isSelected ? 'var(--rka-blue-soft)' : 'transparent' }}
              >
                <span style={{ flex: 1 }}>{e.title}</span>
                {isSelected && <Check size={16} />}
              </button>
            );
          })}
          {availableEntities.length === 0 && <div className="text-muted p-2" style={{ fontSize: '12px' }}>No {targetType}s found</div>}
        </div>
      )}
    </div>
  );
}
