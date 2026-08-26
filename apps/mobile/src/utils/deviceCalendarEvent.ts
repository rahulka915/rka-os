import type { EventMeta } from './eventMeta';

// Pure — no device/native calls — split out of services/deviceCalendar.ts so
// it stays unit-testable under Node's test runner, which can't type-strip
// expo-calendar/legacy's native module import that deviceCalendar.ts needs.
export function buildDeviceCalendarEventInput(
  title: string,
  date: string,
  meta: Pick<EventMeta, 'startTime' | 'endTime' | 'location'>,
): { title: string; startDate: Date; endDate: Date; location?: string } {
  const [year, month, day] = date.split('-').map(Number);
  if (!meta.startTime) {
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return { title, startDate, endDate, location: meta.location };
  }
  const [startHour, startMinute] = meta.startTime.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  let endDate: Date;
  if (meta.endTime) {
    const [endHour, endMinute] = meta.endTime.split(':').map(Number);
    endDate = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60000);
  }
  return { title, startDate, endDate, location: meta.location };
}
