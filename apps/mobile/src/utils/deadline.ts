export type DeadlineTone = 'overdue' | 'today' | 'soon' | 'future';

export interface DeadlineStatus {
  label: string;
  tone: DeadlineTone;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Whole-day difference between two YYYY-MM-DD strings. Parsed as UTC midnight
// so the result is pure calendar arithmetic, never shifted by the device zone.
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// How a task's deadline should read on a row. `today` is injected rather than
// read from the clock so this stays pure and testable.
export function deadlineStatus(dueDate: string | null | undefined, today: string): DeadlineStatus | null {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0) {
    const overdueBy = -days;
    return { label: `${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`, tone: 'overdue' };
  }
  if (days === 0) return { label: 'Due today', tone: 'today' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' };
  return { label: `Due ${formatShortDate(dueDate)}`, tone: 'future' };
}
