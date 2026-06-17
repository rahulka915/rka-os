import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ActionList } from '../components/actions/ActionList';

export function Inbox() {
  const inboxItems = useLiveQuery(() => db.items.where('status').equals('inbox').toArray(), []);

  const items = (inboxItems || []).map(item => ({ item }));

  return (
    <div className="p-4 pb-20">
      <h1 className="mt-4 mb-6">Inbox</h1>
      <ActionList items={items} emptyMessage="Inbox is empty." />
    </div>
  );
}
