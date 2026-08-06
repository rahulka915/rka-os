// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EXERCISES } from './starterExercises.ts';
import { MUSCLE_GROUPS, EQUIPMENT_OPTIONS } from './exerciseLibrary.ts';
import * as exerciseLibrary from './exerciseLibrary.ts';

test('starter exercises are non-empty with unique titles and image keys', () => {
  assert.ok(STARTER_EXERCISES.length >= 100);
  const titles = STARTER_EXERCISES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  const imageKeys = STARTER_EXERCISES.map((e) => e.imageKey);
  assert.equal(new Set(imageKeys).size, imageKeys.length);
});

test('exercise library exposes movement-family inference', () => {
  assert.equal(typeof exerciseLibrary.inferMovementFamily, 'function');
});

test('bench press equipment and angle variants share one movement family', () => {
  for (const title of [
    'Barbell Bench Press',
    'Dumbbell Bench Press',
    'Incline Barbell Bench Press',
    'Incline Dumbbell Bench Press',
    'Smith Machine Bench Press',
  ]) {
    assert.equal(exerciseLibrary.inferMovementFamily(title), 'chest-press', title);
  }
});

test('the starter catalogue resolves to 32 named movement families with no fallback', () => {
  const families = STARTER_EXERCISES.map((exercise) => exerciseLibrary.inferMovementFamily(exercise.title));
  assert.equal(families.includes('other'), false);
  assert.equal(new Set(families).size, 32);
});

test('every starter exercise has a valid muscle group, equipment, and non-empty image key', () => {
  for (const exercise of STARTER_EXERCISES) {
    assert.ok(MUSCLE_GROUPS.includes(exercise.muscleGroup), `${exercise.title} has invalid muscle group`);
    if (exercise.equipment) {
      assert.ok(EQUIPMENT_OPTIONS.includes(exercise.equipment), `${exercise.title} has invalid equipment`);
    }
    assert.equal(exercise.movementFamily, exerciseLibrary.inferMovementFamily(exercise.title), `${exercise.title} has wrong movement family`);
    assert.ok(typeof exercise.imageKey === 'string' && exercise.imageKey.length > 0, `${exercise.title} missing imageKey`);
  }
});
