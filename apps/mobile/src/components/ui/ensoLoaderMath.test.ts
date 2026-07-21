// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ENSO_RADIUS,
  ensoCircumference,
  ensoDashOffset,
  ensoRotationDegrees,
} from './ensoLoaderMath.ts';

test('circumference matches 2*pi*radius', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.ok(Math.abs(c - 251.327) < 0.01);
});

test('dash offset starts and ends the cycle fully hidden', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.equal(ensoDashOffset(0, c), c);
  assert.ok(Math.abs(ensoDashOffset(1, c) - c) < 0.001);
});

test('dash offset is most-drawn at the midpoint of the cycle', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  const atMid = ensoDashOffset(0.5, c);
  assert.ok(Math.abs(atMid - c * 0.16) < 0.001);
});

test('dash offset is symmetric around the midpoint', () => {
  const c = ensoCircumference(ENSO_RADIUS);
  assert.ok(Math.abs(ensoDashOffset(0.25, c) - ensoDashOffset(0.75, c)) < 0.001);
});

test('rotation is linear across the full cycle', () => {
  assert.equal(ensoRotationDegrees(0), 0);
  assert.equal(ensoRotationDegrees(0.5), 180);
  assert.equal(ensoRotationDegrees(1), 360);
});
