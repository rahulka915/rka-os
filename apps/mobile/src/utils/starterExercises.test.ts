// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EXERCISES } from './starterExercises.ts';
import { MUSCLE_GROUPS } from './exerciseLibrary.ts';

test('starter exercises are non-empty, unique, and cover every muscle group with valid groups', () => {
  assert.ok(STARTER_EXERCISES.length >= 15);
  const titles = STARTER_EXERCISES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const exercise of STARTER_EXERCISES) {
    assert.ok(MUSCLE_GROUPS.includes(exercise.muscleGroup), `${exercise.title} has invalid muscle group`);
  }
  const coveredGroups = new Set(STARTER_EXERCISES.map((e) => e.muscleGroup));
  for (const group of MUSCLE_GROUPS) {
    assert.ok(coveredGroups.has(group), `no starter exercise for muscle group ${group}`);
  }
});
