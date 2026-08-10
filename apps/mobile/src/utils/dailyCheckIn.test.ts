// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDailyPrioritySuggestions,
  getDailyCheckInDateKey,
  getDailyCheckInPromptState,
  isDailyCheckInEditable,
  parseDailyCheckInAnswers,
} from './dailyCheckIn.ts';

const task = (overrides) => ({
  id: overrides.id,
  type: 'task',
  title: overrides.title,
  status: overrides.status ?? 'active',
  scheduledDate: overrides.scheduledDate,
  dueDate: overrides.dueDate,
  metadata: overrides.metadata,
  createdAt: 0,
  updatedAt: 0,
});

test('getDailyCheckInDateKey: post-midnight evening window belongs to previous local date', () => {
  assert.equal(getDailyCheckInDateKey(new Date(2026, 7, 11, 1, 30)), '2026-08-10');
});

test('getDailyCheckInDateKey: ordinary morning belongs to current local date', () => {
  assert.equal(getDailyCheckInDateKey(new Date(2026, 7, 10, 8, 30)), '2026-08-10');
});

test('getDailyCheckInPromptState: morning prompt appears during morning window', () => {
  const state = getDailyCheckInPromptState(new Date(2026, 7, 10, 8, 0), null, null);
  assert.equal(state.kind, 'morning');
  assert.equal(state.phase, 'morning');
  assert.equal(state.dateKey, '2026-08-10');
});

test('getDailyCheckInPromptState: midday missing morning becomes catch-up', () => {
  const state = getDailyCheckInPromptState(new Date(2026, 7, 10, 13, 0), null, null);
  assert.equal(state.kind, 'catch-up');
  assert.equal(state.phase, 'morning');
});

test('getDailyCheckInPromptState: evening prompt after midnight uses previous date', () => {
  const state = getDailyCheckInPromptState(new Date(2026, 7, 11, 1, 0), { id: 'm' }, null);
  assert.equal(state.kind, 'evening');
  assert.equal(state.phase, 'evening');
  assert.equal(state.dateKey, '2026-08-10');
});

test('getDailyCheckInPromptState: both entries complete returns logged state', () => {
  const state = getDailyCheckInPromptState(new Date(2026, 7, 10, 21, 0), { id: 'm' }, { id: 'e' });
  assert.equal(state.kind, 'logged');
});

test('parseDailyCheckInAnswers: malformed metadata falls back to empty structured arrays', () => {
  assert.deepEqual(parseDailyCheckInAnswers('{nope'), { priorities: [] });
});

test('parseDailyCheckInAnswers: preserves known answer fields and priority snapshots', () => {
  const parsed = parseDailyCheckInAnswers(JSON.stringify({
    energy: 'steady',
    mood: 'calm',
    priorities: [{ kind: 'linked-task', taskId: 't1', title: 'Email accountant', reason: 'Due today' }],
  }));
  assert.equal(parsed.energy, 'steady');
  assert.equal(parsed.mood, 'calm');
  assert.deepEqual(parsed.priorities, [{ kind: 'linked-task', taskId: 't1', title: 'Email accountant', reason: 'Due today' }]);
});

test('buildDailyPrioritySuggestions: ranks overdue before due, scheduled, carried, focus, mission', () => {
  const suggestions = buildDailyPrioritySuggestions([
    task({ id: 'focus', title: 'Practice scales' }),
    task({ id: 'mission', title: 'Ship proposal' }),
    task({ id: 'carried', title: 'Book dentist' }),
    task({ id: 'scheduled', title: 'Morning admin', scheduledDate: '2026-08-10', metadata: JSON.stringify({ timeOfDay: 'morning' }) }),
    task({ id: 'due', title: 'Pay invoice', dueDate: '2026-08-10' }),
    task({ id: 'overdue', title: 'Reply to Sam', dueDate: '2026-08-09' }),
  ], {
    today: '2026-08-10',
    carriedForwardTaskIds: new Set(['carried']),
    focusTaskIds: new Set(['focus']),
    missionTaskIds: new Set(['mission']),
  });

  assert.deepEqual(suggestions.map((s) => s.taskId), ['overdue', 'due', 'scheduled', 'carried', 'focus', 'mission']);
  assert.deepEqual(suggestions.map((s) => s.reason), ['Overdue', 'Due today', 'Scheduled morning', 'Carried forward', 'Current Focus', 'Active Mission']);
});

test('isDailyCheckInEditable: today and yesterday are editable, older days are read-only', () => {
  const now = new Date(2026, 7, 10, 12, 0);
  assert.equal(isDailyCheckInEditable('2026-08-10', now), true);
  assert.equal(isDailyCheckInEditable('2026-08-09', now), true);
  assert.equal(isDailyCheckInEditable('2026-08-08', now), false);
});
