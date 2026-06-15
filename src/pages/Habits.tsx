import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { HabitMetadata } from '../db/db';
import { v4 as uuidv4 } from 'uuid';
import { RRule } from 'rrule';
import { materializeInstances } from '../db/recurrence';

export function Habits() {
  const habits = useLiveQuery(() => db.items.where('type').equals('habit').toArray());

  const handleAddHabit = async () => {
    const title = prompt('Habit Name (e.g. Read 10 pages):');
    if (!title) return;
    
    const freq = prompt('Frequency? (daily/weekly)', 'daily');
    const rruleObj = new RRule({
      freq: freq === 'weekly' ? RRule.WEEKLY : RRule.DAILY,
      interval: 1,
      dtstart: new Date()
    });
    
    const meta: HabitMetadata = {
      currentStreak: 0,
      longestStreak: 0
    };
    
    const id = uuidv4();
    await db.items.add({
      id,
      type: 'habit',
      title,
      rrule: rruleObj.toString(),
      metadata: meta
    });
    
    await materializeInstances(id);
  };

  return (
    <div className="p-4">
      <div className="flex justify-between items-center mt-4 mb-4">
        <h1>Habits</h1>
        <button onClick={handleAddHabit} style={{background: 'var(--accent-color)', color: 'white', border: 'none', padding: '6px 12px', borderRadius: '6px', fontWeight: 600}}>New Habit</button>
      </div>
      
      {habits?.length === 0 && <p className="text-muted">No habits defined.</p>}
      
      <div className="action-list">
        {habits?.map(habit => {
          const meta = habit.metadata as HabitMetadata;
          return (
            <div key={habit.id} className="action-item flex-col" style={{alignItems: 'flex-start', padding: '16px 0'}}>
              <strong>{habit.title}</strong>
              <div className="text-muted mt-2" style={{fontSize: '0.85rem'}}>
                Current Streak: 🔥 {meta.currentStreak} &bull; Longest: {meta.longestStreak}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
