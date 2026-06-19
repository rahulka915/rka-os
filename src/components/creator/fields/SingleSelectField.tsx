import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, ChevronDown, Clock3, Moon, Sun, Sunrise } from 'lucide-react';
import type { FieldSchema } from '../../../schema/entitySchema';

interface SingleSelectFieldProps {
  field: FieldSchema;
  value: string;
  onChange: (val: string) => void;
}

function getOptionIcon(fieldId: string, optionId: string) {
  if (fieldId === 'timeOfDay') {
    switch (optionId) {
      case 'anytime': return <Clock3 size={16} />;
      case 'morning': return <Sunrise size={16} />;
      case 'afternoon': return <Sun size={16} />;
      case 'evening': return <Moon size={16} />;
    }
  }

  return <span className="dropdown-bullet" aria-hidden="true" />;
}

export function SingleSelectField({ field, value, onChange }: SingleSelectFieldProps) {
  const [isOpen, setIsOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const options = field.options || [];
  const selectedOption = options.find(o => o.id === value);
  const selectedLabel = selectedOption?.label || `Select ${field.label}`;

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setIsOpen(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const groupedOptions = useMemo(() => {
    if (field.id === 'timeOfDay') return [{ title: 'Time of day', items: options }];
    return [{ title: '', items: options }];
  }, [field.id, options]);

  return (
    <div className="field-group" style={{ gap: '10px', position: 'relative' }} ref={rootRef}>
      <label className="field-label" style={{ margin: 0 }}>{field.label}</label>

      <button
        type="button"
        className="creator-select-trigger"
        onClick={() => setIsOpen(v => !v)}
      >
        <span>{selectedLabel}</span>
        <ChevronDown size={14} opacity={0.55} />
      </button>

      {isOpen && (
        <div className="dropdown-menu dropdown-menu--linear">
          {groupedOptions.map(group => (
            <div key={group.title || 'default'} className="dropdown-group">
              {group.title && <div className="dropdown-group-title">{group.title}</div>}
              {group.items.map(opt => {
                const selected = opt.id === value;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    className={`dropdown-item ${selected ? 'dropdown-item--selected' : ''}`}
                    onClick={() => {
                      onChange(opt.id);
                      setIsOpen(false);
                    }}
                  >
                    <span className="dropdown-item-icon">{getOptionIcon(field.id, opt.id)}</span>
                    <span className="dropdown-item-label">{opt.label}</span>
                    {selected && <Check size={16} className="dropdown-item-check" />}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
