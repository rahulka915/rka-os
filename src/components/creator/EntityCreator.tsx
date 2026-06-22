import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ENTITY_SCHEMAS } from '../../schema/entitySchema';
import type { FieldSchema } from '../../schema/entitySchema';
import { BottomSheet } from '../ui/primitives';
import { TextField } from './fields/TextField';
import { SingleSelectField } from './fields/SingleSelectField';
import { NumberSelectorField } from './fields/NumberSelectorField';
import { MultiSelectField } from './fields/MultiSelectField';
import { SubItemsField } from './fields/SubItemsField';
import { EntityLinkerField } from './fields/EntityLinkerField';
import './fields/subitems.css';
import './creator.css';

interface EntityCreatorProps {
  entityType: string;
  onClose: () => void;
  onSave: (entityType: string, data: any) => Promise<void>;
  initialData?: any;
}

export function EntityCreator({ entityType, onClose, onSave, initialData = {} }: EntityCreatorProps) {
  const schema = ENTITY_SCHEMAS[entityType];
  const [formData, setFormData] = useState<Record<string, any>>(initialData);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  if (!schema) return null;

  const coreFields = schema.fields.filter(f => !f.advanced);
  const advancedFields = schema.fields.filter(f => f.advanced);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    setIsSaving(true);
    await onSave(entityType, formData);
    setIsSaving(false);
    onClose();
  };

  const renderField = (field: FieldSchema) => {
    const val = formData[field.id] || (field.type === 'multi-select' ? [] : '');
    
    switch (field.type) {
      case 'text':
      case 'textarea':
        return <TextField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'single-select':
        return <SingleSelectField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'number-selector':
        return <NumberSelectorField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'multi-select':
        return <MultiSelectField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'sub-items':
        return <SubItemsField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'entity-linker':
        return <EntityLinkerField key={field.id} field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />;
      case 'date':
        return (
          <div key={field.id} className="field-group">
            <label className="field-label">{field.label}</label>
            <input type="date" className="creator-input" value={val} onChange={e => handleFieldChange(field.id, e.target.value)} />
          </div>
        );
      default:
        return null;
    }
  };

  const missingFields = schema.fields.filter(f => f.required).filter(f => {
    const v = formData[f.id];
    return v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
  });

  const isValid = missingFields.length === 0;

  return (
    <BottomSheet
      open
      title={`New ${schema.label}`}
      onDismiss={onClose}
      secondaryAction={{ label: 'Cancel', onClick: onClose }}
      primaryAction={{ label: isSaving ? 'Saving...' : 'Create', onClick: handleSave, disabled: !isValid || isSaving }}
    >
      <div className="creator-body">
        {!isValid && (
          <div style={{ fontSize: '13px', color: 'var(--rka-red)', marginBottom: '16px', padding: '8px 12px', background: 'var(--rka-red-soft)', borderRadius: '8px' }}>
            Missing required fields: {missingFields.map(f => f.label).join(', ')}
          </div>
        )}
        {coreFields.map(renderField)}

        {advancedFields.length > 0 && (
          <div className="mt-2">
            <button className="advanced-toggle" type="button" onClick={() => setShowAdvanced(!showAdvanced)}>
              {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
              Advanced Options
            </button>
            
            {showAdvanced && (
              <div className="advanced-fields">
                {advancedFields.map(renderField)}
              </div>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  );
}
