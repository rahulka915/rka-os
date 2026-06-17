// Removed unused React imports
import type { FieldSchema } from '../../../schema/entitySchema';
import { v4 as uuidv4 } from 'uuid';
import { GripVertical, Plus, X } from 'lucide-react';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensors,
  useSensor
} from '@dnd-kit/core';
import type { DragEndEvent } from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import '../../../pages/projects.css'; // Reuse basic metrics styling, or local subitems CSS

export interface SubItemData {
  id: string;
  title: string;
  completed: boolean;
  order: number;
}

interface SubItemsFieldProps {
  field: FieldSchema;
  value: SubItemData[];
  onChange: (val: SubItemData[]) => void;
}

function SortableItem({ id, item, onChangeItem, onRemoveItem }: { id: string, item: SubItemData, onChangeItem: (item: SubItemData) => void, onRemoveItem: () => void }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : 0,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div ref={setNodeRef} style={style} className="subitem-card">
      <div 
        className="subitem-drag-handle" 
        {...attributes} 
        {...listeners}
      >
        <GripVertical size={16} />
      </div>
      
      <button 
        className="subitem-checkbox" 
        onClick={() => onChangeItem({ ...item, completed: !item.completed })}
      >
        {item.completed && (
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        )}
      </button>

      <input 
        type="text" 
        className="subitem-input" 
        placeholder="Item title..." 
        value={item.title} 
        onChange={(e) => onChangeItem({ ...item, title: e.target.value })}
      />

      <button className="subitem-remove" onClick={onRemoveItem}>
        <X size={16} />
      </button>
    </div>
  );
}

export function SubItemsField({ field, value = [], onChange }: SubItemsFieldProps) {
  const items = Array.isArray(value) ? value : [];
  
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const oldIndex = items.findIndex(i => i.id === active.id);
      const newIndex = items.findIndex(i => i.id === over.id);
      
      const newItems = arrayMove(items, oldIndex, newIndex);
      // update order property
      const reordered = newItems.map((item, index) => ({ ...item, order: index }));
      onChange(reordered);
    }
  };

  const handleAddItem = () => {
    const newItem: SubItemData = {
      id: uuidv4(),
      title: '',
      completed: false,
      order: items.length
    };
    onChange([...items, newItem]);
  };

  const handleChangeItem = (updatedItem: SubItemData) => {
    onChange(items.map(i => i.id === updatedItem.id ? updatedItem : i));
  };

  const handleRemoveItem = (id: string) => {
    const newItems = items.filter(i => i.id !== id);
    onChange(newItems.map((item, index) => ({ ...item, order: index })));
  };

  return (
    <div className="field-group">
      <label className="field-label" style={{ marginBottom: '12px' }}>{field.label}</label>
      
      <div className="subitems-container">
        <DndContext 
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext 
            items={items.map(i => i.id)}
            strategy={verticalListSortingStrategy}
          >
            {items.map(item => (
              <SortableItem 
                key={item.id} 
                id={item.id} 
                item={item} 
                onChangeItem={handleChangeItem}
                onRemoveItem={() => handleRemoveItem(item.id)}
              />
            ))}
          </SortableContext>
        </DndContext>

        <button 
          className="subitem-add-btn" 
          onClick={handleAddItem}
        >
          <Plus size={16} /> Add new
        </button>
      </div>
    </div>
  );
}
