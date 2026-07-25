// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  triageReducer,
  createInitialTriageState,
  buildTriageQueue,
} from './triageReducer.ts';

function makeItem(id) {
  return {
    id,
    type: 'task',
    title: `Item ${id}`,
    status: 'inbox',
    createdAt: 0,
    updatedAt: 0,
  };
}

// ── buildTriageQueue ─────────────────────────────────────────────────────

test('buildTriageQueue puts the tapped item first, then the rest in order', () => {
  const a = makeItem('a');
  const b = makeItem('b');
  const c = makeItem('c');
  const queue = buildTriageQueue(b, [a, b, c]);
  assert.deepEqual(queue.map((i) => i.id), ['b', 'a', 'c']);
});

test('buildTriageQueue with a single item returns just that item', () => {
  const a = makeItem('a');
  const queue = buildTriageQueue(a, [a]);
  assert.deepEqual(queue.map((i) => i.id), ['a']);
});

// ── createInitialTriageState ─────────────────────────────────────────────

test('createInitialTriageState starts on the type step with empty answers', () => {
  const queue = [makeItem('a'), makeItem('b')];
  const state = createInitialTriageState(queue);
  assert.equal(state.step, 'type');
  assert.equal(state.queue.length, 2);
  assert.equal(state.answers.priority, null);
  assert.equal(state.answers.when, null);
  assert.equal(state.answers.projectId, null);
  assert.equal(state.processedCount, 0);
});

// ── CHOOSE_TASK ───────────────────────────────────────────────────────────

test('CHOOSE_TASK from type step moves to importance', () => {
  const state = createInitialTriageState([makeItem('a')]);
  const next = triageReducer(state, { type: 'CHOOSE_TASK' });
  assert.equal(next.step, 'importance');
});

test('CHOOSE_TASK is a no-op outside the type step', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'when' };
  const next = triageReducer(state, { type: 'CHOOSE_TASK' });
  assert.equal(next.step, 'when');
});

// ── ANSWER_IMPORTANCE ─────────────────────────────────────────────────────

test('ANSWER_IMPORTANCE from importance step records the value and moves to when', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'importance' };
  const next = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'high' });
  assert.equal(next.step, 'when');
  assert.equal(next.answers.priority, 'high');
});

test('ANSWER_IMPORTANCE is a no-op outside the importance step', () => {
  const state = createInitialTriageState([makeItem('a')]); // step: 'type'
  const next = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'high' });
  assert.equal(next.step, 'type');
  assert.equal(next.answers.priority, null);
});

// ── ANSWER_WHEN ───────────────────────────────────────────────────────────

test('ANSWER_WHEN from when step records the value and moves to project', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'when' };
  const next = triageReducer(state, { type: 'ANSWER_WHEN', value: 'tomorrow' });
  assert.equal(next.step, 'project');
  assert.equal(next.answers.when, 'tomorrow');
});

// ── ANSWER_PROJECT ────────────────────────────────────────────────────────

test('ANSWER_PROJECT from project step records the value and moves to review', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'project' };
  const next = triageReducer(state, { type: 'ANSWER_PROJECT', value: 'proj-1' });
  assert.equal(next.step, 'review');
  assert.equal(next.answers.projectId, 'proj-1');
});

test('ANSWER_PROJECT accepts null (no project chosen)', () => {
  const state = { ...createInitialTriageState([makeItem('a')]), step: 'project' };
  const next = triageReducer(state, { type: 'ANSWER_PROJECT', value: null });
  assert.equal(next.step, 'review');
  assert.equal(next.answers.projectId, null);
});

// ── BACK ──────────────────────────────────────────────────────────────────

test('BACK steps back through the sequence: review -> project -> when -> importance -> type', () => {
  let state = { ...createInitialTriageState([makeItem('a')]), step: 'review' };
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'project');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'when');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'importance');
  state = triageReducer(state, { type: 'BACK' });
  assert.equal(state.step, 'type');
});

test('BACK on the type step is a no-op (nothing before it)', () => {
  const state = createInitialTriageState([makeItem('a')]); // step: 'type'
  const next = triageReducer(state, { type: 'BACK' });
  assert.equal(next.step, 'type');
});

// ── ADVANCE ───────────────────────────────────────────────────────────────

test('ADVANCE pops the current item, resets step and answers, bumps processedCount', () => {
  const a = makeItem('a');
  const b = makeItem('b');
  let state = createInitialTriageState([a, b]);
  state = triageReducer(state, { type: 'CHOOSE_TASK' });
  state = triageReducer(state, { type: 'ANSWER_IMPORTANCE', value: 'low' });
  const next = triageReducer(state, { type: 'ADVANCE' });
  assert.deepEqual(next.queue.map((i) => i.id), ['b']);
  assert.equal(next.step, 'type');
  assert.equal(next.answers.priority, null);
  assert.equal(next.processedCount, 1);
});

test('ADVANCE on the last item leaves an empty queue', () => {
  const a = makeItem('a');
  let state = createInitialTriageState([a]);
  const next = triageReducer(state, { type: 'ADVANCE' });
  assert.equal(next.queue.length, 0);
  assert.equal(next.processedCount, 1);
});
