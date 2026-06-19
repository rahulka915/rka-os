import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ActionList } from '../actions/ActionList';
import { MetadataPill } from './primitives';
import type { Item, ItemInstance } from '../../db/db';

interface CollapsibleTimeBlockProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: { item: Item; instance: ItemInstance }[];
  defaultExpanded?: boolean;
}

export function CollapsibleTimeBlock({ id, label, icon, items, defaultExpanded = false }: CollapsibleTimeBlockProps) {
  const storageKey = `timeblock_expanded_${id}`;
  
  const [isExpanded, setIsExpanded] = useState(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved !== null) {
      return saved === 'true';
    }
    return defaultExpanded;
  });

  useEffect(() => {
    localStorage.setItem(storageKey, String(isExpanded));
  }, [isExpanded, storageKey]);

  if (items.length === 0) return null;

  return (
    <div style={{ marginBottom: '16px' }}>
      <div 
        onClick={() => setIsExpanded(!isExpanded)}
        style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', padding: '6px 2px', marginLeft: '-2px', paddingLeft: '2px', borderRadius: '10px', WebkitTapHighlightColor: 'transparent' }}
      >
        <MetadataPill
          label={
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              {icon}
              <span>{label}</span>
              <span>({items.length})</span>
            </span>
          }
          tone="gray"
        />
        {isExpanded ? <ChevronDown size={16} color="var(--text-muted)" /> : <ChevronRight size={16} color="var(--text-muted)" />}
      </div>
      
      {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          <ActionList items={items} />
        </div>
      )}
    </div>
  );
}
