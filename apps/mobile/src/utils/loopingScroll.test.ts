// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { computeLoopFrame, LAYER_SCROLL_CONFIG, RESET_CROSSFADE_MS } from './loopingScroll.ts';

function assertClose(actual: number, expected: number, tolerance = 0.001) {
  assert.ok(Math.abs(actual - expected) <= tolerance, `expected ${actual} to be close to ${expected}`);
}

test('computeLoopFrame: at the very start of the cycle, primary is fully opaque and reset copy is hidden', () => {
  const frame = computeLoopFrame(0, 0.1);
  assert.equal(frame.scrollFraction, 0);
  assertClose(frame.primaryOpacity, 1);
  assertClose(frame.resetOpacity, 0);
});

test('computeLoopFrame: before the crossfade window, primary stays fully opaque', () => {
  const frame = computeLoopFrame(0.85, 0.1);
  assertClose(frame.primaryOpacity, 1);
  assertClose(frame.resetOpacity, 0);
});

test('computeLoopFrame: halfway through the crossfade window, both copies are half-visible', () => {
  const frame = computeLoopFrame(0.95, 0.1);
  assertClose(frame.primaryOpacity, 0.5);
  assertClose(frame.resetOpacity, 0.5);
});

test('computeLoopFrame: at the very end of the cycle, primary is nearly invisible and reset copy is nearly fully visible', () => {
  const frame = computeLoopFrame(1, 0.1);
  assertClose(frame.primaryOpacity, 0, 0.01);
  assertClose(frame.resetOpacity, 1, 0.01);
});

test('computeLoopFrame: opacities always sum to 1', () => {
  for (let t = 0; t <= 1; t += 0.05) {
    const frame = computeLoopFrame(t, 0.15);
    assertClose(frame.primaryOpacity + frame.resetOpacity, 1);
  }
});

test('computeLoopFrame: clamps t outside [0,1]', () => {
  assertClose(computeLoopFrame(-0.5, 0.1).scrollFraction, 0);
  assertClose(computeLoopFrame(1.5, 0.1).scrollFraction, 1);
});

test('LAYER_SCROLL_CONFIG: has an entry for all 3 layers with positive duration and multiplier > 1', () => {
  for (const layer of ['sky', 'midground', 'foreground'] as const) {
    const config = LAYER_SCROLL_CONFIG[layer];
    assert.ok(config.loopDurationMs > 0, `${layer} loopDurationMs`);
    assert.ok(config.widthMultiplier > 1, `${layer} widthMultiplier must exceed 1 so there's room to scroll`);
  }
});

test('LAYER_SCROLL_CONFIG: foreground loops fastest, sky loops slowest', () => {
  assert.ok(LAYER_SCROLL_CONFIG.foreground.loopDurationMs < LAYER_SCROLL_CONFIG.midground.loopDurationMs);
  assert.ok(LAYER_SCROLL_CONFIG.midground.loopDurationMs < LAYER_SCROLL_CONFIG.sky.loopDurationMs);
});

test('RESET_CROSSFADE_MS is a small positive duration', () => {
  assert.equal(RESET_CROSSFADE_MS, 1500);
});
