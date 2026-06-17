import type { FieldSchema } from '../../../schema/entitySchema';
import { ChevronDown } from 'lucide-react';

interface SingleSelectFieldProps {
  field: FieldSchema;
  value: string;
  onChange: (val: string) => void;
}

export function SingleSelectField({ field, value, onChange }: SingleSelectFieldProps) {
  const options = field.options || [];
  const selectedLabel = options.find(o => o.id === value)?.label || field.label;

  return (
    <div className="field-group" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <label className="field-label" style={{ margin: 0 }}>{field.label}</label>
      
      <div style={{ position: 'relative', display: 'inline-block' }}>
        <select
          value={value}
          onChange={e => onChange(e.target.value)}
          style={{
            position: 'absolute',
            top: 0, left: 0, width: '100%', height: '100%',
            opacity: 0,
            cursor: 'pointer',
            appearance: 'none'
          }}
        >
          <option value="" disabled>Select {field.label}</option>
          {options.map(opt => (
            <option key={opt.id} value={opt.id}>{opt.label}</option>
          ))}
        </select>
        
        <div style={{ 
          display: 'flex', alignItems: 'center', gap: '6px', 
          background: value ? 'rgba(255, 255, 255, 0.1)' : 'transparent',
          color: value ? '#FFF' : 'var(--text-muted)',
          padding: '6px 12px', borderRadius: '16px',
          fontSize: '14px', fontWeight: 500,
          border: value ? 'none' : '1px dashed var(--border-color)',
          pointerEvents: 'none' /* Let clicks pass through to select */
        }}>
          {selectedLabel} <ChevronDown size={14} opacity={0.5} />
        </div>
      </div>
    </div>
  );
}
