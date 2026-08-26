// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { nextIdleDelayMs, selectIdleClip } from '../roninIdleScheduler.ts';

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

test('omits rare shoulder stretches when Reduce Motion is enabled', () => {
  assert.notEqual(
    selectIdleClip({ random: () => 0.99, previous: null, reduceMotion: true }),
    'shoulderStretch',
  );
});

test('uses only the eyelid blink when Reduce Motion is enabled', () => {
  for (let value = 0; value <= 10; value += 1) {
    assert.equal(
      selectIdleClip({ random: () => value / 10, previous: null, reduceMotion: true }),
      'blinkDip',
    );
  }
});

test('allows another restrained blink after the calm interval under Reduce Motion', () => {
  assert.equal(
    selectIdleClip({ random: () => 0.5, previous: 'blinkDip', reduceMotion: true }),
    'blinkDip',
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
