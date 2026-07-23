// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineStatus, daysBetween } from './deadline.ts';

test('returns null when there is no deadline', () => {
  assert.equal(deadlineStatus(undefined, '2026-07-23'), null);
  assert.equal(deadlineStatus(null, '2026-07-23'), null);
});

test('flags a past deadline as overdue', () => {
  assert.deepEqual(deadlineStatus('2026-07-22', '2026-07-23'), { label: '1 day overdue', tone: 'overdue' });
  assert.deepEqual(deadlineStatus('2026-07-20', '2026-07-23'), { label: '3 days overdue', tone: 'overdue' });
});

test('flags today and tomorrow distinctly', () => {
  assert.deepEqual(deadlineStatus('2026-07-23', '2026-07-23'), { label: 'Due today', tone: 'today' });
  assert.deepEqual(deadlineStatus('2026-07-24', '2026-07-23'), { label: 'Due tomorrow', tone: 'soon' });
});

test('counts down within a week, then shows a date', () => {
  assert.deepEqual(deadlineStatus('2026-07-27', '2026-07-23'), { label: 'Due in 4 days', tone: 'soon' });
  assert.deepEqual(deadlineStatus('2026-08-12', '2026-07-23'), { label: 'Due 12 Aug', tone: 'future' });
});

test('daysBetween spans month boundaries', () => {
  assert.equal(daysBetween('2026-07-30', '2026-08-02'), 3);
  assert.equal(daysBetween('2026-08-02', '2026-07-30'), -3);
});
