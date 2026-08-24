// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('./RoninWalkCycleSprite.tsx', import.meta.url), 'utf8');

test('uses all eight journey-v2 calm-idle frames for the preview', () => {
  for (let frame = 1; frame <= 8; frame += 1) {
    const suffix = String(frame).padStart(2, '0');
    assert.match(source, new RegExp(`journey-v2/idle-calm/ronin-idle-calm-${suffix}\\.png`));
  }
  assert.match(source, /const IDLE_VARIANTS: number\[\]\[\] = \[IDLE_CALM_FRAMES\];/);
});
