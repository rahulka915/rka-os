// Calendar Events metadata — see database.ts's createEvent/updateEvent for the
// repository functions that read/write these, and
// docs/superpowers/specs/2026-08-26-calendar-events-design.md for the full spec.

export interface EventMeta {
  startTime?: string;               // 'HH:MM' 24h, absent = all-day event
  endTime?: string;                 // 'HH:MM' 24h, optional, only meaningful when startTime is set
  location?: string;
  reminderMinutesBefore?: number;   // one of REMINDER_OPTIONS' values; absent = no reminder
  reminderNotificationId?: string;  // expo-notifications id, native only — for cancel/reschedule on edit/delete
  deviceCalendarEventId?: string;   // id of the device calendar event created alongside this one, native only — never re-read or written back to after creation
}

export function parseEventMeta(metadata?: string | null): EventMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    const result: EventMeta = {};
    const startTime = str(parsed.startTime);
    const endTime = str(parsed.endTime);
    const location = str(parsed.location);
    const reminderMinutesBefore = num(parsed.reminderMinutesBefore);
    const reminderNotificationId = str(parsed.reminderNotificationId);
    const deviceCalendarEventId = str(parsed.deviceCalendarEventId);
    if (startTime !== undefined) result.startTime = startTime;
    if (endTime !== undefined) result.endTime = endTime;
    if (location !== undefined) result.location = location;
    if (reminderMinutesBefore !== undefined) result.reminderMinutesBefore = reminderMinutesBefore;
    if (reminderNotificationId !== undefined) result.reminderNotificationId = reminderNotificationId;
    if (deviceCalendarEventId !== undefined) result.deviceCalendarEventId = deviceCalendarEventId;
    return result;
  } catch {
    return {};
  }
}

export interface ReminderOption {
  label: string;
  minutesBefore: number;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: '15 minutes before', minutesBefore: 15 },
  { label: '30 minutes before', minutesBefore: 30 },
  { label: '1 hour before', minutesBefore: 60 },
  { label: '1 day before', minutesBefore: 1440 },
];

// Default local hour an all-day event's reminder fires at, since there's no
// clock time to offset from (spec: "fires at a fixed default local time").
export const ALL_DAY_REMINDER_HOUR = 9;

// Computes the wall-clock Date a reminder should fire at, or null if that
// moment has already passed relative to `now` — never schedule a past-dated
// notification (spec's Reminder section).
export function computeReminderFireDate(
  scheduledDate: string,
  meta: Pick<EventMeta, 'startTime' | 'reminderMinutesBefore'>,
  now: Date = new Date(),
): Date | null {
  if (!meta.reminderMinutesBefore) return null;
  const [year, month, day] = scheduledDate.split('-').map(Number);
  let anchor: Date;
  if (meta.startTime) {
    const [hour, minute] = meta.startTime.split(':').map(Number);
    anchor = new Date(year, month - 1, day, hour, minute, 0, 0);
  } else {
    anchor = new Date(year, month - 1, day, ALL_DAY_REMINDER_HOUR, 0, 0, 0);
  }
  const fireDate = new Date(anchor.getTime() - meta.reminderMinutesBefore * 60000);
  return fireDate.getTime() > now.getTime() ? fireDate : null;
}

// 'HH:MM' 24h -> "7:50 PM", for display only — mirrors backwardPlanMeta.ts's
// formatClockTime so the two features read consistently.
export function formatClockTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// For the timeline/row label: "3:30 PM" (start only), "3:30 PM – 5:00 PM"
// (both), "All day" (no startTime).
export function formatEventTimeLabel(meta: Pick<EventMeta, 'startTime' | 'endTime'>): string {
  if (!meta.startTime) return 'All day';
  if (!meta.endTime) return formatClockTime(meta.startTime);
  return `${formatClockTime(meta.startTime)} – ${formatClockTime(meta.endTime)}`;
}
