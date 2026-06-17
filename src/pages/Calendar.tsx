import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import './calendar.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const { inspectEntity, inspectDay } = useInspector();

  // Get items to populate calendar
  const items = useLiveQuery(() => db.items.toArray());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust for Monday start
  };

  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
  };

  const renderCells = () => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const today = new Date();
    
    const cells = [];
    
    // Previous month padding
    for (let i = 0; i < firstDay; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-cell is-other-month" />);
    }

    // Current month days
    for (let i = 1; i <= daysInMonth; i++) {
      const isToday = today.getDate() === i && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
      
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      // Get items for this day
      const dayItems = items?.filter(item => {
        return item.scheduledDate === dateString || item.metadata?.dueDate === dateString;
      }) || [];

      cells.push(
        <div 
          key={i} 
          className={`calendar-cell ${isToday ? 'is-today' : ''}`}
          onClick={() => inspectDay(dateString)}
        >
          <span className="calendar-cell-date">{i}</span>
          <div className="calendar-dots">
            {dayItems.slice(0, 4).map(item => {
              let icon = '✓';
              let color = '#555';
              let bg = 'var(--bg-tertiary)';
              
              if (item.type === 'task') { color = 'var(--accent-color)'; bg = 'rgba(10, 132, 255, 0.1)'; }
              if (item.type === 'workout-template') { icon = '💪'; color = '#10B981'; bg = 'rgba(16, 185, 129, 0.1)'; }
              if (item.type === 'medication') { icon = '💊'; color = '#EF4444'; bg = 'rgba(239, 68, 68, 0.1)'; }
              if (item.type === 'habit') { icon = '🔁'; color = '#F59E0B'; bg = 'rgba(245, 158, 11, 0.1)'; }

              return (
                <div 
                  key={item.id} 
                  style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: bg, color, fontSize: '10px' }}
                  title={item.title}
                  onClick={(e) => {
                    e.stopPropagation();
                    inspectEntity(item.id, item.type);
                  }}
                >
                  {icon}
                </div>
              );
            })}
            {dayItems.length > 4 && (
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '20px', height: '20px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)', fontSize: '10px', fontWeight: 600 }}>
                +{dayItems.length - 4}
              </div>
            )}
          </div>
        </div>
      );
    }

    return cells;
  };

  return (
    <div className="calendar-container">
      <div className="calendar-header">
        <h1 style={{ fontSize: '1.6rem', fontWeight: 600, margin: 0 }}>
          {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
        </h1>
        
        <div className="calendar-nav">
          <button className="calendar-nav-btn" onClick={prevMonth}>
            <ChevronLeft size={20} />
          </button>
          <button className="calendar-nav-btn" onClick={nextMonth}>
            <ChevronRight size={20} />
          </button>
        </div>
      </div>

      <div className="calendar-grid">
        {DAYS_OF_WEEK.map(day => (
          <div key={day} className="calendar-day-header">{day}</div>
        ))}
        {renderCells()}
      </div>
    </div>
  );
}
