// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  ITEM_LIFECYCLE,
  isStructuralType,
  isTransactionalType,
  STRUCTURAL_ITEM_TYPES,
  TRANSACTIONAL_ITEM_TYPES,
} from './itemLifecycle.ts';

const ALL_ITEM_TYPES = [
  'area', 'project', 'task', 'habit', 'medication', 'supplement', 'workout-template', 'workout-block',
  'exercise', 'workout-session', 'meal', 'object', 'potential-stat', 'achievement', 'focus',
  'routine', 'routine-step', 'routine-session', 'skill', 'backward-plan', 'potential-attribute', 'event',
];

test('every ItemType has exactly one lifecycle classification', () => {
  for (const type of ALL_ITEM_TYPES) {
    assert.ok(type in ITEM_LIFECYCLE, `${type} is missing from ITEM_LIFECYCLE`);
  }
  assert.equal(Object.keys(ITEM_LIFECYCLE).length, ALL_ITEM_TYPES.length);
});

test('STRUCTURAL_ITEM_TYPES and TRANSACTIONAL_ITEM_TYPES partition all types with no overlap', () => {
  const combined = [...STRUCTURAL_ITEM_TYPES, ...TRANSACTIONAL_ITEM_TYPES].sort();
  assert.deepEqual(combined, [...ALL_ITEM_TYPES].sort());
  const overlap = STRUCTURAL_ITEM_TYPES.filter((t) => TRANSACTIONAL_ITEM_TYPES.includes(t));
  assert.deepEqual(overlap, []);
});

test('isStructuralType/isTransactionalType are consistent and mutually exclusive', () => {
  for (const type of ALL_ITEM_TYPES) {
    assert.notEqual(isStructuralType(type), isTransactionalType(type));
  }
});

test('spot checks: durable reference nouns are structural, to-dos/instances are transactional', () => {
  assert.equal(isStructuralType('area'), true);
  assert.equal(isStructuralType('skill'), true);
  assert.equal(isStructuralType('potential-stat'), true);
  assert.equal(isStructuralType('habit'), true);
  assert.equal(isTransactionalType('task'), true);
  assert.equal(isTransactionalType('object'), true);
  assert.equal(isTransactionalType('workout-session'), true);
  assert.equal(isTransactionalType('routine-session'), true);
});
