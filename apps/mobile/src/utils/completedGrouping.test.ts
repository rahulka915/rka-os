// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCompletedByDay } from './completedGrouping.ts';

const DAY_MS = 24 * 60 * 60 * 1000;

function itemAt(id: string, timestamp: number) {
  return { id, title: id, completedAt: timestamp, updatedAt: timestamp };
}

test('groups items completed today under TODAY', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', now.getTime() - 60_000)];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'TODAY');
  assert.deepEqual(groups[0].items, items);
});

test('groups items completed yesterday under YESTERDAY', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', now.getTime() - DAY_MS)];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'YESTERDAY');
});

test('groups older items under a month-day label', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', new Date('2026-07-12T09:00:00Z').getTime())];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'JULY 12');
});

test('preserves descending order and splits multiple days into separate groups', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [
    itemAt('today', now.getTime() - 60_000),
    itemAt('yesterday', now.getTime() - DAY_MS),
    itemAt('older', new Date('2026-07-01T09:00:00Z').getTime()),
  ];
  const groups = groupCompletedByDay(items, now);
  assert.deepEqual(groups.map(g => g.label), ['TODAY', 'YESTERDAY', 'JULY 1']);
  assert.deepEqual(groups.map(g => g.items[0].id), ['today', 'yesterday', 'older']);
});

test('falls back to updatedAt when completedAt is missing', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [{ id: 'legacy', title: 'legacy', updatedAt: now.getTime() - 60_000 }];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups[0].label, 'TODAY');
});

test('returns no groups for an empty list', () => {
  assert.deepEqual(groupCompletedByDay([]), []);
});
