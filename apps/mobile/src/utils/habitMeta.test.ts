// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeHabitPeriodProgress, parseHabitMeta } from './habitMeta.ts';
import type { Item, ActivityLog } from '../db/types';

function makeHabit(metadata: object): Item {
  return {
    id: 'h1',
    type: 'habit',
    title: 'Drink water',
    status: 'active',
    metadata: JSON.stringify(metadata),
    createdAt: 0,
    updatedAt: 0,
  };
}

test('parseHabitMeta: no metadata defaults to binary/daily/mark-done', () => {
  const meta = parseHabitMeta(makeHabit({}));
  assert.equal(meta.measurement, 'binary');
  assert.equal(meta.targetPeriod, 'daily');
  assert.equal(meta.contextualAction, 'mark-done');
});

test('parseHabitMeta: malformed metadata falls back to defaults', () => {
  const item: Item = { id: 'h1', type: 'habit', title: 'X', status: 'active', metadata: '{not json', createdAt: 0, updatedAt: 0 };
  const meta = parseHabitMeta(item);
  assert.equal(meta.measurement, 'binary');
});

test('computeHabitPeriodProgress: sums count samples within the current daily window', () => {
  const item = makeHabit({ measurement: 'count', targetValue: 8, targetUnit: 'glasses', targetPeriod: 'daily' });
  const today = new Date('2026-08-05T12:00:00Z');
  const samples: ActivityLog[] = [
    { id: 's1', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-05T09:00:00Z').getTime(), details: JSON.stringify({ value: 3 }), createdAt: 0 },
    { id: 's2', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-05T10:00:00Z').getTime(), details: JSON.stringify({ value: 2 }), createdAt: 0 },
    { id: 's3', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-04T10:00:00Z').getTime(), details: JSON.stringify({ value: 5 }), createdAt: 0 },
  ];
  const progress = computeHabitPeriodProgress(item, samples, today);
  assert.equal(progress.current, 5);
  assert.equal(progress.target, 8);
  assert.equal(progress.unit, 'glasses');
});

test('computeHabitPeriodProgress: weekly window sums across the whole week, not just today', () => {
  const item = makeHabit({ measurement: 'duration', targetValue: 120, targetUnit: 'min', targetPeriod: 'weekly' });
  const wednesday = new Date('2026-08-05T12:00:00Z'); // Wed
  const samples: ActivityLog[] = [
    { id: 's1', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-02T09:00:00Z').getTime(), details: JSON.stringify({ value: 30 }), createdAt: 0 }, // Sunday of same week
    { id: 's2', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-05T10:00:00Z').getTime(), details: JSON.stringify({ value: 40 }), createdAt: 0 },
    { id: 's3', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-07-26T10:00:00Z').getTime(), details: JSON.stringify({ value: 100 }), createdAt: 0 }, // prior week
  ];
  const progress = computeHabitPeriodProgress(item, samples, wednesday);
  assert.equal(progress.current, 70);
});

test('computeHabitPeriodProgress: ignores samples from other habits', () => {
  const item = makeHabit({ measurement: 'count', targetValue: 5, targetPeriod: 'daily' });
  const today = new Date('2026-08-05T12:00:00Z');
  const samples: ActivityLog[] = [
    { id: 's1', entityId: 'other-habit', actionType: 'habit-sample', timestamp: today.getTime(), details: JSON.stringify({ value: 99 }), createdAt: 0 },
  ];
  const progress = computeHabitPeriodProgress(item, samples, today);
  assert.equal(progress.current, 0);
});

test('computeHabitPeriodProgress: binary habits default to a 0/1 progress shape regardless of samples', () => {
  const item = makeHabit({});
  const progress = computeHabitPeriodProgress(item, [], new Date('2026-08-05T12:00:00Z'));
  assert.equal(progress.current, 0);
  assert.equal(progress.target, 1);
});
