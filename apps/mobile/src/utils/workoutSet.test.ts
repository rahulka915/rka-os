// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseSetLogDetails, formatSetSummary, getMostRecentSessionSets } from './workoutSet.ts';

test('parseSetLogDetails returns null for missing/malformed/incomplete details', () => {
  assert.equal(parseSetLogDetails(undefined), null);
  assert.equal(parseSetLogDetails(null), null);
  assert.equal(parseSetLogDetails('not json'), null);
  assert.equal(parseSetLogDetails(JSON.stringify({ sessionId: 's1', setNumber: 1 })), null);
});

test('parseSetLogDetails reads valid fields and defaults weightUnit to kg', () => {
  assert.deepEqual(
    parseSetLogDetails(JSON.stringify({ sessionId: 's1', setNumber: 2, reps: 8, weight: 60 })),
    { sessionId: 's1', setNumber: 2, reps: 8, weight: 60, weightUnit: 'kg' },
  );
  assert.deepEqual(
    parseSetLogDetails(JSON.stringify({ sessionId: 's1', setNumber: 1, reps: 5, weight: 100, weightUnit: 'lbs' })),
    { sessionId: 's1', setNumber: 1, reps: 5, weight: 100, weightUnit: 'lbs' },
  );
});

test('formatSetSummary combines reps and weight', () => {
  assert.equal(
    formatSetSummary({ sessionId: 's1', setNumber: 1, reps: 8, weight: 60, weightUnit: 'kg' }),
    '8 × 60kg',
  );
});

test('getMostRecentSessionSets returns only the latest session, sorted by set number', () => {
  const log = (sessionId, setNumber, reps, weight, timestamp) => ({
    timestamp,
    details: JSON.stringify({ sessionId, setNumber, reps, weight, weightUnit: 'kg' }),
  });
  const logs = [
    log('old-session', 1, 8, 55, 100),
    log('old-session', 2, 8, 55, 110),
    log('new-session', 2, 6, 62.5, 300),
    log('new-session', 1, 8, 60, 290),
  ];
  assert.deepEqual(
    getMostRecentSessionSets(logs).map((s) => `${s.setNumber}:${s.reps}x${s.weight}`),
    ['1:8x60', '2:6x62.5'],
  );
});

test('getMostRecentSessionSets excludes the given session id (the in-progress one)', () => {
  const log = (sessionId, setNumber, timestamp) => ({
    timestamp,
    details: JSON.stringify({ sessionId, setNumber, reps: 8, weight: 60, weightUnit: 'kg' }),
  });
  const logs = [log('current', 1, 400), log('previous', 1, 100)];
  assert.deepEqual(
    getMostRecentSessionSets(logs, 'current').map((s) => s.sessionId),
    ['previous'],
  );
});

test('getMostRecentSessionSets returns empty array when there is no history', () => {
  assert.deepEqual(getMostRecentSessionSets([]), []);
});

test('getMostRecentSessionSets skips unparseable log rows', () => {
  const logs = [{ timestamp: 1, details: 'garbage' }];
  assert.deepEqual(getMostRecentSessionSets(logs), []);
});
