// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextWalkCycleFrame, WALK_CYCLE_FRAME_COUNT } from './walkCycle.ts';

test('advances to the next frame index', () => {
  assert.equal(getNextWalkCycleFrame(0), 1);
  assert.equal(getNextWalkCycleFrame(3), 4);
});

test('wraps back to 0 after the last frame', () => {
  assert.equal(getNextWalkCycleFrame(WALK_CYCLE_FRAME_COUNT - 1), 0);
});

test('supports a custom frame count', () => {
  assert.equal(getNextWalkCycleFrame(2, 3), 0);
});
