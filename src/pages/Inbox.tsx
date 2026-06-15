import { useLiveQuery } from 'dexie-react-hooks';
import { getInboxItems, completeInboxItem } from '../db/actions';
import { ActionList } from '../components/actions/ActionList';
import type { Item } from '../db/db';

export function Inbox() {
  const inboxItems = useLiveQuery(() => getInboxItems(), []);

  const items = (inboxItems || []).map(item => ({ item }));

  const handleInboxComplete = async (item: Item) => {
    await completeInboxItem(item);
  };

  return (
    <div className="p-4">
      <h1 className="mt-4">Inbox</h1>
      <ActionList items={items} onInboxComplete={handleInboxComplete} emptyMessage="Your inbox is clear." />
    </div>
  );
}
