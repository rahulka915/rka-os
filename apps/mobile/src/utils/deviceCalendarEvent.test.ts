// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeviceCalendarEventInput } from './deviceCalendarEvent.ts';

test('buildDeviceCalendarEventInput builds a timed event with start and end', () => {
  const result = buildDeviceCalendarEventInput('Concert', '2026-09-15', { startTime: '19:00', endTime: '22:00', location: 'The Fillmore' });
  assert.equal(result.title, 'Concert');
  assert.equal(result.startDate.getFullYear(), 2026);
  assert.equal(result.startDate.getMonth(), 8);
  assert.equal(result.startDate.getDate(), 15);
  assert.equal(result.startDate.getHours(), 19);
  assert.equal(result.endDate.getHours(), 22);
  assert.equal(result.location, 'The Fillmore');
});

test('buildDeviceCalendarEventInput defaults a missing end time to one hour after start', () => {
  const result = buildDeviceCalendarEventInput('Appointment', '2026-09-15', { startTime: '15:30' });
  assert.equal(result.startDate.getHours(), 15);
  assert.equal(result.startDate.getMinutes(), 30);
  assert.equal(result.endDate.getHours(), 16);
  assert.equal(result.endDate.getMinutes(), 30);
});

test('buildDeviceCalendarEventInput treats an all-day event as spanning midnight to midnight', () => {
  const result = buildDeviceCalendarEventInput('Birthday', '2026-09-15', {});
  assert.equal(result.startDate.getHours(), 0);
  assert.equal(result.endDate.getDate(), 16);
  assert.equal(result.endDate.getHours(), 0);
});
