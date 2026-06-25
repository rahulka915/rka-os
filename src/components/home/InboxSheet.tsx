import { useState, useRef, useEffect } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Inbox, CheckSquare } from 'lucide-react';
import { db } from '../../db/db';
import { ActionList } from '../actions/ActionList';
import { BottomSheet } from '../ui/primitives';
import { createEntity } from '../../db/actions';
import { haptics } from '../../utils/haptics';
import '../shell/quick-capture.css';

interface InboxSheetProps {
  open: boolean;
  onClose: () => void;
}

type CaptureType = 'task' | 'habit' | 'medication' | 'workout-template';

export function InboxSheet({ open, onClose }: InboxSheetProps) {
  const [title, setTitle] = useState('');
  const [selectedType, setSelectedType] = useState<CaptureType>('task');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const inboxItems = useLiveQuery(() => db.items.where('status').equals('inbox').toArray(), []);
  const items = inboxItems || [];

  // Auto-focus input when sheet opens
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => {
        inputRef.current?.focus();
      }, 100);
      return () => clearTimeout(t);
    }
  }, [open]);

  // Natural language type parsing
  useEffect(() => {
    const t = title.toLowerCase();
    if (/\b(take|mg|dose|pill|tablet)\b/.test(t)) {
      setSelectedType('medication');
    } else if (/\b(workout|gym|train|run|leg day|push day|pull day)\b/.test(t)) {
      setSelectedType('workout-template');
    } else if (/\b(every|daily|routine|always)\b/.test(t)) {
      setSelectedType('habit');
    }
  }, [title]);

  const handleSave = async () => {
    if (!title.trim() || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const status = selectedType === 'task' ? 'inbox' : 'active';
      await createEntity(selectedType, title.trim(), {}, status, undefined, []);
      setTitle('');
      haptics.success();
    } catch (e) {
      console.error(e);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSave();
    }
  };

  return (
    <BottomSheet
      open={open}
      onDismiss={onClose}
    >
      <div style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', minHeight: '75dvh' }}>
        
        {/* Compact Header & Quick Capture */}
        <div style={{ padding: '0 16px 12px', flexShrink: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: 800, margin: 0, color: 'var(--rka-text)' }}>Inbox</h2>
            <span style={{ fontSize: '13px', color: 'var(--rka-text-secondary)', fontWeight: 500 }}>
              {items.length} waiting
            </span>
          </div>
          
          <p style={{ color: 'var(--rka-text-secondary)', fontSize: '13px', margin: '0 0 12px 0', lineHeight: 1.3 }}>
            Capture loose thoughts. Organize when ready.
          </p>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <input
              ref={inputRef}
              style={{
                flex: 1,
                background: 'var(--rka-fill)',
                border: 'none',
                borderRadius: 'var(--rka-radius-control)',
                padding: '10px 14px',
                fontSize: '15px',
                color: 'var(--rka-text)',
                outline: 'none',
              }}
              placeholder="Type to capture..."
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              onKeyDown={handleKeyDown}
            />
            <button 
              className="active-scale"
              style={{
                background: title.trim() ? 'var(--rka-blue)' : 'var(--rka-fill)',
                color: title.trim() ? 'white' : 'var(--rka-text-tertiary)',
                border: 'none',
                borderRadius: 'var(--rka-radius-control)',
                width: '40px',
                height: '40px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: title.trim() ? 'pointer' : 'default',
                transition: 'all 0.2s'
              }}
              disabled={!title.trim() || isSubmitting}
              onClick={handleSave}
            >
              <Inbox size={18} strokeWidth={2.5} />
            </button>
          </div>
        </div>

        {/* Scrollable Inbox Items */}
        <div style={{ flex: 1, overflowY: 'auto', overscrollBehavior: 'contain', padding: '0 16px 24px', WebkitOverflowScrolling: 'touch' }}>
          {items.length > 0 ? (
            <ActionList items={items.map(item => ({ item }))} />
          ) : (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--rka-text-tertiary)' }}>
              <CheckSquare size={32} style={{ opacity: 0.5, marginBottom: '8px' }} />
              <div style={{ fontSize: '14px', fontWeight: 600 }}>Inbox Zero</div>
            </div>
          )}
        </div>
      </div>
    </BottomSheet>
  );
}
