// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExerciseMeta,
  formatExerciseSubtitle,
  groupExercisesByMuscle,
  filterExercisesByQuery,
  MUSCLE_GROUPS,
} from './exerciseLibrary.ts';

function makeExercise(id, title, meta) {
  return {
    id,
    type: 'exercise',
    title,
    status: 'active',
    metadata: JSON.stringify(meta),
    createdAt: 0,
    updatedAt: 0,
  };
}

test('parseExerciseMeta falls back to full-body on missing/malformed metadata', () => {
  assert.deepEqual(parseExerciseMeta(undefined), { muscleGroup: 'full-body' });
  assert.deepEqual(parseExerciseMeta('not json'), { muscleGroup: 'full-body' });
  assert.deepEqual(parseExerciseMeta('{}'), { muscleGroup: 'full-body' });
});

test('parseExerciseMeta reads valid fields and drops invalid ones', () => {
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' })),
    { muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' },
  );
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'not-a-group', equipment: 'not-equipment', imageKey: 123 })),
    { muscleGroup: 'full-body' },
  );
});

test('formatExerciseSubtitle joins muscle group and equipment', () => {
  assert.equal(formatExerciseSubtitle({ muscleGroup: 'chest', equipment: 'barbell' }), 'Chest · Barbell');
  assert.equal(formatExerciseSubtitle({ muscleGroup: 'core' }), 'Core');
});

test('groupExercisesByMuscle buckets, sorts alphabetically, and drops empty groups', () => {
  const exercises = [
    makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
    makeExercise('2', 'Push-Up', { muscleGroup: 'chest' }),
    makeExercise('3', 'Squat', { muscleGroup: 'legs' }),
  ];
  const groups = groupExercisesByMuscle(exercises);
  assert.deepEqual(groups.map((g) => g.muscleGroup), ['chest', 'legs']);
  assert.deepEqual(groups[0].exercises.map((e) => e.title), ['Bench Press', 'Push-Up']);
  assert.equal(groups.every((g) => MUSCLE_GROUPS.includes(g.muscleGroup)), true);
});

test('filterExercisesByQuery is case-insensitive and substring-based', () => {
  const exercises = [
    makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
    makeExercise('2', 'Squat', { muscleGroup: 'legs' }),
  ];
  assert.deepEqual(filterExercisesByQuery(exercises, 'bench').map((e) => e.id), ['1']);
  assert.deepEqual(filterExercisesByQuery(exercises, '').map((e) => e.id), ['1', '2']);
  assert.deepEqual(filterExercisesByQuery(exercises, 'zzz'), []);
});
