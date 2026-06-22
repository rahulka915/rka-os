import { useState, useEffect, useRef } from 'react';
import { CheckSquare, Repeat, Pill, Dumbbell, Inbox } from 'lucide-react';
import { createEntity } from '../../db/actions';
import { BottomSheet } from '../ui/primitives';
import './quick-capture.css';

interface QuickAddSheetProps {
  onClose: () => void;
}

type CaptureType = 'task' | 'habit' | 'medication' | 'workout-template';

export function QuickAddSheet({ onClose }: QuickAddSheetProps) {
  const [title, setTitle] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedType, setSelectedType] = useState<CaptureType>('task');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  // Auto-focus on mount
  useEffect(() => {
    // Slight delay to ensure bottom sheet animation doesn't block focus
    const timer = setTimeout(() => {
      titleRef.current?.focus();
    }, 100);
    return () => clearTimeout(timer);
  }, []);

  // Natural Language Magic
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
      await createEntity(selectedType, title.trim(), { notes: notes.trim() }, status, undefined, []);
      onClose();
    } catch (e) {
      console.error(e);
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
    <BottomSheet open title="" onDismiss={onClose}>
      <div className="quick-capture-container">
        <input
          ref={titleRef}
          className="quick-capture-input"
          placeholder="New Item..."
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          onKeyDown={handleKeyDown}
        />
        <textarea
          className="quick-capture-notes"
          placeholder="Notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onKeyDown={handleKeyDown}
          rows={1}
        />

        <div className="quick-capture-toolbar">
          <div className="quick-capture-types">
            <button
              className={`quick-capture-type-btn ${selectedType === 'task' ? 'active type-task' : ''}`}
              onClick={() => setSelectedType('task')}
              aria-label="Task"
            >
              <CheckSquare size={20} />
            </button>
            <button
              className={`quick-capture-type-btn ${selectedType === 'habit' ? 'active type-habit' : ''}`}
              onClick={() => setSelectedType('habit')}
              aria-label="Habit"
            >
              <Repeat size={20} />
            </button>
            <button
              className={`quick-capture-type-btn ${selectedType === 'medication' ? 'active type-medication' : ''}`}
              onClick={() => setSelectedType('medication')}
              aria-label="Medication"
            >
              <Pill size={20} />
            </button>
            <button
              className={`quick-capture-type-btn ${selectedType === 'workout-template' ? 'active type-workout' : ''}`}
              onClick={() => setSelectedType('workout-template')}
              aria-label="Workout"
            >
              <Dumbbell size={20} />
            </button>
          </div>

          <button 
            className="quick-capture-save" 
            onClick={handleSave}
            disabled={!title.trim() || isSubmitting}
          >
            <Inbox size={18} /> Save
          </button>
        </div>
      </div>
    </BottomSheet>
  );
}
