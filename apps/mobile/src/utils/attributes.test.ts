// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isAttributeWeight,
  parseAttributeContributions,
} from './attributes.ts';

test('isAttributeWeight accepts only the three valid weights', () => {
  assert.equal(isAttributeWeight('minor'), true);
  assert.equal(isAttributeWeight('moderate'), true);
  assert.equal(isAttributeWeight('major'), true);
  assert.equal(isAttributeWeight('extreme'), false);
  assert.equal(isAttributeWeight(undefined), false);
  assert.equal(isAttributeWeight(5), false);
});

test('parseAttributeContributions: reads a valid list', () => {
  const result = parseAttributeContributions([
    { attributeId: 'strength-id', weight: 'major' },
    { attributeId: 'stamina-id', weight: 'minor' },
  ]);
  assert.deepEqual(result, [
    { attributeId: 'strength-id', weight: 'major' },
    { attributeId: 'stamina-id', weight: 'minor' },
  ]);
});

test('parseAttributeContributions: drops malformed entries, keeps valid ones', () => {
  const result = parseAttributeContributions([
    { attributeId: 'strength-id', weight: 'major' },
    { attributeId: '', weight: 'minor' },
    { attributeId: 'x', weight: 'extreme' },
    { weight: 'minor' },
    null,
    'not-an-object',
  ]);
  assert.deepEqual(result, [{ attributeId: 'strength-id', weight: 'major' }]);
});

test('parseAttributeContributions: non-array input is empty', () => {
  assert.deepEqual(parseAttributeContributions(undefined), []);
  assert.deepEqual(parseAttributeContributions(null), []);
  assert.deepEqual(parseAttributeContributions('nope'), []);
});

test('parseAttributeContributions: duplicate attributeId collapses to the last entry', () => {
  const result = parseAttributeContributions([
    { attributeId: 'strength-id', weight: 'minor' },
    { attributeId: 'strength-id', weight: 'major' },
  ]);
  assert.deepEqual(result, [{ attributeId: 'strength-id', weight: 'major' }]);
});
