// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { previewAssistantTool } from './assistantTools.ts';

test('previews create_item with a scheduled date', () => {
  const preview = previewAssistantTool('create_item', {
    type: 'task',
    title: 'Buy milk',
    scheduledDate: '2026-08-16',
  });
  assert.equal(preview, 'Create task "Buy milk", scheduled 2026-08-16');
});

test('previews create_item with no scheduled date', () => {
  const preview = previewAssistantTool('create_item', { type: 'task', title: 'Buy milk' });
  assert.equal(preview, 'Create task "Buy milk"');
});

test('previews update_item with multiple fields', () => {
  const preview = previewAssistantTool('update_item', {
    id: 'abc123',
    title: 'Buy oat milk',
    dueDate: '2026-08-20',
  });
  assert.equal(preview, 'Update item: title → "Buy oat milk", due date → 2026-08-20');
});

test('previews set_item_status as completion', () => {
  const preview = previewAssistantTool('set_item_status', { id: 'abc123', status: 'completed' });
  assert.equal(preview, 'Mark item as completed');
});

test('previews delete_item as a reversible soft delete', () => {
  const preview = previewAssistantTool('delete_item', { id: 'abc123', title: 'Old draft' });
  assert.equal(preview, 'Delete "Old draft" (reversible — moves to trash, not permanently erased)');
});

test('previews log_habit_sample', () => {
  const preview = previewAssistantTool('log_habit_sample', {
    habitId: 'h1',
    habitTitle: 'Drink water',
    value: 2,
  });
  assert.equal(preview, 'Log 2 for "Drink water"');
});

test('previews toggle_habit_occurrence', () => {
  const preview = previewAssistantTool('toggle_habit_occurrence', {
    itemId: 'h1',
    habitTitle: 'Meditate',
    date: '2026-08-15',
  });
  assert.equal(preview, 'Mark "Meditate" done for 2026-08-15');
});

test('previews log_medication_taken', () => {
  const preview = previewAssistantTool('log_medication_taken', {
    itemId: 'm1',
    medicationTitle: 'Vitamin D',
  });
  assert.equal(preview, 'Log a dose of "Vitamin D" taken now');
});

test('previews log_action with duration', () => {
  const preview = previewAssistantTool('log_action', {
    title: 'Run',
    kind: 'practice',
    durationMinutes: 20,
  });
  assert.equal(preview, 'Log action "Run" (practice, 20 min)');
});

test('previews log_action without duration', () => {
  const preview = previewAssistantTool('log_action', { title: 'Read', kind: 'general' });
  assert.equal(preview, 'Log action "Read" (general)');
});

test('previews plan_for_today', () => {
  const preview = previewAssistantTool('plan_for_today', {
    itemId: 't1',
    itemTitle: 'Call the bank',
    bucket: 'morning',
  });
  assert.equal(preview, 'Add "Call the bank" to Today (morning)');
});

test('previews plan_for_today with no bucket', () => {
  const preview = previewAssistantTool('plan_for_today', { itemId: 't1', itemTitle: 'Call the bank' });
  assert.equal(preview, 'Add "Call the bank" to Today');
});

test('previews create_mission with a domain', () => {
  const preview = previewAssistantTool('create_mission', { title: 'Launch app', domainTitle: 'Career' });
  assert.equal(preview, 'Create mission "Launch app" in Career');
});

test('previews create_mission without a domain', () => {
  const preview = previewAssistantTool('create_mission', { title: 'Launch app' });
  assert.equal(preview, 'Create mission "Launch app"');
});

test('previews create_skill locked with primary domain', () => {
  const preview = previewAssistantTool('create_skill', { title: 'Spanish', primaryDomainTitle: 'Creativity' });
  assert.equal(preview, 'Create skill "Spanish" in Creativity (still learning)');
});

test('previews create_skill unlocked without domain', () => {
  const preview = previewAssistantTool('create_skill', { title: 'Cooking', unlocked: true });
  assert.equal(preview, 'Create skill "Cooking"');
});

test('previews create_habit binary', () => {
  const preview = previewAssistantTool('create_habit', { title: 'Meditate', measurement: 'binary' });
  assert.equal(preview, 'Create habit "Meditate"');
});

test('previews create_habit with count target and unit', () => {
  const preview = previewAssistantTool('create_habit', {
    title: 'Drink water',
    measurement: 'count',
    target: 8,
    unit: 'glasses',
    period: 'daily',
  });
  assert.equal(preview, 'Create habit "Drink water" (8 glasses daily)');
});

test('previews link_items', () => {
  const preview = previewAssistantTool('link_items', {
    sourceId: 'h1',
    sourceTitle: 'Meditate',
    relationType: 'habitSkill',
    targetId: 's1',
    targetTitle: 'Mindfulness',
  });
  assert.equal(preview, 'Link "Meditate" → "Mindfulness" (habitSkill)');
});

test('previews set_focus', () => {
  const preview = previewAssistantTool('set_focus', {
    label: 'Health sprint',
    weights: [{ domainId: 'd1', weight: 1 }, { domainId: 'd2', weight: 0.5 }],
  });
  assert.equal(preview, 'Set focus to "Health sprint" (2 domains)');
});
