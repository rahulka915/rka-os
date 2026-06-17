import type { Item, ItemInstance } from '../../db/db';
import { ActionItem } from './ActionItem';
import './actions.css';

interface ActionListProps {
  items: { item: Item; instance?: ItemInstance }[];
  emptyMessage?: string;
}

export function ActionList({ items, emptyMessage = 'No actions scheduled.' }: ActionListProps) {
  if (items.length === 0) {
    return <div className="empty-state text-muted">{emptyMessage}</div>;
  }

  return (
    <div className="action-list">
      {items.map(({ item, instance }) => (
        <ActionItem 
          key={instance?.id || item.id} 
          item={item} 
          instance={instance} 
        />
      ))}
    </div>
  );
}
