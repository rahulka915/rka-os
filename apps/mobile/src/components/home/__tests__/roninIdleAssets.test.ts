// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { PNG } from 'pngjs';

const assetDirectory = fileURLToPath(new URL('../../../../assets/ronin/idle-v2/', import.meta.url));

const clipFrames = {
  calm: 8,
  'look-around': 8,
  'blink-dip': 6,
  yawn: 10,
  'adjust-wrap': 10,
  'shoulder-stretch': 10,
};

const expectedFrames = Object.entries(clipFrames).flatMap(([clip, count]) =>
  Array.from({ length: count }, (_, index) => `${clip}-${String(index + 1).padStart(2, '0')}.png`),
);

test('contains exactly the approved 52 Ronin idle-v2 frames at the fixed 640px canvas size', () => {
  assert.ok(existsSync(assetDirectory), `Missing Ronin idle asset directory: ${assetDirectory}`);

  const runtimeFrames = readdirSync(assetDirectory)
    .filter((filename) => filename.endsWith('.png'))
    .sort();

  assert.deepEqual(runtimeFrames, [...expectedFrames].sort());

  for (const filename of expectedFrames) {
    const framePath = `${assetDirectory}/${filename}`;
    assert.ok(existsSync(framePath), `Missing Ronin idle frame: ${filename}`);
    const frame = PNG.sync.read(readFileSync(framePath));
    assert.equal(frame.width, 640, `${filename} width`);
    assert.equal(frame.height, 640, `${filename} height`);
  }
});
