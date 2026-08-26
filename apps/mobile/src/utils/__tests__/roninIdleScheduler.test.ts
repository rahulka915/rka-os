// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  nextIdleDelayMs,
  selectIdleClip,
  type RoninIdleClip,
} from '../roninIdleScheduler.ts';

test('maps the random delay bounds to the inclusive calm interval', () => {
  assert.equal(nextIdleDelayMs(() => 0), 8_000);
  assert.equal(nextIdleDelayMs(() => 1), 18_000);
});

test('never repeats the previous personality clip', () => {
  assert.notEqual(
    selectIdleClip({ random: () => 0, previous: 'lookAround', reduceMotion: false }),
    'lookAround',
  );
});

test('keeps the complete personality library under Reduce Motion', () => {
  const selected = new Set<RoninIdleClip>();

  for (let value = 0; value < 100; value += 1) {
    selected.add(selectIdleClip({ random: () => value / 100, previous: null, reduceMotion: true }));
  }

  assert.deepEqual(selected, new Set([
    'lookAround',
    'blinkDip',
    'adjustWrap',
    'yawn',
    'shoulderStretch',
  ]));
});

test('still avoids immediate repeats under Reduce Motion', () => {
  assert.notEqual(
    selectIdleClip({ random: () => 0, previous: 'lookAround', reduceMotion: true }),
    'lookAround',
  );
});

test('gives normal clips more selection weight than rare clips', () => {
  const counts = new Map([
    ['lookAround', 0],
    ['blinkDip', 0],
    ['adjustWrap', 0],
    ['yawn', 0],
    ['shoulderStretch', 0],
  ]);

  for (let value = 0; value < 100; value += 1) {
    const clip = selectIdleClip({ random: () => value / 100, previous: null, reduceMotion: false });
    counts.set(clip, counts.get(clip) + 1);
  }

  for (const normalClip of ['lookAround', 'blinkDip', 'adjustWrap']) {
    for (const rareClip of ['yawn', 'shoulderStretch']) {
      assert.ok(counts.get(normalClip) > counts.get(rareClip));
    }
  }
});
