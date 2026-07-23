// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  formatTimelineTimeRange,
  getPreferredTimeBucket,
  getTimelineDurationMinutes,
  getTimelineItemDensity,
} from './timelineItem.ts';

function item(metadata = {}) {
  return {
    id: 'item-1',
    type: 'task',
    title: 'Review notes',
    status: 'scheduled',
    metadata: JSON.stringify(metadata),
    createdAt: 1,
    updatedAt: 1,
  };
}

test('uses a 45 minute default and selects adaptive card density', () => {
  assert.equal(getTimelineDurationMinutes(item()), 45);
  assert.equal(getTimelineItemDensity(15), 'short');
  assert.equal(getTimelineItemDensity(45), 'standard');
  assert.equal(getTimelineItemDensity(120), 'long');
});

test('instance duration overrides the item duration', () => {
  const instance = { instanceMetadata: JSON.stringify({ durationMinutes: 30 }) };
  assert.equal(getTimelineDurationMinutes(item({ durationMinutes: 90 }), instance), 30);
});

test('preferred bucket stays semantic and independent of scheduled time', () => {
  assert.equal(getPreferredTimeBucket(item({ time: '07:30', timeOfDay: 'morning', preferredTimeBucket: 'anytime' })), 'anytime');
});

test('formats a full scheduled time range', () => {
  assert.equal(formatTimelineTimeRange(195, 45), '03:15–04:00');
  assert.equal(formatTimelineTimeRange(23 * 60 + 45, 30), '23:45–24:00');
});
