// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  clampKatanaProgress,
  resolveKatanaHeight,
  resolveKatanaWidth,
} from './katanaProgressMath.ts';

test('clamps progress to the supported zero-to-one range', () => {
  assert.equal(clampKatanaProgress(-0.25), 0);
  assert.equal(clampKatanaProgress(0.42), 0.42);
  assert.equal(clampKatanaProgress(1.5), 1);
});

test('fails closed for non-finite progress', () => {
  assert.equal(clampKatanaProgress(Number.NaN), 0);
  assert.equal(clampKatanaProgress(Number.POSITIVE_INFINITY), 0);
});

test('keeps numeric and string size tokens geometrically identical', () => {
  assert.equal(resolveKatanaHeight(32), 32);
  assert.equal(resolveKatanaHeight('32'), 32);
  assert.equal(resolveKatanaWidth(32), 160);
  assert.equal(resolveKatanaWidth('32'), 160);
});

test('uses the full parent width for the hero treatment', () => {
  assert.equal(resolveKatanaHeight('hero'), 48);
  assert.equal(resolveKatanaWidth('hero'), '100%');
});
