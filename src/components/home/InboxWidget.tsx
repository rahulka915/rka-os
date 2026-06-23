import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox, CheckCircle2, ChevronRight } from 'lucide-react';
import { db } from '../../db/db';
import { InboxSheet } from './InboxSheet';
import './inbox-widget.css';

export function InboxWidget() {
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  
  const inboxCount = useLiveQuery(async () => {
    return await db.items.where('status').equals('inbox').count();
  }, []);

  // Wait for initial load
  if (inboxCount === undefined) return null;

  const isEmpty = inboxCount === 0;

  return (
    <>
      <div 
        className={`inbox-widget ${isEmpty ? 'is-empty' : 'has-items'} active-scale`} 
        onClick={() => {
          import('../../utils/haptics').then(m => m.haptics.medium());
          const input = document.getElementById('inbox-quick-capture-input');
          if (input) input.focus();
          setIsSheetOpen(true);
        }}
        role="button"
        tabIndex={0}
      >
        <div className="inbox-widget-icon">
          {isEmpty ? <CheckCircle2 size={20} strokeWidth={2.5} /> : <Inbox size={20} strokeWidth={2} />}
        </div>
        <div className="inbox-widget-content">
          <span className="inbox-widget-title">
            {isEmpty ? 'Inbox Zero' : `Inbox (${inboxCount})`}
          </span>
          <span className="inbox-widget-subtitle">
            {isEmpty ? 'Everything is planned.' : 'Unassigned items need your attention.'}
          </span>
        </div>
        {!isEmpty && (
          <div className="inbox-widget-action">
            <ChevronRight size={18} />
          </div>
        )}
      </div>

      <InboxSheet open={isSheetOpen} onClose={() => setIsSheetOpen(false)} />
    </>
  );
}
