// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { findNextUpItem } from './nextUpItem.ts';

function item(overrides = {}) {
  return {
    id: 'item-1',
    type: 'task',
    title: 'Review notes',
    status: 'active',
    metadata: JSON.stringify({ timeOfDay: 'morning' }),
    createdAt: 1,
    updatedAt: 1,
    ...overrides,
  };
}

test('uses an exact scheduled time when one exists', () => {
  const result = findNextUpItem([
    item({ type: 'medication', title: 'Elvanse', metadata: JSON.stringify({ time: '08:00', timeOfDay: 'morning' }) }),
  ], [], 7);

  assert.equal(result?.timeOfDayLabel, '08:00');
});

test('falls back to the time bucket when no exact time exists', () => {
  const result = findNextUpItem([item()], [], 7);
  assert.equal(result?.timeOfDayLabel, 'Morning');
});

test('malformed legacy metadata does not prevent the next item rendering', () => {
  const result = findNextUpItem([item({ metadata: '{bad-json' })], [], 7);
  assert.equal(result?.title, 'Review notes');
  assert.equal(result?.timeOfDayLabel, 'Anytime');
});
