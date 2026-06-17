import { useState } from 'react';
import { ChevronDown, ChevronRight, X } from 'lucide-react';
import { ENTITY_SCHEMAS } from '../../schema/entitySchema';
import type { FieldSchema } from '../../schema/entitySchema';
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

  const isValid = schema.fields.filter(f => f.required).every(f => {
    const v = formData[f.id];
    return v !== undefined && v !== '' && (Array.isArray(v) ? v.length > 0 : true);
  });

  return (
    <div className="creator-overlay" onClick={onClose}>
      <div className="creator-sheet" onClick={e => e.stopPropagation()}>
        
        <div className="creator-header">
          <div className="creator-header-title">
            <span>New {schema.label}</span>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8E8E93', cursor: 'pointer' }}>
            <X size={20} />
          </button>
        </div>

        <div className="creator-body">
          {coreFields.map(renderField)}

          {advancedFields.length > 0 && (
            <div className="mt-2">
              <button className="advanced-toggle" onClick={() => setShowAdvanced(!showAdvanced)}>
                {showAdvanced ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                Advanced Options
              </button>
              
              {showAdvanced && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', marginTop: '16px' }}>
                  {advancedFields.map(renderField)}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="creator-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={handleSave} disabled={!isValid || isSaving}>
            {isSaving ? 'Saving...' : 'Create'}
          </button>
        </div>

      </div>
    </div>
  );
}
