import { useLiveQuery } from 'dexie-react-hooks';
import { CheckCircle2 } from 'lucide-react';
import { db } from '../../db/db';
import { ActionList } from '../actions/ActionList';
import { EmptyState, BottomSheet } from '../ui/primitives';

interface InboxSheetProps {
  open: boolean;
  onClose: () => void;
}

export function InboxSheet({ open, onClose }: InboxSheetProps) {
  const inboxItems = useLiveQuery(() => db.items.where('status').equals('inbox').toArray(), []);

  // Do not render contents if sheet is closed to avoid unneeded query evaluation when inactive
  if (!open) return null;

  const items = inboxItems || [];

  return (
    <BottomSheet 
      open={open} 
      onDismiss={onClose}
      title="Inbox"
    >
      <div style={{ padding: '0 20px 24px', maxHeight: '70vh', overflowY: 'auto' }}>
        <p style={{ color: 'var(--rka-text-secondary)', fontSize: '14px', marginBottom: '16px' }}>
          Capture loose thoughts here. Organize them when you are ready.
        </p>

        {items.length > 0 ? (
          <ActionList items={items.map(item => ({ item }))} />
        ) : (
          <EmptyState
            icon={<CheckCircle2 size={28} />}
            title="Inbox Zero"
            description="All items have been organized and assigned."
          />
        )}
      </div>
    </BottomSheet>
  );
}
