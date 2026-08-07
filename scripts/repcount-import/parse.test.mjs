import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, groupRowsIntoSessions, buildImportRecords } from './parse.mjs';

const SAMPLE_CSV = [
  'Workout Start,Workout End,Exercise,Weight,Reps,Notes,Kcal,Distance,Duration,Category,Name,Bodyweight',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",10,12,"easy",,,,Chest,"Energym Push",',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",14,12,"easy but not SUPER easy",,,,Chest,"Energym Push",',
  '2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",,,"",,,,Chest,"Energym Push",',
  '2025-10-15 06:12,2025-10-15 06:45,"Albany Tricep Pushdown",17.5,12,"",,,,Triceps,"Make Shift Full Body",',
].join('\n');

test('parseCsv splits quoted fields with embedded commas correctly', () => {
  const rows = parseCsv('a,"b, c",d\n1,2,3');
  assert.deepEqual(rows, [
    ['a', 'b, c', 'd'],
    ['1', '2', '3'],
  ]);
});

test('groupRowsIntoSessions groups by (Workout Start, Workout End, Name) and drops blank Weight+Reps rows', () => {
  const rows = parseCsv(SAMPLE_CSV);
  const sessions = groupRowsIntoSessions(rows);
  assert.equal(sessions.length, 2);
  assert.equal(sessions[0].name, 'Energym Push');
  assert.equal(sessions[0].rows.length, 2); // third row (blank Weight+Reps) dropped
  assert.equal(sessions[1].name, 'Make Shift Full Body');
  assert.equal(sessions[1].rows.length, 1);
});

test('buildImportRecords assigns per-exercise set numbers, maps muscle group, and computes sourceStartAtMs/scheduledDate', () => {
  const rows = parseCsv(SAMPLE_CSV);
  const sessions = groupRowsIntoSessions(rows);
  const records = buildImportRecords(sessions, 'kg');

  assert.equal(records.length, 2);
  const [pushSession, fullBodySession] = records;

  assert.equal(pushSession.title, 'Energym Push');
  assert.equal(pushSession.scheduledDate, '2025-10-17');
  assert.equal(pushSession.sourceStartAtMs, new Date('2025-10-17T03:34:00').getTime());
  assert.equal(pushSession.sets.length, 2);
  assert.equal(pushSession.sets[0].setNumber, 1);
  assert.equal(pushSession.sets[0].weight, 10);
  assert.equal(pushSession.sets[0].reps, 12);
  assert.equal(pushSession.sets[0].muscleGroup, 'chest');
  assert.equal(pushSession.sets[0].weightUnit, 'kg');
  assert.equal(pushSession.sets[1].setNumber, 2);

  assert.equal(fullBodySession.sets[0].muscleGroup, 'arms'); // Triceps -> arms
  assert.equal(fullBodySession.sets[0].weight, 17.5);
});

test('buildImportRecords assigns setNumber per exercise, not per session, when a session has multiple exercises', () => {
  const csv = [
    'Workout Start,Workout End,Exercise,Weight,Reps,Notes,Kcal,Distance,Duration,Category,Name,Bodyweight',
    '2025-11-01 08:00,2025-11-01 08:30,"Squat",100,5,"",,,,Legs,"Leg Day",',
    '2025-11-01 08:00,2025-11-01 08:30,"Lunge",20,10,"",,,,Legs,"Leg Day",',
    '2025-11-01 08:00,2025-11-01 08:30,"Squat",105,5,"",,,,Legs,"Leg Day",',
  ].join('\n');
  const records = buildImportRecords(groupRowsIntoSessions(parseCsv(csv)), 'lb');
  const squats = records[0].sets.filter((s) => s.exerciseTitle === 'Squat');
  assert.deepEqual(squats.map((s) => s.setNumber), [1, 2]);
  const lunges = records[0].sets.filter((s) => s.exerciseTitle === 'Lunge');
  assert.deepEqual(lunges.map((s) => s.setNumber), [1]);
  assert.equal(records[0].sets[0].weightUnit, 'lb');
});
