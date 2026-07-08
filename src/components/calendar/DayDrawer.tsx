import { useMemo, type ReactNode } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { CalendarClock, CheckCircle2, Clock3, Dumbbell, Moon, Plus, Pill, Repeat2, Sun, X } from 'lucide-react';
import { createEntity, updateEntity } from '../../db/actions';
import { db } from '../../db/db';
import type { Item, ItemType, ItemInstance } from '../../db/db';
import { useInspector } from '../shell/InspectorContext';
import { Button, EmptyState } from '../ui/primitives';
import { CurrentTimeIndicator } from '../actions/CurrentTimeIndicator';
import {
  extractTimelineMinutes,
  formatHourLabel,
  formatMinutesToTime,
  getApproximateMinutesForTimeOfDay,
  getTimeOfDayFromTime,
  normalizeTimeString,
} from '../../utils/time';
import '../inspector/inspector.css';

interface DayDrawerProps {
  date: string; // YYYY-MM-DD
  onClose: () => void;
}

type TimelineEntry = {
  item: Item;
  instance?: ItemInstance;
  minutes: number | null;
  timeLabel: string | null;
  isApproximate: boolean;
};

const TYPE_LABELS: Record<ItemType, string> = {
  task: 'Task',
  habit: 'Habit',
  medication: 'Medication',
  exercise: 'Exercise',
  'workout-template': 'Workout',
  'workout-block': 'Workout block',
  project: 'Project',
  area: 'Area',
  meal: 'Meal',
};

const TYPE_ICONS: Record<ItemType, ReactNode> = {
  task: <CheckCircle2 size={16} />,
  habit: <Repeat2 size={16} />,
  medication: <Pill size={16} />,
  exercise: <Dumbbell size={16} />,
  'workout-template': <Dumbbell size={16} />,
  'workout-block': <Dumbbell size={16} />,
  project: <CalendarClock size={16} />,
  area: <Clock3 size={16} />,
  meal: <Sun size={16} />,
};

const TYPE_COLORS: Record<ItemType, { bg: string; color: string }> = {
  task: { bg: 'var(--rka-blue-soft)', color: 'var(--rka-blue)' },
  habit: { bg: 'var(--rka-orange-soft)', color: 'var(--rka-orange)' },
  medication: { bg: 'var(--rka-red-soft)', color: 'var(--rka-red)' },
  exercise: { bg: 'var(--rka-green-soft)', color: 'var(--rka-green)' },
  'workout-template': { bg: 'var(--rka-green-soft)', color: 'var(--rka-green)' },
  'workout-block': { bg: 'var(--rka-green-soft)', color: 'var(--rka-green)' },
  project: { bg: 'var(--rka-blue-soft)', color: 'var(--rka-blue)' },
  area: { bg: 'var(--rka-fill)', color: 'var(--rka-text-secondary)' },
  meal: { bg: 'var(--rka-yellow-soft, var(--rka-fill))', color: 'var(--rka-text)' },
};

const DEFAULT_TITLES: Record<ItemType, string> = {
  task: 'New Task',
  habit: 'New Habit',
  medication: 'New Medication',
  exercise: 'New Exercise',
  'workout-template': 'New Workout',
  'workout-block': 'New Workout Block',
  project: 'New Project',
  area: 'New Area',
  meal: 'New Meal',
};

function getEntryTone(type: ItemType) {
  return TYPE_COLORS[type] ?? TYPE_COLORS.task;
}

function getEntryMinutes(item: Item, instance?: ItemInstance): number | null {
  return extractTimelineMinutes({
    metadata: item.metadata ?? undefined,
    instanceMetadata: instance?.instanceMetadata ?? undefined,
    completedAt: instance?.completedAt,
    status: instance?.status ?? item.status,
  });
}

export function DayDrawer({ date, onClose }: DayDrawerProps) {
  const { inspectEntity } = useInspector();

  const items = useLiveQuery(() => db.items.toArray());
  const instances = useLiveQuery(() => db.itemInstances.where('scheduledDate').equals(date).toArray());

  const dateObj = new Date(`${date}T12:00:00`);
  const dateLabel = dateObj.toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });

  const isToday = useMemo(() => {
    const today = new Date();
    return date === `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  }, [date]);

  const now = new Date();
  const currentHour = now.getHours();

  const { hourBuckets, floatingEntries, totalTimedEntries } = useMemo(() => {
    if (!items || !instances) {
      return {
        hourBuckets: Array.from({ length: 24 }, () => [] as TimelineEntry[]),
        floatingEntries: [] as TimelineEntry[],
        totalTimedEntries: 0,
      };
    }

    const candidateItems = items.filter(item => (
      item.scheduledDate === date || item.metadata?.dueDate === date
    ));

    const instanceByItemId = new Map(instances.map(instance => [instance.itemId, instance]));
    const entries = candidateItems.map((item): TimelineEntry => {
      const instance = instanceByItemId.get(item.id);
      const minutes = getEntryMinutes(item, instance);
      const exactTime = normalizeTimeString(instance?.instanceMetadata?.time ?? item.metadata?.time);
      const approximateMinutes = exactTime
        ? null
        : getApproximateMinutesForTimeOfDay(instance?.instanceMetadata?.timeOfDay ?? item.metadata?.timeOfDay);

      return {
        item,
        instance,
        minutes,
        timeLabel: exactTime
          ? exactTime
          : approximateMinutes != null
            ? `~${formatMinutesToTime(approximateMinutes)}`
            : minutes != null
              ? formatMinutesToTime(minutes)
              : null,
        isApproximate: !exactTime && approximateMinutes != null,
      };
    });

    const sorted = [...entries].sort((a, b) => {
      const minutesA = a.minutes ?? Number.POSITIVE_INFINITY;
      const minutesB = b.minutes ?? Number.POSITIVE_INFINITY;
      if (minutesA !== minutesB) return minutesA - minutesB;
      return a.item.createdAt - b.item.createdAt;
    });

    const hourBuckets = Array.from({ length: 24 }, () => [] as TimelineEntry[]);
    const floatingEntries: TimelineEntry[] = [];

    for (const entry of sorted) {
      if (entry.minutes == null) {
        floatingEntries.push(entry);
        continue;
      }

      const hour = Math.max(0, Math.min(23, Math.floor(entry.minutes / 60)));
      hourBuckets[hour].push(entry);
    }

    return {
      hourBuckets,
      floatingEntries,
      totalTimedEntries: sorted.length - floatingEntries.length,
    };
  }, [date, items, instances]);

  const handleQuickAdd = async (type: ItemType, time?: string) => {
    const title = DEFAULT_TITLES[type];
    const normalizedTime = normalizeTimeString(time);
    const timeOfDay = normalizedTime ? getTimeOfDayFromTime(normalizedTime) : undefined;
    const metadata = normalizedTime
      ? { time: normalizedTime, timeOfDay, gtdContext: 'scheduled' }
      : { gtdContext: 'scheduled' };

    const id = await createEntity(type, title, metadata, 'scheduled', date);
    const nowTs = Date.now();

    await db.itemInstances.add({
      id: crypto.randomUUID(),
      itemId: id,
      scheduledDate: date,
      status: 'pending',
      instanceMetadata: normalizedTime ? { time: normalizedTime, timeOfDay } : undefined,
      createdAt: nowTs,
      updatedAt: nowTs,
    });

    inspectEntity(id, type);
  };

  const handleRetime = async (item: Item, currentTime?: string | null) => {
    const nextTime = window.prompt('Set time for this block (HH:MM)', currentTime?.replace(/^~/, '') || '09:00');
    const normalizedTime = normalizeTimeString(nextTime);
    if (!normalizedTime) return;

    await updateEntity(item.id, {
      time: normalizedTime,
      timeOfDay: getTimeOfDayFromTime(normalizedTime),
      scheduledDate: date,
    });
  };

  if (!items || !instances) return null;

  return (
    <div className="inspector-overlay" onClick={onClose} style={{ zIndex: 2000 }}>
      <div className="inspector-panel" onClick={e => e.stopPropagation()}>
        <div className="inspector-header">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Day timeline
            </span>
            <h2 style={{ margin: 0, fontSize: '1.2rem', fontWeight: 700 }}>{dateLabel}</h2>
            <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              {isToday ? 'Live 24-hour planner' : '24-hour schedule and time blocks'}
            </span>
          </div>
          <button className="inspector-close-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="inspector-body day-timeline-shell">
          <div className="day-timeline-summary">
            <div className="day-timeline-summary-card">
              <div className="day-timeline-summary-label">Timed</div>
              <div className="day-timeline-summary-value">{totalTimedEntries}</div>
            </div>
            <div className="day-timeline-summary-card">
              <div className="day-timeline-summary-label">Floating</div>
              <div className="day-timeline-summary-value">{floatingEntries.length}</div>
            </div>
            <div className="day-timeline-summary-card">
              <div className="day-timeline-summary-label">Date</div>
              <div className="day-timeline-summary-value">{isToday ? 'Today' : 'Planned'}</div>
            </div>
          </div>

          <div className="day-timeline-actions">
            <Button variant="secondary" icon={<CheckCircle2 size={16} />} onClick={() => handleQuickAdd('task')}>
              Task
            </Button>
            <Button variant="secondary" icon={<Dumbbell size={16} />} onClick={() => handleQuickAdd('workout-template')}>
              Workout
            </Button>
            <Button variant="secondary" icon={<Pill size={16} />} onClick={() => handleQuickAdd('medication')}>
              Meds
            </Button>
            <Button variant="secondary" icon={<Repeat2 size={16} />} onClick={() => handleQuickAdd('habit')}>
              Habit
            </Button>
          </div>

          <div className="day-timeline">
            {Array.from({ length: 24 }, (_, hour) => {
              const entries = hourBuckets[hour];
              const isCurrentHour = isToday && hour === currentHour;

              return (
                <section key={hour} className={`day-timeline-hour ${isCurrentHour ? 'is-current' : ''}`}>
                  <div className="day-timeline-hour-gutter">
                    <div className="day-timeline-hour-label">{formatHourLabel(hour)}</div>
                    <button
                      type="button"
                      className="day-timeline-hour-add"
                      onClick={() => handleQuickAdd('task', formatHourLabel(hour))}
                    >
                      <Plus size={14} />
                      Add task
                    </button>
                  </div>

                  <div className="day-timeline-hour-body">
                    {isCurrentHour && (
                      <div className="day-timeline-now">
                        <CurrentTimeIndicator />
                      </div>
                    )}

                    {entries.length > 0 ? (
                      entries.map(entry => {
                        const tone = getEntryTone(entry.item.type);
                        return (
                          <div key={entry.instance?.id || entry.item.id} className="day-entry">
                            <button
                              type="button"
                              className="day-entry-main"
                              onClick={() => inspectEntity(entry.item.id, entry.item.type)}
                            >
                              <span
                                className="day-entry-icon"
                                style={{ background: tone.bg, color: tone.color }}
                              >
                                {TYPE_ICONS[entry.item.type]}
                              </span>
                              <span className="day-entry-copy">
                                <span className="day-entry-title">{entry.item.title}</span>
                                <span className="day-entry-subtitle">
                                  {entry.timeLabel ? `${entry.timeLabel} · ` : ''}
                                  {TYPE_LABELS[entry.item.type]}
                                  {entry.isApproximate ? ' time' : ''}
                                </span>
                              </span>
                            </button>

                            <button
                              type="button"
                              className="day-entry-time"
                              onClick={() => handleRetime(entry.item, entry.timeLabel)}
                              aria-label={`Edit time for ${entry.item.title}`}
                            >
                              {entry.timeLabel ?? 'Set time'}
                            </button>
                          </div>
                        );
                      })
                    ) : (
                      <div className="day-timeline-hour-empty">
                        <span>Open hour</span>
                        <button
                          type="button"
                          className="day-timeline-hour-add is-compact"
                          onClick={() => handleQuickAdd('task', formatHourLabel(hour))}
                        >
                          <Plus size={14} />
                          Add block
                        </button>
                      </div>
                    )}
                  </div>
                </section>
              );
            })}
          </div>

          <section className="day-timeline-floating">
            <div className="day-timeline-floating-header">
              <h3>Unscheduled</h3>
              <span>{floatingEntries.length}</span>
            </div>

            {floatingEntries.length > 0 ? (
              <div className="day-timeline-floating-list">
                {floatingEntries.map(entry => {
                  const tone = getEntryTone(entry.item.type);
                  return (
                    <div key={entry.instance?.id || entry.item.id} className="day-entry">
                      <button
                        type="button"
                        className="day-entry-main"
                        onClick={() => inspectEntity(entry.item.id, entry.item.type)}
                      >
                        <span className="day-entry-icon" style={{ background: tone.bg, color: tone.color }}>
                          {TYPE_ICONS[entry.item.type]}
                        </span>
                        <span className="day-entry-copy">
                          <span className="day-entry-title">{entry.item.title}</span>
                          <span className="day-entry-subtitle">
                            {TYPE_LABELS[entry.item.type]}
                          </span>
                        </span>
                      </button>
                      <button
                        type="button"
                        className="day-entry-time"
                        onClick={() => handleRetime(entry.item, entry.timeLabel)}
                        aria-label={`Set time for ${entry.item.title}`}
                      >
                        Set time
                      </button>
                    </div>
                  );
                })}
              </div>
            ) : (
              <EmptyState
                title="Everything is placed"
                description="Every item on this date already has a time block."
                icon={<Moon size={26} />}
              />
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
