import type { FieldSchema } from '../../../schema/entitySchema';

interface NumberSelectorFieldProps {
  field: FieldSchema;
  value: number | '';
  onChange: (val: number | '') => void;
}

export function NumberSelectorField({ field, value, onChange }: NumberSelectorFieldProps) {
  const options = field.numberOptions || [];

  return (
    <div className="field-group">
      <label className="field-label">{field.label}</label>
      {options.length > 0 ? (
        <div className="number-selector-wrapper">
          {options.map(num => (
            <button
              key={num}
              type="button"
              className={`number-chip ${value === num ? 'selected' : ''}`}
              onClick={() => onChange(num)}
            >
              {num}{field.numberSuffix || ''}
            </button>
          ))}
          <input 
            type="number"
            className="creator-input"
            style={{ width: '80px', padding: '8px', borderRadius: '20px' }}
            placeholder="Custom"
            value={!options.includes(value as number) && value !== '' ? value : ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
          />
        </div>
      ) : (
        <input
          type="number"
          className="creator-input"
          placeholder={field.placeholder || '0'}
          value={value}
          onChange={e => onChange(e.target.value ? Number(e.target.value) : '')}
        />
      )}
    </div>
  );
}
