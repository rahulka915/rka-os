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
    assert.match(clip[1], new RegExp(`frames:\\s*[A-Z_]+`));
    assert.match(clip[1], new RegExp(`frameDurationMs:\\s*${contract.frameDurationMs}`));
    assert.match(clip[1], new RegExp(`loops:\\s*${contract.loops}`));
    assert.match(clip[1], new RegExp(`reduceMotionClip:\\s*'${contract.reduceMotionClip}'`));
  }
});

test('loads every expanded idle clip from the idle-v2 runtime library', () => {
  const arrays = {
    IDLE_CALM_FRAMES: ['calm', 8],
    LOOK_AROUND_FRAMES: ['look-around', 8],
    BLINK_DIP_FRAMES: ['blink-dip', 6],
    YAWN_FRAMES: ['yawn', 10],
    ADJUST_WRAP_FRAMES: ['adjust-wrap', 10],
    SHOULDER_STRETCH_FRAMES: ['shoulder-stretch', 10],
  };

  for (const [arrayName, [prefix, count]] of Object.entries(arrays)) {
    const declaration = source.match(new RegExp(`const ${arrayName}:[^=]*=\\s*\\[([\\s\\S]*?)\\];`));
    assert.ok(declaration, `missing ${arrayName}`);
    const paths = [...declaration[1].matchAll(/require\('([^']+)'\)/g)].map((match) => match[1]);
    assert.equal(paths.length, count, `${arrayName} frame count`);
    assert.deepEqual(
      paths,
      Array.from({ length: count }, (_, index) => (
        `../../../assets/ronin/idle-v2/${prefix}-${String(index + 1).padStart(2, '0')}.png`
      )),
    );
  }
});
