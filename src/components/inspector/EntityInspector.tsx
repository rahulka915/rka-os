import { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../../db/db';
import { updateEntity } from '../../db/actions';
import { ENTITY_SCHEMAS } from '../../schema/entitySchema';
import type { FieldSchema } from '../../schema/entitySchema';
import { X, CheckCircle2 } from 'lucide-react';
import { TextField } from '../creator/fields/TextField';
import { SingleSelectField } from '../creator/fields/SingleSelectField';
import { NumberSelectorField } from '../creator/fields/NumberSelectorField';
import { MultiSelectField } from '../creator/fields/MultiSelectField';
import { SubItemsField } from '../creator/fields/SubItemsField';
import { EntityLinkerField } from '../creator/fields/EntityLinkerField';
import { TimeField } from '../creator/fields/TimeField';
import { EntityRelationships } from './EntityRelationships';
import { EntityActivity } from './EntityActivity';
import { ProjectDashboard } from './ProjectDashboard';
import { WorkoutDashboard } from './WorkoutDashboard';
import { MedicationDashboard } from './MedicationDashboard';
import { ExerciseDetail } from '../workouts/ExerciseDetail';
import { MetadataPill } from '../ui/primitives';
import './inspector.css';

interface EntityInspectorProps {
  entityId: string;
  entityType: string;
  onClose: () => void;
}

export function EntityInspector({ entityId, entityType, onClose }: EntityInspectorProps) {
  const schema = ENTITY_SCHEMAS[entityType];
  const [formData, setFormData] = useState<Record<string, any>>({});
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const debounceRef = useRef<number | undefined>(undefined);

  const entity = useLiveQuery(async () => {
    return db.items.get(entityId);
  }, [entityId]);

  const tags = useLiveQuery(async () => {
    if (entityType === 'project') return [];
    const mappings = await db.itemTags.where('itemId').equals(entityId).toArray();
    return db.tags.where('id').anyOf(mappings.map(m => m.tagId)).toArray();
  }, [entityId, entityType]);

  // Load initial data
  useEffect(() => {
    if (entity && tags !== undefined) {
      const e = entity as any;
      const initial: Record<string, any> = {
        title: e.title,
        scheduledDate: e.scheduledDate || '',
        tags: tags.map(t => t.name),
        ...(e.metadata || {}),
        ...(entityType === 'project' ? { color: e.metadata?.color } : {})
      };
      setFormData(initial);
    }
  }, [entity, tags, entityType]);

  const handleFieldChange = (fieldId: string, value: any) => {
    setFormData(prev => ({ ...prev, [fieldId]: value }));
    triggerSave({ [fieldId]: value });
  };

  const triggerSave = (updates: Record<string, any>) => {
    setSaveStatus('saving');
    if (debounceRef.current) clearTimeout(debounceRef.current);
    
    debounceRef.current = window.setTimeout(async () => {
      try {
        await updateEntity(entityId, { ...formData, ...updates });
        setSaveStatus('saved');
        setTimeout(() => setSaveStatus('idle'), 2000);
      } catch (e) {
        console.error(e);
        setSaveStatus('error');
      }
    }, 500); // 500ms debounce
  };

  if (!schema || !entity) return null;

  const titleValue = formData.title ?? entity.title ?? '';
  const titlePlaceholder = titleValue.trim().length === 0 ? 'Untitled' : '';

  const statusTone = entity.status === 'completed'
    ? 'green'
    : entity.status === 'active'
      ? 'blue'
      : entity.status === 'inbox'
        ? 'gray'
        : 'orange';

  const renderField = (field: FieldSchema) => {
    if (field.id === 'title') return null; // Rendered specially at the top
    const val = formData[field.id] || (field.type === 'multi-select' ? [] : '');
    
    return (
      <div key={field.id} className="inspector-property-row">
        <div className="inspector-property-label">{field.label}</div>
        <div className="inspector-property-value">
          {field.type === 'text' || field.type === 'textarea' ? (
             <TextField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'single-select' ? (
             <SingleSelectField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'number-selector' ? (
             <NumberSelectorField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'multi-select' ? (
             <MultiSelectField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'sub-items' ? (
             <SubItemsField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'entity-linker' ? (
             <EntityLinkerField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : field.type === 'date' ? (
             <input type="date" className="inspector-input-bare" value={val} onChange={e => handleFieldChange(field.id, e.target.value)} />
          ) : field.type === 'time' ? (
             <TimeField field={field} value={val} onChange={(v) => handleFieldChange(field.id, v)} />
          ) : null}
        </div>
      </div>
    );
  };

  return (
    <div className="inspector-overlay" onClick={onClose}>
      <div className="inspector-panel" onClick={e => e.stopPropagation()}>
        
        <div className="inspector-header">
          <div className="inspector-status" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <MetadataPill label={entity.status} tone={statusTone} />
            {saveStatus === 'saving' && <span style={{color: '#8E8E93'}}>Saving...</span>}
            {saveStatus === 'saved' && <span style={{color: '#10B981', display: 'flex', alignItems: 'center', gap: '4px'}}><CheckCircle2 size={14}/> Saved</span>}
            {saveStatus === 'error' && <span style={{color: '#FF453A'}}>Failed to save</span>}
          </div>
          <button className="inspector-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="inspector-body">
          <input 
            type="text" 
            className="inspector-title-input" 
            value={titleValue}
            onChange={e => handleFieldChange('title', e.target.value)} 
            placeholder={titlePlaceholder}
          />

          <div className="inspector-properties" style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
            
            <section>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Overview</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {entityType === 'project' && <ProjectDashboard projectId={entityId} />}
                {entityType === 'workout-template' && <WorkoutDashboard workoutId={entityId} />}
                {entityType === 'medication' && <MedicationDashboard medicationId={entityId} />}
                {entityType === 'exercise' && <ExerciseDetail exerciseId={entityId} />}
                
                {entityType !== 'exercise' && entityType !== 'workout-template' && schema.fields.filter(f => !['title', 'scheduledDate', 'timeOfDay', 'rrule', 'tags'].includes(f.id) && f.type !== 'entity-linker').map(renderField)}
              </div>
            </section>

            {schema.fields.some(f => ['scheduledDate', 'timeOfDay', 'rrule'].includes(f.id)) && (
              <section>
                <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Scheduling</h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                  {schema.fields.filter(f => ['scheduledDate', 'timeOfDay', 'rrule'].includes(f.id)).map(renderField)}
                </div>
              </section>
            )}

            {entityType !== 'exercise' && entityType !== 'workout-template' && (
            <section style={{ marginBottom: '32px' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Relationships</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                <EntityRelationships entityId={entityId} />
                {schema.fields.filter(f => f.type === 'entity-linker').map(renderField)}
              </div>
            </section>
            )}

            {entityType !== 'exercise' && entityType !== 'workout-template' && (
            <section style={{ marginBottom: '48px' }}>
              <h3 style={{ fontSize: '12px', color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '16px', letterSpacing: '0.5px' }}>Activity / History</h3>
              <EntityActivity entityId={entityId} />
            </section>
            )}

            {entityType !== 'workout-template' && (
            <section>
              <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', marginBottom: '16px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Advanced</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {schema.fields.filter(f => ['tags'].includes(f.id)).map(renderField)}
              </div>
            </section>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
