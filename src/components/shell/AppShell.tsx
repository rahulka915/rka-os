import { Outlet } from 'react-router-dom';
import { useState } from 'react';
import type { KeyboardEvent } from 'react';
import { BottomTabNav } from './BottomTabNav';
import { useUIStore } from '../../store/store';
import { parseActionInput } from '../../utils/nlp';
import { createAction } from '../../db/actions';
import './shell.css';

export function AppShell() {
  const { isQuickAddOpen, setQuickAddOpen } = useUIStore();
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = async (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && inputValue.trim()) {
      const parsed = parseActionInput(inputValue);
      await createAction(parsed.cleanText, parsed.date, parsed.projectOrTag || undefined);
      
      setInputValue('');
      setQuickAddOpen(false);
    } else if (e.key === 'Escape') {
      setQuickAddOpen(false);
    }
  };

  return (
    <div className="app-shell">
      <main className="main-content">
        <Outlet />
      </main>

      <BottomTabNav onQuickAdd={() => setQuickAddOpen(true)} />

      {isQuickAddOpen && (
        <div className="quick-add-modal-backdrop" onClick={() => setQuickAddOpen(false)}>
          <div className="quick-add-modal" onClick={e => e.stopPropagation()}>
            <input 
              autoFocus 
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="e.g. Buy chicken tmrw #groceries" 
              className="quick-add-input"
            />
          </div>
        </div>
      )}
    </div>
  );
}
