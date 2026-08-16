// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { getNextSpriteFrame, getNextWalkCycleFrame, WALK_CYCLE_FRAME_COUNT } from './walkCycle.ts';

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

test('loop mode wraps back to 0 after the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(3, 4, 'loop'), { frame: 0, didComplete: false });
});

test('loop mode advances normally before the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(1, 4, 'loop'), { frame: 2, didComplete: false });
});

test('once mode advances normally before the last frame', () => {
  assert.deepEqual(getNextSpriteFrame(1, 4, 'once'), { frame: 2, didComplete: false });
});

test('once mode holds on the last frame and reports completion', () => {
  assert.deepEqual(getNextSpriteFrame(3, 4, 'once'), { frame: 3, didComplete: true });
});
