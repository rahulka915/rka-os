// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeTodayJourneyProgress } from './todayJourneyProgress.ts';

const items = [
  { id: '1', type: 'task', status: 'pending' },
  { id: '2', type: 'task', status: 'completed' },
  { id: '3', type: 'task', status: 'pending' },
  { id: '4', type: 'habit', status: 'pending' },
];

test('counts only task-type items', () => {
  assert.deepEqual(computeTodayJourneyProgress(items, new Map()), { completedCount: 1, totalCount: 3 });
});

test('counts a pending "complete" action as done immediately', () => {
  const pendingActions = new Map([['1', 'complete']]);
  assert.deepEqual(computeTodayJourneyProgress(items, pendingActions), { completedCount: 2, totalCount: 3 });
});

test('excludes items pending delete or move from the total', () => {
  const pendingActions = new Map([['3', 'delete']]);
  assert.deepEqual(computeTodayJourneyProgress(items, pendingActions), { completedCount: 1, totalCount: 2 });
});
