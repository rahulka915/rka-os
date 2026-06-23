import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { ActionList } from '../actions/ActionList';
import type { Item, ItemInstance } from '../../db/db';

interface CollapsibleTimeBlockProps {
  id: string;
  label: string;
  icon: React.ReactNode;
  items: { item: Item; instance: ItemInstance }[];
  defaultExpanded?: boolean;
  isActiveBlock?: boolean;
}

export function CollapsibleTimeBlock({ id, label, icon, items, defaultExpanded = false, isActiveBlock = false }: CollapsibleTimeBlockProps) {
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

  const getHeaderStyle = () => {
    switch(id) {
      case 'morning': return { bg: '#FFF5F0', color: '#E87D43' }; // Soft peach/orange
      case 'afternoon': return { bg: '#F0F5FF', color: '#4A6BC6' }; // Soft blue
      case 'evening': return { bg: '#F5F0FF', color: '#8A5BC6' }; // Soft purple
      default: return { bg: '#F4F4F5', color: '#3C3C43' }; // Soft gray
    }
  };

  const style = getHeaderStyle();

  return (
    <div style={{ marginBottom: '24px' }}>
      <div 
        className="time-block-header active-scale" 
        onClick={() => {
          import('../../utils/haptics').then(m => m.haptics.light());
          setIsExpanded(!isExpanded);
        }}
        style={{ 
          cursor: 'pointer', 
          display: 'inline-flex', 
          alignItems: 'center', 
          gap: '8px', 
          padding: '8px 14px', 
          borderRadius: '999px',
          background: style.bg,
          color: style.color,
          fontWeight: 600,
          fontSize: '13px',
          letterSpacing: '0.04em',
          textTransform: 'uppercase',
          marginBottom: '12px',
          WebkitTapHighlightColor: 'transparent'
        }}
      >
        {icon}
        <span>{label} ({items.length})</span>
        <div style={{ marginLeft: '4px', display: 'flex', alignItems: 'center' }}>
          {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </div>
      </div>
      
      {isExpanded && (
        <div style={{ paddingLeft: '0px' }}>
          <ActionList items={items} emptyMessage={`Nothing scheduled for ${label.toLowerCase()} yet.`} isActiveBlock={isActiveBlock} />
        </div>
      )}
    </div>
  );
}
