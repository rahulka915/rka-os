// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDayForContentY, computeDropTarget } from './timelineDayLookup.ts';

// Spaced 1500px apart — enough room for a full 24h grid (56 + 34 + 24*56 = 1434px)
// plus a little breathing room, so a day's own section never bleeds into the next.
const LAYOUTS = { '2026-08-02': { y: 0 }, '2026-08-03': { y: 1500 }, '2026-08-04': { y: 3000 } };
const HOUR_HEIGHT = 56;

test('findDayForContentY picks the day whose section the content Y falls within', () => {
  assert.equal(findDayForContentY(LAYOUTS, 0, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 500, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 1400, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 1500, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 2900, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 3500, HOUR_HEIGHT), '2026-08-04');
});

test('findDayForContentY leans into the next section slightly early, within half an hour of tolerance', () => {
  // hourHeight/2 = 28px before a section's y still counts as that section —
  // matches the existing app's pre-tolerance behavior in handleVerticalScroll.
  assert.equal(findDayForContentY(LAYOUTS, 1499, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 1473, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 1471, HOUR_HEIGHT), '2026-08-02');
});

test('findDayForContentY returns null above the first section (minus half an hour tolerance)', () => {
  assert.equal(findDayForContentY(LAYOUTS, -100, HOUR_HEIGHT), null);
});

test('findDayForContentY returns null for an empty layout map', () => {
  assert.equal(findDayForContentY({}, 500, HOUR_HEIGHT), null);
});

const OPTIONS = { hourHeight: 56, dayTransitionHeight: 56, laneHeaderHeight: 34, snapMinutes: 15 };

test('computeDropTarget: dropping within the day-transition header band means "Anytime" (minutes null)', () => {
  assert.deepEqual(computeDropTarget(LAYOUTS, 1520, OPTIONS), { dateStr: '2026-08-03', minutes: null });
});

test('computeDropTarget: dropping at the very top of the hour grid (just past the header) gives minutes 0', () => {
  const gridStart = 1500 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart, OPTIONS), { dateStr: '2026-08-03', minutes: 0 });
});

test('computeDropTarget: dropping partway down the hour grid converts and snaps to the nearest 15 minutes', () => {
  const gridStart = 1500 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  // 56px = 1 hour, so 28px into the grid = 30 minutes exactly.
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart + 28, OPTIONS), { dateStr: '2026-08-03', minutes: 30 });
  // 20px = ~21.4 minutes, snaps to 15.
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart + 20, OPTIONS), { dateStr: '2026-08-03', minutes: 15 });
});

test('computeDropTarget: clamps to the last valid slot near the end of the day', () => {
  const gridStart = 1500 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  const nearMidnight = gridStart + OPTIONS.hourHeight * 24; // a full 24h in, right at the boundary of this section
  assert.deepEqual(computeDropTarget(LAYOUTS, nearMidnight, OPTIONS), { dateStr: '2026-08-03', minutes: 1440 - OPTIONS.snapMinutes });
});

test('computeDropTarget returns null when no day section contains the content Y', () => {
  assert.equal(computeDropTarget(LAYOUTS, -500, OPTIONS), null);
});
