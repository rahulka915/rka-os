import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox as InboxIcon } from 'lucide-react';
import { db } from '../db/db';
import { ActionList } from '../components/actions/ActionList';
import { EmptyState, MetadataPill, PageHeader } from '../components/ui/primitives';
import './inbox.css';

export function Inbox() {
  const inboxItems = useLiveQuery(() => db.items.where('status').equals('inbox').toArray(), []);

  const items = inboxItems || [];

  return (
    <div className="rka-page inbox-screen">
      <PageHeader
        title="Inbox"
        subtitle="Capture loose thoughts first. Organize them when you are ready."
      />

      <section className="rka-section">
        <div className="inbox-summary">
          <MetadataPill label={`${items.length} item${items.length === 1 ? '' : 's'}`} icon={<InboxIcon size={12} />} tone="gray" />
        </div>

        {items.length > 0 ? (
          <ActionList items={items.map(item => ({ item }))} />
        ) : (
          <EmptyState
            icon={<InboxIcon size={28} />}
            title="Inbox is clear"
            description="Use New to capture a task, habit, medication, or workout."
          />
        )}
      </section>
    </div>
  );
}
