import { useState, useEffect } from 'react';
import type { Item, ItemInstance } from '../../db/db';
import { ActionItem } from './ActionItem';
import { CurrentTimeIndicator } from './CurrentTimeIndicator';
import './actions.css';

interface ActionListProps {
  items: { item: Item; instance?: ItemInstance }[];
  emptyMessage?: string;
  isActiveBlock?: boolean;
}

export function ActionList({ items, emptyMessage = 'No actions scheduled.', isActiveBlock = false }: ActionListProps) {
  const [currentTimeStr, setCurrentTimeStr] = useState(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));

  useEffect(() => {
    if (!isActiveBlock) return;
    const interval = setInterval(() => {
      setCurrentTimeStr(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }));
    }, 30000);
    return () => clearInterval(interval);
  }, [isActiveBlock]);

  if (items.length === 0) {
    return (
      <div className="action-list">
        {isActiveBlock && <CurrentTimeIndicator />}
        <div className="empty-state text-muted">{emptyMessage}</div>
      </div>
    );
  }

  let insertIndex = items.length;
  if (isActiveBlock) {
    for (let i = 0; i < items.length; i++) {
      const { item, instance } = items[i];
      const timeA = (instance?.status === 'completed' && instance.completedAt) 
        ? new Date(instance.completedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: false }) 
        : item.metadata?.time || '99:99';
      
      if (timeA > currentTimeStr) {
        insertIndex = i;
        break;
      }
    }
  }

  return (
    <div className="action-list">
      {items.map(({ item, instance }, index) => (
        <div key={instance?.id || item.id} style={{ display: 'contents' }}>
          {isActiveBlock && index === insertIndex && <CurrentTimeIndicator />}
          <ActionItem item={item} instance={instance} />
        </div>
      ))}
      {isActiveBlock && insertIndex === items.length && <CurrentTimeIndicator />}
    </div>
  );
}
