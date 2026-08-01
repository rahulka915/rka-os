// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EXERCISES } from './starterExercises.ts';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from './exerciseLibrary.ts';

test('starter exercises are non-empty with unique titles and image keys', () => {
  assert.ok(STARTER_EXERCISES.length >= 100);
  const titles = STARTER_EXERCISES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  const imageKeys = STARTER_EXERCISES.map((e) => e.imageKey);
  assert.equal(new Set(imageKeys).size, imageKeys.length);
});

test('every starter exercise has a valid muscle group, equipment, and non-empty image key', () => {
  for (const exercise of STARTER_EXERCISES) {
    assert.ok(MUSCLE_GROUPS.includes(exercise.muscleGroup), `${exercise.title} has invalid muscle group`);
    if (exercise.equipment) {
      assert.ok(EQUIPMENT_OPTIONS.includes(exercise.equipment), `${exercise.title} has invalid equipment`);
    }
    assert.ok(typeof exercise.imageKey === 'string' && exercise.imageKey.length > 0, `${exercise.title} missing imageKey`);
  }
});
