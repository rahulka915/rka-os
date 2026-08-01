// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlockMeta, formatBlockSummary } from './workoutBlock.ts';

test('parseBlockMeta returns empty object for missing/malformed metadata', () => {
  assert.deepEqual(parseBlockMeta(undefined), {});
  assert.deepEqual(parseBlockMeta('not json'), {});
});

test('parseBlockMeta reads valid fields and drops invalid/blank ones', () => {
  assert.deepEqual(
    parseBlockMeta(JSON.stringify({ sets: 4, reps: '8-12', weight: '60kg', restSeconds: 90, notes: 'go slow' })),
    { sets: 4, reps: '8-12', weight: '60kg', restSeconds: 90, notes: 'go slow' },
  );
  assert.deepEqual(parseBlockMeta(JSON.stringify({ sets: '4', reps: '  ' })), {});
});

test('formatBlockSummary combines sets/reps/weight', () => {
  assert.equal(formatBlockSummary({ sets: 4, reps: '8-12', weight: '60kg' }), '4 × 8-12 · 60kg');
  assert.equal(formatBlockSummary({ sets: 3 }), '3 sets');
  assert.equal(formatBlockSummary({ reps: '20 min' }), '20 min');
  assert.equal(formatBlockSummary({ restSeconds: 60 }), 'Rest 60s');
  assert.equal(formatBlockSummary({}), 'Tap to configure');
});
