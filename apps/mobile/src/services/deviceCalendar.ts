// The plain 'expo-calendar' entrypoint on SDK 57 re-exports these classic functions as a
// deprecated shim pointing at a new object-oriented API — importing from '/legacy' gets
// the real, working implementation with the exact function signatures used below.
import * as Calendar from 'expo-calendar/legacy';
import { buildDeviceCalendarEventInput } from '../utils/deviceCalendarEvent';
import type { EventMeta } from '../utils/eventMeta';

export { buildDeviceCalendarEventInput };

export interface DeviceCalendarEvent {
  id: string;
  title: string;
  startMinutes: number;
  durationMinutes: number;
}

export async function requestCalendarAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

// Status-only check — never prompts. Used to render a connect/connected row in Settings
// without triggering the permission dialog just by opening the screen.
export async function getCalendarAccessStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

async function getReadableCalendarIds(): Promise<string[]> {
  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  return calendars.map((calendar) => calendar.id);
}

function toDeviceEvent(event: Calendar.Event, dayStart: Date): DeviceCalendarEvent {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  // Clamp to the requested day so a multi-day event only shows the portion that overlaps it.
  const startMinutes = start < dayStart
    ? 0
    : start.getHours() * 60 + start.getMinutes();
  const endMinutes = Math.max(startMinutes + 5, Math.round((end.getTime() - Math.max(start.getTime(), dayStart.getTime())) / 60000) + startMinutes);
  return {
    id: event.id,
    title: event.title || 'Untitled event',
    startMinutes,
    durationMinutes: Math.min(24 * 60 - startMinutes, endMinutes - startMinutes),
  };
}

// Read-only — never writes to the device calendar. All-day events are excluded since
// they have no clock time to position on an hour-grid timeline.
export async function getTodayDeviceEvents(): Promise<DeviceCalendarEvent[]> {
  return getDeviceEventsForDate(new Date());
}

// Read-only — same contract as getTodayDeviceEvents, for an arbitrary day (used by the
// Calendar timeline so device events show as fixed "busy" blocks alongside app items).
export async function getDeviceEventsForDate(date: Date): Promise<DeviceCalendarEvent[]> {
  const granted = await requestCalendarAccess();
  if (!granted) return [];

  const calendarIds = await getReadableCalendarIds();
  if (calendarIds.length === 0) return [];

  const startOfDay = new Date(date);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(date);
  endOfDay.setHours(23, 59, 59, 999);

  const events = await Calendar.getEventsAsync(calendarIds, startOfDay, endOfDay);

  return events
    .filter((event) => !event.allDay)
    .map((event) => toDeviceEvent(event, startOfDay));
}

// --- Write path (new, opt-in) ----------------------------------------------
// Every export above this line is read-only by design (see file header).
// This section is a deliberate, additive exception scoped to Calendar
// Events only: one-way, create-only writes, never re-read or updated after
// creation — see docs/superpowers/specs/2026-08-26-calendar-events-design.md's
// "Device calendar write" section for the full rationale.

export async function requestCalendarWriteAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getCalendarWriteAccessStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

export async function createDeviceCalendarEvent(
  title: string,
  date: string,
  meta: EventMeta,
  notes?: string,
): Promise<string | undefined> {
  const granted = await requestCalendarWriteAccess();
  if (!granted) return undefined;
  try {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    const input = buildDeviceCalendarEventInput(title, date, meta);
    return await Calendar.createEventAsync(defaultCalendar.id, {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      notes,
      allDay: !meta.startTime,
    });
  } catch {
    // Fail soft — the RKA-side event is still created regardless (see spec).
    return undefined;
  }
}
