// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseEventMeta,
  computeReminderFireDate,
  formatClockTime,
  formatEventTimeLabel,
  REMINDER_OPTIONS,
  ALL_DAY_REMINDER_HOUR,
  toStorableMetadata,
} from './eventMeta.ts';

test('parseEventMeta returns {} for null/undefined/empty metadata', () => {
  assert.deepEqual(parseEventMeta(undefined), {});
  assert.deepEqual(parseEventMeta(null), {});
  assert.deepEqual(parseEventMeta(''), {});
});

test('parseEventMeta returns {} for unparseable JSON', () => {
  assert.deepEqual(parseEventMeta('{not json'), {});
});

test('parseEventMeta round-trips a full metadata object', () => {
  const json = JSON.stringify({
    startTime: '15:30',
    endTime: '17:00',
    location: 'The Fillmore',
    reminderMinutesBefore: 60,
    reminderNotificationId: 'notif-1',
    deviceCalendarEventId: 'device-1',
  });
  assert.deepEqual(parseEventMeta(json), {
    startTime: '15:30',
    endTime: '17:00',
    location: 'The Fillmore',
    reminderMinutesBefore: 60,
    reminderNotificationId: 'notif-1',
    deviceCalendarEventId: 'device-1',
  });
});

test('parseEventMeta drops non-string/non-number garbage fields', () => {
  const json = JSON.stringify({ startTime: 42, reminderMinutesBefore: 'soon', location: '' });
  assert.deepEqual(parseEventMeta(json), {});
});

test('computeReminderFireDate returns null when no reminderMinutesBefore is set', () => {
  assert.equal(computeReminderFireDate('2026-09-01', { startTime: '15:30' }), null);
});

test('computeReminderFireDate returns null once the fire time has already passed', () => {
  const now = new Date(2026, 8, 1, 15, 20); // Sept 1 2026, 3:20pm
  const result = computeReminderFireDate('2026-09-01', { startTime: '15:30', reminderMinutesBefore: 60 }, now);
  assert.equal(result, null);
});

test('computeReminderFireDate offsets from startTime for a timed event', () => {
  const now = new Date(2026, 8, 1, 8, 0);
  const result = computeReminderFireDate('2026-09-01', { startTime: '15:30', reminderMinutesBefore: 30 }, now);
  assert.equal(result.getHours(), 15);
  assert.equal(result.getMinutes(), 0);
});

test('computeReminderFireDate uses ALL_DAY_REMINDER_HOUR for an all-day event', () => {
  const now = new Date(2026, 7, 1, 8, 0);
  const result = computeReminderFireDate('2026-09-01', { reminderMinutesBefore: 1440 }, now);
  assert.equal(result.getDate(), 31); // Aug 31, 1 day before Sept 1 at ALL_DAY_REMINDER_HOUR
  assert.equal(result.getMonth(), 7);
  assert.equal(result.getHours(), ALL_DAY_REMINDER_HOUR);
});

test('formatClockTime formats 24h HH:MM as 12h with AM/PM', () => {
  assert.equal(formatClockTime('15:30'), '3:30 PM');
  assert.equal(formatClockTime('00:05'), '12:05 AM');
  assert.equal(formatClockTime('12:00'), '12:00 PM');
});

test('formatEventTimeLabel handles all-day, start-only, and start+end', () => {
  assert.equal(formatEventTimeLabel({}), 'All day');
  assert.equal(formatEventTimeLabel({ startTime: '15:30' }), '3:30 PM');
  assert.equal(formatEventTimeLabel({ startTime: '15:30', endTime: '17:00' }), '3:30 PM – 5:00 PM');
});

test('REMINDER_OPTIONS has the four fixed offsets', () => {
  assert.deepEqual(REMINDER_OPTIONS.map((o) => o.minutesBefore), [15, 30, 60, 1440]);
});

test('toStorableMetadata adds generic time/durationMinutes for a timed event with an end time', () => {
  const stored = toStorableMetadata({ startTime: '15:30', endTime: '17:00' });
  assert.equal(stored.time, '15:30');
  assert.equal(stored.durationMinutes, 90);
  assert.equal(stored.startTime, '15:30');
  assert.equal(stored.endTime, '17:00');
});

test('toStorableMetadata sets time but omits durationMinutes when there is no end time', () => {
  const stored = toStorableMetadata({ startTime: '15:30' });
  assert.equal(stored.time, '15:30');
  assert.equal('durationMinutes' in stored, false);
});

test('toStorableMetadata omits time entirely for an all-day event', () => {
  const stored = toStorableMetadata({});
  assert.equal('time' in stored, false);
  assert.equal('durationMinutes' in stored, false);
});
