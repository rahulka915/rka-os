// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readChecklist,
  checklistProgress,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
} from './checklist.ts';

test('reads an empty or malformed checklist safely', () => {
  assert.deepEqual(readChecklist({}), []);
  assert.deepEqual(readChecklist({ checklist: 'nope' }), []);
  assert.deepEqual(readChecklist({ checklist: [{ text: 'no id' }] }), []);
});

test('reads well-formed entries', () => {
  const meta = { checklist: [{ id: 'a', text: 'Buy milk', done: false }] };
  assert.deepEqual(readChecklist(meta), [{ id: 'a', text: 'Buy milk', done: false }]);
});

test('adds, toggles and removes without mutating the input', () => {
  const start = [];
  const added = addChecklistItem(start, 'Pack bag', 'id-1');
  assert.deepEqual(start, []);
  assert.deepEqual(added, [{ id: 'id-1', text: 'Pack bag', done: false }]);

  const toggled = toggleChecklistItem(added, 'id-1');
  assert.equal(toggled[0].done, true);
  assert.equal(added[0].done, false);

  assert.deepEqual(removeChecklistItem(toggled, 'id-1'), []);
});

test('ignores blank additions', () => {
  assert.deepEqual(addChecklistItem([], '   ', 'id-1'), []);
});

test('reports progress', () => {
  const items = [
    { id: 'a', text: 'one', done: true },
    { id: 'b', text: 'two', done: false },
  ];
  assert.deepEqual(checklistProgress(items), { done: 1, total: 2 });
  assert.deepEqual(checklistProgress([]), { done: 0, total: 0 });
});
