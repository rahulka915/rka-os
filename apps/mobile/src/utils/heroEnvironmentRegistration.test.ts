// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';

const registration = JSON.parse(readFileSync(
  new URL('../components/hero/environment/heroEnvironmentRegistration.json', import.meta.url),
  'utf8'
));

test('all 29 production layers are registered in the master scene', () => {
  assert.equal(Object.keys(registration.layers).length, 29);
  assert.equal(registration.scene.width, 1536);
  assert.equal(registration.scene.height, 864);
});

test('the canonical viewport preserves the locked crop at any width', () => {
  const { crop } = registration.viewport;
  assert.deepEqual(crop, { x: 0, y: 96, width: 1536, height: 704 });
  assert.equal(registration.viewport.sceneScale, 390 / 1536);
  assert.equal(registration.viewport.sceneOffsetX, 0);
  assert.equal(registration.viewport.sceneOffsetY, -crop.y * registration.viewport.sceneScale);
});

test('every layer has an explicit transform outside React components', () => {
  for (const [id, layer] of Object.entries(registration.layers)) {
    assert.equal(typeof layer.x, 'number', `${id} x`);
    assert.equal(typeof layer.y, 'number', `${id} y`);
    assert.ok(layer.scale > 0, `${id} scale`);
    assert.ok(layer.opacity >= 0 && layer.opacity <= 1, `${id} opacity`);
  }
});
