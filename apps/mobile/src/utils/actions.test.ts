// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  primaryEntityId,
  parseActionRow,
  actionSubtitle,
  buildActionFeed,
  groupFeedBySource,
} from './actions.ts';

test('primaryEntityId: uses skill > mission > pillar > domain, else manual', () => {
  assert.equal(primaryEntityId({ title: 'x', kind: 'general', skillId: 's', missionId: 'm', pillarId: 'p', domainId: 'd' }), 's');
  assert.equal(primaryEntityId({ title: 'x', kind: 'general', missionId: 'm', pillarId: 'p' }), 'm');
  assert.equal(primaryEntityId({ title: 'x', kind: 'general', pillarId: 'p' }), 'p');
  assert.equal(primaryEntityId({ title: 'x', kind: 'general', domainId: 'd' }), 'd');
  assert.equal(primaryEntityId({ title: 'x', kind: 'general' }), 'manual');
});

test('parseActionRow: reads valid details', () => {
  const a = parseActionRow({
    id: 'a1',
    entityId: 's',
    timestamp: 100,
    details: JSON.stringify({ title: 'Piano', kind: 'practice', durationMinutes: 30, intensity: 'high', why: 'recital', skillId: 's' }),
  });
  assert.equal(a.title, 'Piano');
  assert.equal(a.kind, 'practice');
  assert.equal(a.durationMinutes, 30);
  assert.equal(a.intensity, 'high');
  assert.equal(a.why, 'recital');
  assert.equal(a.skillId, 's');
});

test('parseActionRow: tolerates malformed/missing details', () => {
  const a = parseActionRow({ id: 'a1', entityId: 'manual', timestamp: 1, details: 'not json' });
  assert.equal(a.title, 'Action');
  assert.equal(a.kind, 'general');
  assert.equal(a.durationMinutes, undefined);
  assert.equal(a.intensity, undefined);
});

test('parseActionRow: rejects out-of-range/invalid field values', () => {
  const a = parseActionRow({ id: 'a1', entityId: 'manual', timestamp: 1, details: JSON.stringify({ durationMinutes: -5, intensity: 'extreme', kind: 'bogus' }) });
  assert.equal(a.durationMinutes, undefined);
  assert.equal(a.intensity, undefined);
  assert.equal(a.kind, 'general');
});

test('actionSubtitle: duration + intensity, else falls back to kind', () => {
  assert.equal(actionSubtitle(parseActionRow({ id: 'a', entityId: 'm', timestamp: 1, details: JSON.stringify({ title: 't', kind: 'practice', durationMinutes: 45, intensity: 'high' }) })), '45 min · high');
  assert.equal(actionSubtitle(parseActionRow({ id: 'a', entityId: 'm', timestamp: 1, details: JSON.stringify({ title: 't', kind: 'practice' }) })), 'Practice');
  assert.equal(actionSubtitle(parseActionRow({ id: 'a', entityId: 'm', timestamp: 1, details: JSON.stringify({ title: 't', kind: 'general' }) })), 'Action');
});

test('buildActionFeed: sorts newest-first across sources and applies limit', () => {
  const feed = buildActionFeed([
    { id: '1', source: 'action', title: 'A', timestamp: 100 },
    { id: '2', source: 'habit', title: 'B', timestamp: 300 },
    { id: '3', source: 'task', title: 'C', timestamp: 200 },
  ]);
  assert.deepEqual(feed.map((e) => e.id), ['2', '3', '1']);
  assert.deepEqual(buildActionFeed(feed, 2).map((e) => e.id), ['2', '3']);
});

test('buildActionFeed: empty input is empty', () => {
  assert.deepEqual(buildActionFeed([]), []);
});

test('groupFeedBySource: buckets by source, preserves within-group order, orders groups by most-recent entry', () => {
  const feed = buildActionFeed([
    { id: '1', source: 'action', title: 'A1', timestamp: 100 },
    { id: '2', source: 'habit', title: 'H1', timestamp: 300 },
    { id: '3', source: 'task', title: 'T1', timestamp: 250 },
    { id: '4', source: 'action', title: 'A2', timestamp: 200 },
    { id: '5', source: 'task', title: 'T2', timestamp: 50 },
  ]);
  const groups = groupFeedBySource(feed);
  assert.deepEqual(groups.map((g) => g.source), ['habit', 'task', 'action']);
  assert.deepEqual(groups.map((g) => g.label), ['Habit check-ins', 'Tasks', 'Actions']);
  assert.deepEqual(groups.find((g) => g.source === 'task')?.entries.map((e) => e.id), ['3', '5']);
  assert.deepEqual(groups.find((g) => g.source === 'action')?.entries.map((e) => e.id), ['4', '1']);
});

test('groupFeedBySource: empty input is empty', () => {
  assert.deepEqual(groupFeedBySource([]), []);
});
