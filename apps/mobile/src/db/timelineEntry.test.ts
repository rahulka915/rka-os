// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildTimelineEntries } from './timelineEntry.ts';

function item(id, overrides = {}) {
  return { id, type: 'task', title: id, status: 'scheduled', createdAt: 0, updatedAt: 0, ...overrides };
}

function instance(id, itemId, overrides = {}) {
  return { id, itemId, scheduledDate: '2026-07-30', status: 'pending', createdAt: 0, updatedAt: 0, ...overrides };
}

test('sorts by time and puts untimed entries last', () => {
  const entries = buildTimelineEntries(
    [
      item('untimed'),
      item('late', { metadata: JSON.stringify({ time: '16:00' }) }),
      item('early', { metadata: JSON.stringify({ time: '08:30' }) }),
    ],
    []
  );
  assert.deepEqual(entries.map((e) => e.item.id), ['early', 'late', 'untimed']);
});

test('breaks ties on equal times using createdAt', () => {
  const entries = buildTimelineEntries(
    [
      item('second', { createdAt: 200, metadata: JSON.stringify({ time: '09:00' }) }),
      item('first', { createdAt: 100, metadata: JSON.stringify({ time: '09:00' }) }),
    ],
    []
  );
  assert.deepEqual(entries.map((e) => e.item.id), ['first', 'second']);
});

test('instance metadata takes precedence over item metadata', () => {
  const entries = buildTimelineEntries(
    [item('a', { metadata: JSON.stringify({ time: '08:00', durationMinutes: 30 }) })],
    [instance('i1', 'a', { instanceMetadata: JSON.stringify({ time: '14:00' }) })]
  );
  assert.equal(entries[0].time, '14:00');
  assert.equal(entries[0].minutes, 14 * 60);
  // durationMinutes has no instance override, so the item's value still applies
  assert.equal(entries[0].durationMinutes, 30);
});

test('derives timeOfDay from the clock time when metadata omits it', () => {
  const entries = buildTimelineEntries([item('a', { metadata: JSON.stringify({ time: '08:00' }) })], []);
  assert.equal(entries[0].timeOfDay, 'morning');
});

test('defaults an untimed entry to anytime with a 45 minute duration', () => {
  const entries = buildTimelineEntries([item('a')], []);
  assert.equal(entries[0].time, null);
  assert.equal(entries[0].minutes, null);
  assert.equal(entries[0].timeOfDay, 'anytime');
  assert.equal(entries[0].durationMinutes, 45);
});

test('clamps out-of-range durations and ignores non-numeric ones', () => {
  const tiny = buildTimelineEntries([item('a', { metadata: JSON.stringify({ durationMinutes: 1 }) })], []);
  assert.equal(tiny[0].durationMinutes, 5);

  const huge = buildTimelineEntries([item('b', { metadata: JSON.stringify({ durationMinutes: 99999 }) })], []);
  assert.equal(huge[0].durationMinutes, 24 * 60);

  const bogus = buildTimelineEntries([item('c', { metadata: JSON.stringify({ durationMinutes: 'nope' }) })], []);
  assert.equal(bogus[0].durationMinutes, 45);
});

test('survives unparseable metadata', () => {
  const entries = buildTimelineEntries([item('a', { metadata: '{not json' })], []);
  assert.equal(entries[0].durationMinutes, 45);
  assert.equal(entries[0].timeOfDay, 'anytime');
});

test('skips instances whose item is not in the list', () => {
  const entries = buildTimelineEntries([item('a')], [instance('i1', 'missing-item')]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].item.id, 'a');
});

test('pairs each item with its instance', () => {
  const entries = buildTimelineEntries([item('a')], [instance('i1', 'a')]);
  assert.equal(entries.length, 1);
  assert.equal(entries[0].instance.id, 'i1');
});
