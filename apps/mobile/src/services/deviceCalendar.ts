// The plain 'expo-calendar' entrypoint on SDK 57 re-exports these classic functions as a
// deprecated shim pointing at a new object-oriented API — importing from '/legacy' gets
// the real, working implementation with the exact function signatures used below.
import * as Calendar from 'expo-calendar/legacy';

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

// Read-only — never writes to the device calendar. All-day events are excluded since
// they have no clock time to position on an hour-grid timeline.
export async function getTodayDeviceEvents(): Promise<DeviceCalendarEvent[]> {
  const granted = await requestCalendarAccess();
  console.log('[deviceCalendar] permission granted:', granted);
  if (!granted) return [];

  const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
  console.log('[deviceCalendar] calendars found:', calendars.length, calendars.map((c) => c.title));
  const calendarIds = calendars.map((calendar) => calendar.id);
  if (calendarIds.length === 0) return [];

  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date();
  endOfDay.setHours(23, 59, 59, 999);

  const events = await Calendar.getEventsAsync(calendarIds, startOfDay, endOfDay);
  console.log('[deviceCalendar] raw events found:', events.length, events.map((e) => ({ title: e.title, start: e.startDate, allDay: e.allDay })));

  return events
    .filter((event) => !event.allDay)
    .map((event) => {
      const start = new Date(event.startDate);
      const end = new Date(event.endDate);
      return {
        id: event.id,
        title: event.title || 'Untitled event',
        startMinutes: start.getHours() * 60 + start.getMinutes(),
        durationMinutes: Math.max(5, Math.round((end.getTime() - start.getTime()) / 60000)),
      };
    });
}
