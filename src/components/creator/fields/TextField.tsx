import type { FieldSchema } from '../../../schema/entitySchema';

interface TextFieldProps {
  field: FieldSchema;
  value: string;
  onChange: (val: string) => void;
}

export function TextField({ field, value, onChange }: TextFieldProps) {
  if (field.type === 'textarea') {
    return (
      <div className="field-group">
        <label className="field-label">{field.label}</label>
        <textarea
          className="creator-textarea"
          placeholder={field.placeholder || ''}
          value={value}
          onChange={e => onChange(e.target.value)}
        />
      </div>
    );
  }

  return (
    <div className="field-group">
      <label className="field-label">{field.label}</label>
      <input
        type="text"
        className="creator-input"
        placeholder={field.placeholder || ''}
        value={value}
        onChange={e => onChange(e.target.value)}
        autoFocus={field.id === 'title'}
      />
    </div>
  );
}
