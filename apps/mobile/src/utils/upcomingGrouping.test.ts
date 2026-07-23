// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByScheduledDate } from './upcomingGrouping.ts';

const task = (id: string, scheduledDate: string) => ({ id, title: id, scheduledDate });

test('groups by date in ascending order', () => {
  const items = [task('b', '2026-07-26'), task('a', '2026-07-24'), task('c', '2026-07-26')];
  const groups = groupByScheduledDate(items, '2026-07-23');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-07-24');
  assert.deepEqual(groups[1].items.map((i) => i.id), ['b', 'c']);
});

test('labels tomorrow specially and dates the rest', () => {
  const groups = groupByScheduledDate([task('a', '2026-07-24'), task('b', '2026-08-12')], '2026-07-23');
  assert.equal(groups[0].label, 'TOMORROW');
  assert.equal(groups[1].label, 'WED 12 AUG');
});

test('skips items without a scheduled date', () => {
  assert.deepEqual(groupByScheduledDate([{ id: 'a', title: 'a' }], '2026-07-23'), []);
});
