// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { finishRoninPlayback, resolveRoninSpriteState } from '../roninIdlePlayback.ts';

const journeySource = readFileSync(new URL('../RoninJourneyPrototype.tsx', import.meta.url), 'utf8');

test('applies the outer bob and rotation only while walking', () => {
  assert.match(journeySource, /const addsWalkingMotion = isWalking && !isOneShotPlaying && !reduceMotion/);
  assert.match(journeySource, /const bob = addsWalkingMotion \?/);
  assert.doesNotMatch(journeySource, /idle\/walking breathing bob\+rotate runs continuously/);
});

test('explicit actions override walking and personality idles', () => {
  assert.equal(resolveRoninSpriteState({ activeAction: 'bow', isWalking: true, activeIdle: 'yawn' }), 'bow');
});

test('walking overrides and therefore interrupts a personality idle', () => {
  assert.equal(resolveRoninSpriteState({ activeAction: null, isWalking: true, activeIdle: 'adjustWrap' }), 'walking');
});

test('a personality idle plays only while otherwise calm', () => {
  assert.equal(resolveRoninSpriteState({ activeAction: null, isWalking: false, activeIdle: 'lookAround' }), 'lookAround');
  assert.equal(resolveRoninSpriteState({ activeAction: null, isWalking: false, activeIdle: null }), 'idle');
});

test('completion clears the active one-shot and preserves the other channel', () => {
  assert.deepEqual(
    finishRoninPlayback({ activeAction: 'jump', activeIdle: null }),
    { activeAction: null, activeIdle: null },
  );
  assert.deepEqual(
    finishRoninPlayback({ activeAction: null, activeIdle: 'blinkDip' }),
    { activeAction: null, activeIdle: null },
  );
});
