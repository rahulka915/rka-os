import { useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import type { ItemType } from '../db/db';
import { CalendarDays, Check, ChevronLeft, ChevronRight, Dumbbell, Pill as PillIcon, Pin, Repeat2 } from 'lucide-react';
import { useInspector } from '../components/shell/InspectorContext';
import { ActionList } from '../components/actions/ActionList';
import { formatDate } from '../db/actions';
import { EmptyState, IconButton, PageHeader, SegmentedControl } from '../components/ui/primitives';
import './calendar.css';

const DAYS_OF_WEEK = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

type CalendarView = 'today' | 'agenda' | 'month' | 'week';

export function Calendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [view, setView] = useState<CalendarView>('today');
  const { inspectEntity, inspectDay } = useInspector();

  const todayDate = formatDate(new Date());
  const instances = useLiveQuery(
    () => db.itemInstances.where('scheduledDate').equals(todayDate).toArray(),
    []
  );
  
  const itemsWithInstances = useLiveQuery(async () => {
    if (!instances) return [];
    const parentItems = await Promise.all(instances.map(inst => db.items.get(inst.itemId)));
    return instances.map((instance, index) => ({ instance, item: parentItems[index]! })).filter(entry => entry.item !== undefined);
  }, [instances]);

  const items = useLiveQuery(() => db.items.toArray());

  const getDaysInMonth = (date: Date) => {
    return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
  };

  const getFirstDayOfMonth = (date: Date) => {
    const day = new Date(date.getFullYear(), date.getMonth(), 1).getDay();
    return day === 0 ? 6 : day - 1; // Adjust for Monday start
  };

  const prevPeriod = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    if (view === 'week') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() - 7));
    if (view === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1)); // Jump by month in agenda
  };

  const nextPeriod = () => {
    if (view === 'month') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    if (view === 'week') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth(), currentDate.getDate() + 7));
    if (view === 'agenda') setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1)); // Jump by month in agenda
  };

  const getItemStyles = (type: ItemType) => {
    switch (type) {
      case 'task': return { icon: <Check size={12} />, color: 'var(--rka-blue)', bg: 'var(--rka-blue-soft)' };
      case 'workout-template': return { icon: <Dumbbell size={12} />, color: 'var(--rka-green)', bg: 'var(--rka-green-soft)' };
      case 'medication': return { icon: <PillIcon size={12} />, color: 'var(--rka-red)', bg: 'var(--rka-red-soft)' };
      case 'habit': return { icon: <Repeat2 size={12} />, color: 'var(--rka-orange)', bg: 'var(--rka-orange-soft)' };
      default: return { icon: <Pin size={12} />, color: 'var(--rka-text-secondary)', bg: 'var(--rka-fill)' };
    }
  };

  const renderMonthOrWeek = (isWeek: boolean) => {
    const daysInMonth = getDaysInMonth(currentDate);
    const firstDay = getFirstDayOfMonth(currentDate);
    const today = new Date();
    
    const cells = [];
    
    let startDay = 1;
    let endDay = daysInMonth;
    let padBefore = firstDay;
    
    if (isWeek) {
      const currentDay = currentDate.getDay() === 0 ? 6 : currentDate.getDay() - 1;
      const startOfWeek = new Date(currentDate);
      startOfWeek.setDate(currentDate.getDate() - currentDay);
      
      // Build 7 days
      for (let i = 0; i < 7; i++) {
        const d = new Date(startOfWeek);
        d.setDate(startOfWeek.getDate() + i);
        
        const isToday = today.getDate() === d.getDate() && today.getMonth() === d.getMonth() && today.getFullYear() === d.getFullYear();
        const dateString = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        
        const dayItems = items?.filter(item => {
          return item.scheduledDate === dateString || item.metadata?.dueDate === dateString;
        }) || [];

        cells.push(renderCell(d.getDate(), isToday, false, dateString, dayItems, isWeek));
      }
      return cells;
    }

    // Previous month padding
    for (let i = 0; i < padBefore; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-cell is-other-month" />);
    }

    // Current month days
    for (let i = startDay; i <= endDay; i++) {
      const isToday = today.getDate() === i && today.getMonth() === currentDate.getMonth() && today.getFullYear() === currentDate.getFullYear();
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      
      const dayItems = items?.filter(item => {
        return item.scheduledDate === dateString || item.metadata?.dueDate === dateString;
      }) || [];

      cells.push(renderCell(i, isToday, false, dateString, dayItems, false));
    }

    return cells;
  };

  const renderCell = (day: number, isToday: boolean, isOtherMonth: boolean, dateString: string, dayItems: any[], isWeek: boolean) => {
    const isMobile = window.innerWidth <= 767;
    const dense = isMobile || !isWeek; // month view or mobile always dense

    return (
      <div 
        key={dateString} 
        className={`calendar-cell ${isToday ? 'is-today' : ''} ${isOtherMonth ? 'is-other-month' : ''}`}
        onClick={() => inspectDay(dateString)}
      >
        <span className="calendar-cell-date">{day}</span>
        <div className={`calendar-items ${dense ? 'dense' : ''}`}>
          {dayItems.slice(0, 4).map(item => {
            const style = getItemStyles(item.type);
            return (
              <div 
                key={item.id} 
                className={`cal-chip ${dense ? 'icon-only' : ''}`}
                style={{ background: style.bg, color: style.color }}
                title={item.title}
                onClick={(e) => {
                  e.stopPropagation();
                  inspectEntity(item.id, item.type);
                }}
              >
                <span>{style.icon}</span>
                {!dense && <span>{item.title}</span>}
              </div>
            );
          })}
          {dayItems.length > 4 && (
            <div className={`cal-chip ${dense ? 'icon-only' : ''}`} style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
              +{dayItems.length - 4}
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderAgenda = () => {
    // Generate dates for the current month
    const daysInMonth = getDaysInMonth(currentDate);
    const agendaDays = [];

    for (let i = 1; i <= daysInMonth; i++) {
      const dateString = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(i).padStart(2, '0')}`;
      const dayItems = items?.filter(item => item.scheduledDate === dateString || item.metadata?.dueDate === dateString) || [];
      
      if (dayItems.length > 0) {
        agendaDays.push(
          <div key={dateString} className="agenda-day">
            <div className="agenda-date-header" onClick={() => inspectDay(dateString)} style={{ cursor: 'pointer' }}>
              {new Date(currentDate.getFullYear(), currentDate.getMonth(), i).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
            </div>
            {dayItems.map(item => {
              const style = getItemStyles(item.type);
              return (
                <div key={item.id} className="agenda-item" onClick={() => inspectEntity(item.id, item.type)}>
                  <div className="agenda-item-icon" style={{ background: style.bg, color: style.color }}>
                    {style.icon}
                  </div>
                  <div className="agenda-item-title">{item.title}</div>
                </div>
              );
            })}
          </div>
        );
      }
    }

    if (agendaDays.length === 0) {
      return (
        <EmptyState
          icon={<CalendarDays size={28} />}
          title="No scheduled items"
          description="This month is clear. Scheduled tasks and routines will show up here."
        />
      );
    }

    return <div className="agenda-view">{agendaDays}</div>;
  };

  const renderToday = () => {
    if (itemsWithInstances && itemsWithInstances.length > 0) {
      return (
        <div style={{ marginTop: '16px' }}>
          <ActionList items={itemsWithInstances} emptyMessage="" />
        </div>
      );
    }
    return (
      <EmptyState
        icon={<Check size={28} />}
        title="Nothing scheduled"
        description="Today is clear. Check the Agenda or Month view for upcoming items."
      />
    );
  };

  return (
    <div className="rka-page calendar-container">
      <div className="calendar-header">
        <div className="calendar-header-top">
          <PageHeader
            title={currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })}
            subtitle="Scheduled tasks, habits, medications, and routines."
          />
          <div className="calendar-nav">
            <IconButton label="Previous period" icon={<ChevronLeft size={20} />} onClick={prevPeriod} />
            <IconButton label="Next period" icon={<ChevronRight size={20} />} onClick={nextPeriod} />
          </div>
        </div>
        
        <SegmentedControl
          value={view}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'agenda', label: 'Agenda' },
          ]}
          onChange={setView}
        />
      </div>

      {view !== 'agenda' && view !== 'today' && (
        <div className="calendar-grid">
          {DAYS_OF_WEEK.map(day => (
            <div key={day} className="calendar-day-header">{day}</div>
          ))}
          {renderMonthOrWeek(view === 'week')}
        </div>
      )}

      {view === 'agenda' && renderAgenda()}
      {view === 'today' && renderToday()}
    </div>
  );
}
