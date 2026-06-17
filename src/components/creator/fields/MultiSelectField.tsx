import { useState, useRef, useEffect } from 'react';
import type { FieldSchema } from '../../../schema/entitySchema';
import { X } from 'lucide-react';
import { db } from '../../../db/db';
import { v4 as uuidv4 } from 'uuid';
import { useLiveQuery } from 'dexie-react-hooks';

interface MultiSelectFieldProps {
  field: FieldSchema;
  value: string[]; // array of tag names (for simplicity, or IDs. Let's use tag names like in QuickAdd)
  onChange: (val: string[]) => void;
}

export function MultiSelectField({ field, value, onChange }: MultiSelectFieldProps) {
  const [inputValue, setInputValue] = useState('');
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Fetch all existing tags
  const existingTags = useLiveQuery(() => db.tags.toArray()) || [];
  
  const filteredTags = existingTags.filter(t => 
    t.name.toLowerCase().includes(inputValue.toLowerCase()) && 
    !value.includes(t.name)
  );

  const exactMatch = existingTags.find(t => t.name.toLowerCase() === inputValue.toLowerCase());

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (tagName: string) => {
    onChange([...value, tagName]);
    setInputValue('');
    setIsDropdownOpen(false);
  };

  const handleRemove = (tagName: string) => {
    onChange(value.filter(t => t !== tagName));
  };

  const handleInlineCreate = async () => {
    const trimmed = inputValue.trim();
    if (!trimmed) return;
    
    // Save to DB immediately so it gets an ID and is globally available
    if (field.inlineCreateType === 'tag' && !exactMatch) {
      await db.tags.add({
        id: uuidv4(),
        name: trimmed,
        color: '#3B82F6',
        createdAt: Date.now()
      });
    }

    handleSelect(trimmed);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredTags.length > 0 && !exactMatch) {
        handleSelect(filteredTags[0].name);
      } else {
        handleInlineCreate();
      }
    }
  };

  return (
    <div className="field-group" ref={containerRef}>
      <label className="field-label">{field.label}</label>
      <div className="multi-select-container" style={{ position: 'relative' }}>
        
        {value.map(tagName => (
          <div key={tagName} className="token-chip">
            {tagName}
            <button type="button" className="token-remove" onClick={() => handleRemove(tagName)}>
              <X size={14} />
            </button>
          </div>
        ))}

        <input
          type="text"
          className="multi-select-input"
          placeholder={value.length === 0 ? `Add ${field.label}...` : ''}
          value={inputValue}
          onChange={e => {
            setInputValue(e.target.value);
            setIsDropdownOpen(true);
          }}
          onFocus={() => setIsDropdownOpen(true)}
          onKeyDown={handleKeyDown}
        />

        {isDropdownOpen && (inputValue || filteredTags.length > 0) && (
          <div className="dropdown-menu">
            {filteredTags.map(t => (
              <div key={t.id} className="dropdown-item" onClick={() => handleSelect(t.name)}>
                {t.name}
              </div>
            ))}
            
            {inputValue.trim() && !exactMatch && field.allowInlineCreate && (
              <div className="dropdown-item" style={{ color: 'var(--accent-color)', display: 'flex', alignItems: 'center' }} onClick={handleInlineCreate}>
                + Create "{inputValue.trim()}"
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
