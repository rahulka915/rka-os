import type { Item, ItemInstance } from '../../db/db';
import { ActionItem } from './ActionItem';
import './actions.css';

interface ActionListProps {
  items: { item: Item; instance?: ItemInstance }[];
  onInboxComplete?: (item: Item) => void;
  emptyMessage?: string;
}

export function ActionList({ items, onInboxComplete, emptyMessage = 'Nothing to do here.' }: ActionListProps) {
  if (items.length === 0) {
    return <div className="empty-state">{emptyMessage}</div>;
  }

  return (
    <div className="action-list">
      {items.map(({ item, instance }) => (
        <ActionItem 
          key={instance?.id || item.id} 
          item={item} 
          instance={instance} 
          onInboxComplete={onInboxComplete}
        />
      ))}
    </div>
  );
}
