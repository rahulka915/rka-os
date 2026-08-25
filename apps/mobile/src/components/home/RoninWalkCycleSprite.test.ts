// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./roninSpriteRegistry.ts', import.meta.url), 'utf8');

test('registers all eight journey-v2 calm-idle frames for the preview', () => {
  for (let frame = 1; frame <= 8; frame += 1) {
    const suffix = String(frame).padStart(2, '0');
    assert.match(source, new RegExp(`journey-v2/idle-calm/ronin-idle-calm-${suffix}\\.png`));
  }
  assert.match(source, /calm: \{ frames: IDLE_CALM_FRAMES, frameDurationMs: 420, loops: true, reduceMotionClip: 'calm' \}/);
});
