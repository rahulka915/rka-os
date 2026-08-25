// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../roninSpriteRegistry.ts', import.meta.url), 'utf8');

const approvedClips = {
  calm: { frames: 8, frameDurationMs: 420, loops: true, reduceMotionClip: 'calm' },
  lookAround: { frames: 8, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  blinkDip: { frames: 6, frameDurationMs: 160, loops: false, reduceMotionClip: 'blinkDip' },
  yawn: { frames: 10, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
  adjustWrap: { frames: 10, frameDurationMs: 150, loops: false, reduceMotionClip: 'calm' },
  shoulderStretch: { frames: 10, frameDurationMs: 180, loops: false, reduceMotionClip: 'calm' },
};

test('declares the approved idle clip metadata in the typed sprite registry', () => {
  assert.match(source, /export type RoninSpriteClipName/);
  assert.match(source, /export interface RoninSpriteClip/);
  assert.match(source, /export const RONIN_SPRITE_CLIPS/);

  for (const [name, contract] of Object.entries(approvedClips)) {
    const clip = source.match(new RegExp(`${name}:\\s*\\{([^}]*)\\}`));
    assert.ok(clip, `missing ${name} clip`);
    assert.match(clip[1], new RegExp(`frames:\\s*(?:[A-Z_]+|\\[\\])`));
    assert.match(clip[1], new RegExp(`frameDurationMs:\\s*${contract.frameDurationMs}`));
    assert.match(clip[1], new RegExp(`loops:\\s*${contract.loops}`));
    assert.match(clip[1], new RegExp(`reduceMotionClip:\\s*'${contract.reduceMotionClip}'`));
  }
});
