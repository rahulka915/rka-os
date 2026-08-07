// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExerciseMeta,
  formatExerciseSubtitle,
  groupExercisesByMuscle,
  filterExercisesByQuery,
  pickGroupThumbnailImageKey,
  getMuscleGroupWeights,
  MUSCLE_GROUPS,
} from './exerciseLibrary.ts';
import * as exerciseLibrary from './exerciseLibrary.ts';

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
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', equipment: 'barbell', movementFamily: 'chest-press', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' })),
    { muscleGroup: 'chest', equipment: 'barbell', movementFamily: 'chest-press', notes: 'form cue', imageKey: 'BarbellBenchPressfinal' },
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

test('formatExerciseSubtitle appends the primary sub-region detail in parens', () => {
  assert.equal(
    formatExerciseSubtitle({ muscleGroup: 'chest', muscleGroupDetail: 'upper', equipment: 'barbell' }),
    'Chest (upper) · Barbell',
  );
});

test('parseExerciseMeta reads secondaryMuscleGroups, dropping invalid groups and a duplicate of the primary', () => {
  const meta = parseExerciseMeta(JSON.stringify({
    muscleGroup: 'chest',
    muscleGroupDetail: 'upper',
    secondaryMuscleGroups: [
      { group: 'arms', detail: 'triceps — long head' },
      { group: 'shoulders' },
      { group: 'chest' }, // duplicate of primary, must be dropped
      { group: 'not-a-group' }, // invalid, must be dropped
    ],
  }));
  assert.deepEqual(meta, {
    muscleGroup: 'chest',
    muscleGroupDetail: 'upper',
    secondaryMuscleGroups: [
      { group: 'arms', detail: 'triceps — long head' },
      { group: 'shoulders' },
    ],
  });
});

test('parseExerciseMeta omits secondaryMuscleGroups entirely when the array is empty or fully invalid', () => {
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', secondaryMuscleGroups: [] })),
    { muscleGroup: 'chest' },
  );
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', secondaryMuscleGroups: [{ group: 'chest' }] })),
    { muscleGroup: 'chest' },
  );
});

test('getMuscleGroupWeights gives the primary 100% when there are no secondaries', () => {
  assert.deepEqual(getMuscleGroupWeights({ muscleGroup: 'chest' }), [{ group: 'chest', weight: 1 }]);
});

test('getMuscleGroupWeights splits 70/30 between primary and one secondary', () => {
  const weights = getMuscleGroupWeights({ muscleGroup: 'chest', secondaryMuscleGroups: [{ group: 'arms' }] });
  assert.equal(weights.length, 2);
  assert.equal(weights[0].group, 'chest');
  assert.ok(Math.abs(weights[0].weight - 0.7) < 1e-9);
  assert.equal(weights[1].group, 'arms');
  assert.ok(Math.abs(weights[1].weight - 0.3) < 1e-9);
});

test('getMuscleGroupWeights splits the remaining 30% evenly across multiple secondaries', () => {
  const weights = getMuscleGroupWeights({ muscleGroup: 'chest', secondaryMuscleGroups: [{ group: 'arms' }, { group: 'shoulders' }] });
  assert.equal(weights.length, 3);
  assert.equal(weights[0].group, 'chest');
  assert.ok(Math.abs(weights[0].weight - 0.7) < 1e-9);
  assert.equal(weights[1].group, 'arms');
  assert.ok(Math.abs(weights[1].weight - 0.15) < 1e-9);
  assert.equal(weights[2].group, 'shoulders');
  assert.ok(Math.abs(weights[2].weight - 0.15) < 1e-9);
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

test('pickGroupThumbnailImageKey returns the first alphabetical exercise with an imageKey', () => {
  const group = {
    muscleGroup: 'chest',
    label: 'Chest',
    exercises: [
      makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
      makeExercise('2', 'Cable Fly', { muscleGroup: 'chest', imageKey: 'CableFly' }),
      makeExercise('3', 'Push-Up', { muscleGroup: 'chest', imageKey: 'PushUp' }),
    ],
  };
  assert.equal(pickGroupThumbnailImageKey(group), 'CableFly');
});

test('pickGroupThumbnailImageKey returns undefined when no exercise in the group has an imageKey', () => {
  const group = {
    muscleGroup: 'legs',
    label: 'Legs',
    exercises: [makeExercise('1', 'Squat', { muscleGroup: 'legs' })],
  };
  assert.equal(pickGroupThumbnailImageKey(group), undefined);
});

test('exercise library exposes family grouping', () => {
  assert.equal(typeof exerciseLibrary.groupExercisesByMovementFamily, 'function');
});

test('family grouping uses stored metadata then falls back to title inference', () => {
  const exercises = [
    makeExercise('1', 'Custom Horizontal Press', { muscleGroup: 'chest', movementFamily: 'chest-press' }),
    makeExercise('2', 'Incline Dumbbell Bench Press', { muscleGroup: 'chest' }),
    makeExercise('3', 'Wide Push Ups', { muscleGroup: 'chest' }),
  ];
  const groups = exerciseLibrary.groupExercisesByMovementFamily(exercises);
  assert.deepEqual(groups.map((group) => [group.movementFamily, group.label, group.exercises.map((item) => item.id)]), [
    ['chest-press', 'Chest Press', ['1', '2']],
    ['push-up', 'Push-Up', ['3']],
  ]);
});

test('family-aware search finds variations by the parent movement name', () => {
  const exercises = [makeExercise('1', 'Incline Dumbbell Bench Press', { muscleGroup: 'chest' })];
  assert.deepEqual(filterExercisesByQuery(exercises, 'chest press').map((item) => item.id), ['1']);
});
