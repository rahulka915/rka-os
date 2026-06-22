import type { FieldSchema } from '../../../schema/entitySchema';
import { Clock } from 'lucide-react';

interface TimeFieldProps {
  field: FieldSchema;
  value: string;
  onChange: (val: string) => void;
}

export function TimeField({ field, value, onChange }: TimeFieldProps) {
  return (
    <div className="field-group" style={{ position: 'relative' }}>
      <label className="field-label" style={{ margin: '0 0 4px 0', display: 'block' }}>
        {field.label}
      </label>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <div style={{ position: 'absolute', left: '12px', color: 'var(--rka-text-secondary)', pointerEvents: 'none' }}>
          <Clock size={16} />
        </div>
        <input
          type="time"
          value={value || ''}
          onChange={(e) => onChange(e.target.value)}
          className="inspector-input-bare"
          style={{
            width: '100%',
            padding: '10px 12px 10px 36px',
            borderRadius: '12px',
            border: '1px solid var(--rka-border)',
            background: 'var(--rka-surface)',
            color: 'var(--rka-text)',
            fontSize: '15px',
            outline: 'none',
            fontFamily: 'inherit',
            transition: 'border-color 0.2s',
            WebkitAppearance: 'none'
          }}
          onFocus={(e) => e.target.style.borderColor = 'var(--rka-primary)'}
          onBlur={(e) => e.target.style.borderColor = 'var(--rka-border)'}
        />
      </div>
    </div>
  );
}
