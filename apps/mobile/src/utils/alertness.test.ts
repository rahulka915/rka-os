// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeAlertness } from './alertness.ts';

test('computeAlertness: no sleepAmount answer yields null, not a guessed default', () => {
  assert.equal(computeAlertness({}), null);
  assert.equal(computeAlertness({ sleepQuality: 'deep' }), null);
});

test('computeAlertness: unrecognized sleepAmount value yields null', () => {
  assert.equal(computeAlertness({ sleepAmount: 'a full night' }), null);
});

test('computeAlertness: low sleep amount + rough quality reads low', () => {
  const value = computeAlertness({ sleepAmount: '<4', sleepQuality: 'rough' });
  assert.ok(value !== null && value < 20, `expected a low value, got ${value}`);
});

test('computeAlertness: 8+ hours + deep quality reads high', () => {
  const value = computeAlertness({ sleepAmount: '8+', sleepQuality: 'deep' });
  assert.ok(value !== null && value >= 90, `expected a high value, got ${value}`);
});

test('computeAlertness: missing sleepQuality still returns a value from sleepAmount alone', () => {
  const value = computeAlertness({ sleepAmount: '6-8' });
  assert.equal(value, 75);
});

test('computeAlertness: result is always clamped to [0, 100]', () => {
  const value = computeAlertness({ sleepAmount: '<4', sleepQuality: 'rough' });
  assert.ok(value >= 0 && value <= 100);
});
