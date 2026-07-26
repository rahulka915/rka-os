// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countDosesByDay, groupLogsByDay } from './medicationDoseHistory.ts';

const NOW = new Date('2026-07-26T18:00:00.000Z').getTime();

test('countDosesByDay counts logs per calendar day across the window', () => {
  const timestamps = [
    new Date('2026-07-26T10:00:00.000Z').getTime(),
    new Date('2026-07-26T14:00:00.000Z').getTime(),
    new Date('2026-07-24T09:00:00.000Z').getTime(),
  ];
  const history = countDosesByDay(timestamps, 5, NOW);
  assert.equal(history.length, 5);
  assert.deepEqual(history.map((d) => d.date), ['2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']);
  assert.equal(history.find((d) => d.date === '2026-07-26')?.count, 2);
  assert.equal(history.find((d) => d.date === '2026-07-24')?.count, 1);
  assert.equal(history.find((d) => d.date === '2026-07-25')?.count, 0);
});

test('countDosesByDay returns zero counts when there are no logs', () => {
  const history = countDosesByDay([], 3, NOW);
  assert.deepEqual(history.map((d) => d.count), [0, 0, 0]);
});

test('groupLogsByDay groups logs by calendar day, most recent day first', () => {
  const logs = [
    { id: 'c', timestamp: new Date('2026-07-26T14:00:00.000Z').getTime() },
    { id: 'b', timestamp: new Date('2026-07-26T10:00:00.000Z').getTime() },
    { id: 'a', timestamp: new Date('2026-07-24T09:00:00.000Z').getTime() },
  ];
  const groups = groupLogsByDay(logs, NOW);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-07-26');
  assert.equal(groups[0].label, 'Today');
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].logs.map((l) => l.id), ['c', 'b']);
  assert.equal(groups[1].date, '2026-07-24');
  assert.equal(groups[1].label, 'Jul 24');
});

test('groupLogsByDay labels yesterday specially', () => {
  const logs = [{ id: 'a', timestamp: new Date('2026-07-25T09:00:00.000Z').getTime() }];
  const groups = groupLogsByDay(logs, NOW);
  assert.equal(groups[0].label, 'Yesterday');
});

test('groupLogsByDay returns an empty array for no logs', () => {
  assert.deepEqual(groupLogsByDay([], NOW), []);
});
