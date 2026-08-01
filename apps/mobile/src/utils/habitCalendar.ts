import { parseRepeatRule, dayMatchesRepeat, addDays } from './repeat';

export interface HabitCalendarDay {
  date: string;           // YYYY-MM-DD
  dayOfMonth: number;
  inCurrentMonth: boolean;
  isScheduled: boolean;   // rrule matches this date
  isCompleted: boolean;   // in completedDates
  isToday: boolean;
  isFuture: boolean;      // date > today
}

export interface HabitCalendarMonth {
  year: number;
  month: number;          // 0-11
  label: string;          // "August 2026"
  weeks: HabitCalendarDay[][];
}

const MONTH_LABELS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function toDateString(year: number, month: number, day: number): string {
  const mm = String(month + 1).padStart(2, '0');
  const dd = String(day).padStart(2, '0');
  return `${year}-${mm}-${dd}`;
}

// Builds full calendar weeks (Sun-Sat) covering the target month, including
// leading/trailing days from adjacent months so every week row has 7 cells.
export function buildHabitCalendarMonth(
  rrule: string | null | undefined,
  completedDates: Set<string>,
  anchor: Date,
  today: string,
): HabitCalendarMonth {
  const year = anchor.getFullYear();
  const month = anchor.getMonth();
  const rule = parseRepeatRule(rrule);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstOfMonth = toDateString(year, month, 1);
  const firstWeekday = new Date(`${firstOfMonth}T00:00:00`).getDay();

  const cells: HabitCalendarDay[] = [];

  // Leading days from the previous month.
  for (let i = firstWeekday - 1; i >= 0; i--) {
    const date = addDays(firstOfMonth, -(i + 1));
    cells.push(buildDay(date, false, rule, completedDates, today));
  }

  // Days in the target month.
  for (let day = 1; day <= daysInMonth; day++) {
    const date = toDateString(year, month, day);
    cells.push(buildDay(date, true, rule, completedDates, today));
  }

  // Trailing days from the next month, padded to a full week.
  while (cells.length % 7 !== 0) {
    const last = cells[cells.length - 1].date;
    const date = addDays(last, 1);
    cells.push(buildDay(date, false, rule, completedDates, today));
  }

  const weeks: HabitCalendarDay[][] = [];
  for (let i = 0; i < cells.length; i += 7) {
    weeks.push(cells.slice(i, i + 7));
  }

  return { year, month, label: `${MONTH_LABELS[month]} ${year}`, weeks };
}

function buildDay(
  date: string,
  inCurrentMonth: boolean,
  rule: ReturnType<typeof parseRepeatRule>,
  completedDates: Set<string>,
  today: string,
): HabitCalendarDay {
  return {
    date,
    dayOfMonth: Number(date.split('-')[2]),
    inCurrentMonth,
    isScheduled: rule ? dayMatchesRepeat(rule, date) : false,
    isCompleted: completedDates.has(date),
    isToday: date === today,
    isFuture: date > today,
  };
}
