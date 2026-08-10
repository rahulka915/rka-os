# Calendar Timeblocking Tray Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the read-only "Timeblocking" stats card on `CalendarScreen.tsx` with a collapsible tray listing unscheduled + today's-flexible tasks, where each tray card is a touch-drag source that schedules the task (setting date, and optionally time) when dropped onto the timeline.

**Architecture:** All new UI stays colocated in `CalendarScreen.tsx`, following the file's existing convention of defining `TimelineEntryCard`/`DayTimeline`/`WeekStrip` in the same file rather than splitting into separate components (they're tightly coupled to shared state: `daySectionLayouts`, `scrollRef`, `refreshAll`). A new pure-logic file (`src/utils/timelineDayLookup.ts`) extracts the "which day/time does this scroll-content Y coordinate correspond to" math so it's unit-testable outside the RN component tree — `CalendarScreen.tsx`'s existing inline boundary-matching logic (in `handleVerticalScroll`) is refactored to use the same shared function, removing duplication. Tray cards use `react-native-gesture-handler`'s `Gesture.Pan()` with **absolute-position** math (`event.absoluteY`), a different approach from the existing in-timeline reschedule drag (which is **relative-delta** based via `event.translationY` — that mechanism only works for items that already have a time to nudge from, so it cannot be reused for tray items that may have no date at all).

**Tech Stack:** React Native + Expo, `react-native-gesture-handler` (`Gesture.Pan`), Node's built-in `test` module for the new pure-logic file, existing `updateTimelineItemSchedule(id, scheduledDate?, time?)` DB function (already handles unschedule / date-only / date+time — confirmed unchanged).

## Global Constraints

- Mobile only — `apps/mobile/src/webApp/CalendarScreen.web.tsx` is untouched (spec: "Out of Scope").
- No new schema/metadata fields — one new read-only query function only (spec: "Data Model").
- Dropping a habit/recurring item still changes its base schedule, same caveat `updateTimelineItemSchedule` already has for any reschedule today — no new per-instance override UI (spec: "Out of Scope").
- No week-strip/multi-day drop target — a tray drop always targets whichever of the 3 currently-loaded days (`prevDateStr`/`dateStr`/`nextDateStr`) the touch point is over; there is no way to drop onto a day outside that loaded window (spec: "Out of Scope").
- No search/filter inside the tray in this version (spec: "Out of Scope").

---

## File Structure

- **Create** `apps/mobile/src/utils/timelineDayLookup.ts` — `findDayForContentY`, `computeDropTarget` pure functions.
- **Create** `apps/mobile/src/utils/timelineDayLookup.test.ts` — unit tests for the above.
- **Modify** `apps/mobile/src/db/database.ts` — add `getUnscheduledItems()`.
- **Modify** `apps/mobile/src/hooks/useDb.ts` — add `useUnscheduledItems()`.
- **Modify** `apps/mobile/src/screens/CalendarScreen.tsx` — replace the Timeblocking stats card with the new collapsible tray; add `TrayCard` component; wire drag state, drop handling, and timeline highlight; refactor `handleVerticalScroll` to use the new shared `findDayForContentY`.

---

### Task 1: `findDayForContentY` / `computeDropTarget` pure logic

**Files:**
- Create: `apps/mobile/src/utils/timelineDayLookup.ts`
- Test: `apps/mobile/src/utils/timelineDayLookup.test.ts`

**Interfaces:**
- Produces: `findDayForContentY(daySectionLayouts: Record<string, { y: number }>, contentY: number, hourHeight: number): string | null`, `computeDropTarget(daySectionLayouts: Record<string, { y: number }>, contentY: number, options: { hourHeight: number; dayTransitionHeight: number; laneHeaderHeight: number; snapMinutes: number }): { dateStr: string; minutes: number | null } | null` — consumed by Task 6 (`CalendarScreen.tsx`'s drag handling) and by the refactor of `handleVerticalScroll` in Task 6.

`findDayForContentY` is extracted verbatim from the existing inline logic in `CalendarScreen.tsx`'s `handleVerticalScroll` (lines 1090-1094: sort `daySectionLayouts` entries by `y`, then pick the last one whose `y - hourHeight/2` is at or below `contentY`). `computeDropTarget` builds on it: if the Y offset within the found day's section falls within the day-transition header band (`0` to `dayTransitionHeight`), the drop means "assign this day, no specific time" (`minutes: null`, i.e. an "Anytime" drop — mobile's timeline has no separate Anytime row like web's `DropRow`, so the day's own date-transition banner doubles as that drop zone). Otherwise, the offset past the full header (`dayTransitionHeight + laneHeaderHeight`) converts to minutes-into-day, clamped to `[0, 1440 - snapMinutes]` and snapped to the nearest `snapMinutes` step.

- [ ] **Step 1: Write the failing tests**

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { findDayForContentY, computeDropTarget } from './timelineDayLookup.ts';

const LAYOUTS = { '2026-08-02': { y: 0 }, '2026-08-03': { y: 1000 }, '2026-08-04': { y: 2000 } };
const HOUR_HEIGHT = 56;

test('findDayForContentY picks the day whose section the content Y falls within', () => {
  assert.equal(findDayForContentY(LAYOUTS, 0, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 500, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 999, HOUR_HEIGHT), '2026-08-02');
  assert.equal(findDayForContentY(LAYOUTS, 1000, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 1999, HOUR_HEIGHT), '2026-08-03');
  assert.equal(findDayForContentY(LAYOUTS, 2500, HOUR_HEIGHT), '2026-08-04');
});

test('findDayForContentY returns null above the first section (minus half an hour tolerance)', () => {
  assert.equal(findDayForContentY(LAYOUTS, -100, HOUR_HEIGHT), null);
});

test('findDayForContentY returns null for an empty layout map', () => {
  assert.equal(findDayForContentY({}, 500, HOUR_HEIGHT), null);
});

const OPTIONS = { hourHeight: 56, dayTransitionHeight: 56, laneHeaderHeight: 34, snapMinutes: 15 };

test('computeDropTarget: dropping within the day-transition header band means "Anytime" (minutes null)', () => {
  assert.deepEqual(computeDropTarget(LAYOUTS, 1020, OPTIONS), { dateStr: '2026-08-03', minutes: null });
});

test('computeDropTarget: dropping at the very top of the hour grid (just past the header) gives minutes 0', () => {
  const gridStart = 1000 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart, OPTIONS), { dateStr: '2026-08-03', minutes: 0 });
});

test('computeDropTarget: dropping partway down the hour grid converts and snaps to the nearest 15 minutes', () => {
  const gridStart = 1000 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  // 56px = 1 hour, so 28px into the grid = 30 minutes exactly.
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart + 28, OPTIONS), { dateStr: '2026-08-03', minutes: 30 });
  // 20px = ~21.4 minutes, snaps to 15.
  assert.deepEqual(computeDropTarget(LAYOUTS, gridStart + 20, OPTIONS), { dateStr: '2026-08-03', minutes: 15 });
});

test('computeDropTarget: clamps to the last valid slot near the end of the day', () => {
  const gridStart = 1000 + OPTIONS.dayTransitionHeight + OPTIONS.laneHeaderHeight;
  const wayPastMidnight = gridStart + OPTIONS.hourHeight * 30; // 30 hours in, way past 24h
  assert.deepEqual(computeDropTarget(LAYOUTS, wayPastMidnight, OPTIONS), { dateStr: '2026-08-03', minutes: 1440 - OPTIONS.snapMinutes });
});

test('computeDropTarget returns null when no day section contains the content Y', () => {
  assert.equal(computeDropTarget(LAYOUTS, -500, OPTIONS), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/timelineDayLookup.test.ts`
Expected: FAIL — `Cannot find module './timelineDayLookup.ts'`.

- [ ] **Step 3: Implement `timelineDayLookup.ts`**

```typescript
export function findDayForContentY(
  daySectionLayouts: Record<string, { y: number }>,
  contentY: number,
  hourHeight: number,
): string | null {
  const boundaries = Object.entries(daySectionLayouts).sort((a, b) => a[1].y - b[1].y);
  let activeDay: string | null = null;
  for (const [day, layout] of boundaries) {
    if (contentY >= layout.y - hourHeight / 2) activeDay = day;
  }
  return activeDay;
}

export interface ComputeDropTargetOptions {
  hourHeight: number;
  dayTransitionHeight: number;
  laneHeaderHeight: number;
  snapMinutes: number;
}

export interface DropTarget {
  dateStr: string;
  minutes: number | null;
}

export function computeDropTarget(
  daySectionLayouts: Record<string, { y: number }>,
  contentY: number,
  options: ComputeDropTargetOptions,
): DropTarget | null {
  const dateStr = findDayForContentY(daySectionLayouts, contentY, options.hourHeight);
  if (!dateStr) return null;

  const sectionY = daySectionLayouts[dateStr].y;
  const offsetIntoSection = contentY - sectionY;

  if (offsetIntoSection < options.dayTransitionHeight) {
    return { dateStr, minutes: null };
  }

  const offsetIntoGrid = offsetIntoSection - options.dayTransitionHeight - options.laneHeaderHeight;
  const rawMinutes = (Math.max(0, offsetIntoGrid) / options.hourHeight) * 60;
  const maxMinutes = 24 * 60 - options.snapMinutes;
  const clamped = Math.max(0, Math.min(maxMinutes, rawMinutes));
  const snapped = Math.round(clamped / options.snapMinutes) * options.snapMinutes;
  return { dateStr, minutes: snapped };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/timelineDayLookup.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/timelineDayLookup.ts apps/mobile/src/utils/timelineDayLookup.test.ts
git commit -m "feat(mobile): add pure day/time lookup helpers for Calendar drag targeting"
```

---

### Task 2: `getUnscheduledItems()` query

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (add near `getItemsByType`, `database.ts:173-178`)

**Interfaces:**
- Consumes: `getDb()` (already defined in this file), `Item` type (`src/db/types.ts`).
- Produces: `getUnscheduledItems(): Item[]` — consumed by Task 3 (`useUnscheduledItems()` hook).

Matches the existing rollup-query style (`getInboxItems`, `getItemsByStatus`, `getItemsByType`). `expo-sqlite` is native-only and cannot run under Node's test runner (confirmed earlier in this project — no DB-backed unit test exists for any `database.ts` function that isn't a pure transform), so this task has no automated test; it's verified in Task 7's manual pass.

- [ ] **Step 1: Add the function**

In `apps/mobile/src/db/database.ts`, add directly after `getItemsByType` (after line 178):

```typescript
// Rollup for the Calendar tray: every task-like item with no scheduledDate at
// all (Inbox + undated Tasks), matching the scope of the web app's
// UnscheduledPane — not date-scoped, unlike the timeline's existing
// "Flexible" concept (which only covers items already assigned to the
// viewed day but missing a time).
export function getUnscheduledItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE scheduledDate IS NULL AND deletedAt IS NULL AND status NOT IN ('completed', 'archived') ORDER BY createdAt DESC`
  );
}
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "database.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/database.ts
git commit -m "feat(mobile): add getUnscheduledItems query for the Calendar tray"
```

---

### Task 3: `useUnscheduledItems()` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts` (add near `useExercises`)

**Interfaces:**
- Consumes: `getUnscheduledItems(): Item[]` (Task 2), `useDbRefresh(refresh: () => void): void` (already in this file).
- Produces: `useUnscheduledItems(): { unscheduledItems: Item[]; refresh: () => void }` — consumed by Task 6 (`CalendarScreen.tsx`).

Matches the existing hook pattern exactly (e.g. `useExercises`, already in this file: `useState` + `useCallback` refresh + `useDbRefresh`).

- [ ] **Step 1: Add the hook**

```typescript
export function useUnscheduledItems() {
  const [unscheduledItems, setUnscheduledItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setUnscheduledItems(getUnscheduledItems());
  }, []);
  useDbRefresh(refresh);
  return { unscheduledItems, refresh };
}
```

Add `getUnscheduledItems` to this file's existing import from `../db/database`.

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "useDb.ts"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useDb.ts
git commit -m "feat(mobile): add useUnscheduledItems hook"
```

---

### Task 4: `TrayCard` — lightweight row component for tray items

**Files:**
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx` (add new component, colocated with `TimelineEntryCard`)

**Interfaces:**
- Consumes: `getTypeMeta(type: ItemType)`, `getAccentColor`, `getAccentSoftColor`, `renderTypeIcon` (all already defined in this file, `CalendarScreen.tsx:214-252`, operate purely on `ItemType`/`palette` — no `TimelineEntry` dependency).
- Produces: `TrayCard` component, props `{ id: string; title: string; type: ItemType; timeLabel: string; palette: ReturnType<typeof getThemeColors>; onPress: () => void }` — consumed by Task 5 (`TimeblockingTray`) and given a drag gesture in Task 6.

A simpler sibling to `TimelineEntryCard` — tray items are either raw unscheduled `Item`s (no `TimelineEntry` wrapper at all) or today's-flexible `TimelineEntry`s, so this component takes a normalized minimal shape rather than a full `TimelineEntry`.

- [ ] **Step 1: Add the component**

Add directly after the closing `}` of `TimelineEntryCard` (after line 597):

```typescript
interface TrayCardProps {
  id: string;
  title: string;
  type: ItemType;
  timeLabel: string;
  palette: ReturnType<typeof getThemeColors>;
  onPress: () => void;
}

function TrayCard({ title, type, timeLabel, palette, onPress }: TrayCardProps) {
  const typeMeta = getTypeMeta(type);
  const accentColor = getAccentColor(palette, typeMeta.accent);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      style={[s.trayCard, { backgroundColor: palette.surface, borderColor: palette.separator }]}
    >
      <RNView style={[s.trayCardAccent, { backgroundColor: accentColor }]} />
      {renderTypeIcon(type, palette.textSecondary, 13)}
      <RNText style={[s.trayCardTitle, { color: palette.text }]} numberOfLines={1}>
        {title}
      </RNText>
      <RNText style={[s.trayCardTime, { color: palette.textTertiary }]} numberOfLines={1}>
        {timeLabel}
      </RNText>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 2: Add the new styles**

In the `s` `StyleSheet.create` object (starts at line 1500), add:

```typescript
  trayCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    marginBottom: 8,
  },
  trayCardAccent: {
    width: 3,
    alignSelf: 'stretch',
    borderRadius: 2,
  },
  trayCardTitle: {
    flex: 1,
    fontSize: 14,
    fontWeight: '600',
  },
  trayCardTime: {
    fontSize: 12,
    fontWeight: '500',
  },
```

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "CalendarScreen"`
Expected: no output. (`TrayCard` isn't rendered anywhere yet — this only confirms it compiles standalone.)

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/CalendarScreen.tsx
git commit -m "feat(mobile): add TrayCard component for the Calendar tray"
```

---

### Task 5: `TimeblockingTray` — collapsible panel replacing the stats card

**Files:**
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `TrayCard` (Task 4), `useUnscheduledItems()` (Task 3), `unscheduledEntries` (already computed in `CalendarScreen`, `CalendarScreen.tsx:1103-1106`), `getEntryMinutes` (already in this file, `CalendarScreen.tsx:299-303`), `formatTimeLabel` (already imported).
- Produces: no new exports outside the file — this replaces the Timeblocking card's JSX in place. Drag wiring is added in Task 6; this task only builds the static (non-draggable-yet) collapsible list.

Per spec: collapsed by default, showing a compact summary; tap expands into two groups — "Unscheduled" (from `getUnscheduledItems()`, app-wide) and "Today" (`unscheduledEntries`, the viewed day's items with no time — this is the same data the removed FLEXIBLE section used, so the FLEXIBLE section below the timeline is deleted once this lands, per spec: "the FLEXIBLE section below the timeline is removed since its content now lives in this Today tray group").

- [ ] **Step 1: Add tray state and data to `CalendarScreen`**

In `CalendarScreen`, after the existing `const unscheduledEntries = useMemo(...)` block (after line 1106), add:

```typescript
const [trayExpanded, setTrayExpanded] = useState(false);
const { unscheduledItems, refresh: refreshUnscheduled } = useUnscheduledItems();
```

Add `useUnscheduledItems` to this file's existing import from `../hooks/useDb` (alongside `useCalendar`).

- [ ] **Step 2: Replace the Timeblocking `RiverStoneSurface` card**

Replace the entire block at `CalendarScreen.tsx:1293-1348` (the `<RiverStoneSurface variant="list" ...>` containing the stats row) with:

```tsx
<RiverStoneSurface
  variant="list"
  mode={isDark ? 'dark' : 'light'}
  shape="regular"
  style={s.sectionBarStone}
  contentStyle={s.sectionBar}
>
  <TouchableOpacity
    onPress={() => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      setTrayExpanded((v) => !v);
    }}
    activeOpacity={0.75}
  >
    <RNView style={s.sectionBarHeader}>
      <RNView style={s.sectionBarCopy}>
        <RNText style={[s.sectionBarLabel, { color: palette.text }]}>Timeblocking</RNText>
        <RNText style={[s.sectionBarHint, { color: palette.textTertiary }]} numberOfLines={1}>
          {trayExpanded ? 'Tap to collapse' : `${unscheduledItems.length + unscheduledEntries.length} to schedule · tap to expand`}
        </RNText>
      </RNView>
      <RNView style={s.sectionBarActions}>
        <TouchableOpacity
          onPress={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            openCreate(dateStr);
          }}
          style={[s.fabButton, { borderColor: CALENDAR_GOLD }]}
          hitSlop={10}
          accessibilityRole="button"
          accessibilityLabel="Add time block"
        >
          <Plus size={16} color={CALENDAR_GOLD} strokeWidth={2.4} />
        </TouchableOpacity>
      </RNView>
    </RNView>
  </TouchableOpacity>

  {trayExpanded && (
    <>
      <RNView style={[s.sectionCardDivider, { backgroundColor: palette.separatorStrong }]} />
      <ScrollView style={s.trayScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
        <RNText style={[s.traySectionLabel, { color: palette.textTertiary }]}>UNSCHEDULED</RNText>
        {unscheduledItems.length === 0 ? (
          <RNText style={[s.trayEmptyText, { color: palette.textTertiary }]}>Nothing unscheduled.</RNText>
        ) : (
          unscheduledItems.map((item) => (
            <TrayCard
              key={item.id}
              id={item.id}
              title={item.title}
              type={item.type}
              timeLabel="No date"
              palette={palette}
              onPress={() => openItem(item.id, item.type)}
            />
          ))
        )}

        <RNText style={[s.traySectionLabel, { color: palette.textTertiary, marginTop: 12 }]}>TODAY</RNText>
        {unscheduledEntries.length === 0 ? (
          <RNText style={[s.trayEmptyText, { color: palette.textTertiary }]}>Nothing flexible today.</RNText>
        ) : (
          unscheduledEntries.map((entry) => (
            <TrayCard
              key={entry.instance?.id ?? entry.item.id}
              id={entry.item.id}
              title={entry.item.title}
              type={entry.item.type}
              timeLabel="Anytime today"
              palette={palette}
              onPress={() => openEdit(entry, dateStr)}
            />
          ))
        )}
      </ScrollView>
    </>
  )}
</RiverStoneSurface>
```

Note: `openItem` is already available in `CalendarScreen` via `const openItem = useOpenItem();` (line 969) — confirm its signature accepts `(id: string, type: ItemType)` by checking `src/hooks/useOpenItem.ts` before this step; if its signature differs, adjust the call to match rather than guessing.

- [ ] **Step 3: Remove the now-redundant FLEXIBLE section**

Delete the entire block previously at `CalendarScreen.tsx:1381-1415` (the `{unscheduledEntries.length > 0 ? (...) : null}` section rendering `FLEXIBLE (...)` above the `<DayTimeline dayDate={prevDate} ...>` — its content now lives in the tray's "Today" group).

- [ ] **Step 4: Add the new styles**

Add to the `s` `StyleSheet.create` object:

```typescript
  trayScroll: {
    maxHeight: 320,
    paddingTop: 8,
  },
  traySectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 6,
  },
  trayEmptyText: {
    fontSize: 13,
    fontWeight: '400',
    marginBottom: 8,
  },
```

- [ ] **Step 5: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "CalendarScreen"`
Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/CalendarScreen.tsx
git commit -m "feat(mobile): replace Timeblocking stats card with collapsible tray"
```

---

### Task 6: Drag from tray onto the timeline

**Files:**
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `computeDropTarget` (Task 1), `TrayCard` (Task 4, gains a gesture), `updateTimelineItemSchedule(id: string, scheduledDate?: string, time?: string): void` (already exported from `src/db/database.ts:1235`, needs adding to this file's existing `../db/database` import alongside `updateTimelineItemTime`).
- Produces: no new exports — final wiring. `DayTimeline` gains one new prop, `dragHighlightMinutes: number | null`, so it can render a highlight at the drop-target row while a drag from the tray is in progress over that day.

This task also refactors `handleVerticalScroll`'s inline day-boundary matching (`CalendarScreen.tsx:1090-1094`) to call the shared `findDayForContentY` from Task 1, so the same geometry is never computed two different ways in the same file.

- [ ] **Step 1: Add scroll-position and gesture-target refs/state**

In `CalendarScreen`, after the existing `const scrollRef = useRef<ScrollView>(null);` (line 976), add:

```typescript
const scrollYRef = useRef(0);
const scrollViewAbsoluteYRef = useRef(0);
const [dragTarget, setDragTarget] = useState<{ dateStr: string; minutes: number | null } | null>(null);
```

- [ ] **Step 2: Track scroll offset and the ScrollView's absolute screen position**

In `handleVerticalScroll` (`CalendarScreen.tsx:1069`), add a line at the top of the function body to keep `scrollYRef` current:

```typescript
const handleVerticalScroll = (event: { nativeEvent: { contentOffset: { y: number } } }) => {
  const y = event.nativeEvent.contentOffset.y;
  scrollYRef.current = y;
  // ...rest of the existing function body is unchanged below this point
```

Refactor the existing inline boundary-matching block inside this same function (currently lines 1090-1094: `const boundaries = ...; let activeDay = null; for (...) {...}`) to call the shared helper instead:

```typescript
  const activeDay = findDayForContentY(daySectionLayouts, y, TIMELINE_METRICS.hourHeight);
```

Delete the old inline `boundaries`/`for` loop that this replaces. Add `findDayForContentY, computeDropTarget` to a new import at the top of `CalendarScreen.tsx`:

```typescript
import { findDayForContentY, computeDropTarget } from '../utils/timelineDayLookup';
```

On the main `<ScrollView ref={scrollRef} ...>` (`CalendarScreen.tsx:1363`), add an `onLayout` that measures its absolute screen position (in addition to the existing `onLayout` that sets `scrollViewportHeight` — merge both into one handler):

```tsx
<ScrollView
  ref={scrollRef}
  showsVerticalScrollIndicator={false}
  onLayout={(event) => {
    setScrollViewportHeight(event.nativeEvent.layout.height);
    event.target.measureInWindow((_x, y) => {
      scrollViewAbsoluteYRef.current = y;
    });
  }}
  onScroll={handleVerticalScroll}
  scrollEventThrottle={16}
  decelerationRate={0.7}
  contentContainerStyle={[
    s.scrollContent,
    { paddingBottom: Math.max(insets.bottom, 24) + 96 },
  ]}
>
```

- [ ] **Step 3: Add the drop handler**

After `handleReschedule` (`CalendarScreen.tsx:1168-1173`), add:

```typescript
const handleTrayDrop = (itemId: string, target: { dateStr: string; minutes: number | null }) => {
  updateTimelineItemSchedule(itemId, target.dateStr, target.minutes != null ? formatTimeLabel(target.minutes) : undefined);
  refreshAll();
  refreshUnscheduled();
};
```

Add `updateTimelineItemSchedule` to this file's existing import from `../db/database` (alongside `updateTimelineItemTime`).

- [ ] **Step 4: Give `TrayCard` a drag gesture**

Replace `TrayCard`'s definition (added in Task 4) with a version that adds `Gesture.Pan()`:

```typescript
interface TrayCardProps {
  id: string;
  title: string;
  type: ItemType;
  timeLabel: string;
  palette: ReturnType<typeof getThemeColors>;
  onPress: () => void;
  onDragUpdate: (absoluteY: number) => void;
  onDragEnd: (absoluteY: number, committed: boolean) => void;
}

function TrayCard({ title, type, timeLabel, palette, onPress, onDragUpdate, onDragEnd }: TrayCardProps) {
  const typeMeta = getTypeMeta(type);
  const accentColor = getAccentColor(palette, typeMeta.accent);
  const [isDragging, setIsDragging] = useState(false);
  const translateY = useRef(new Animated.Value(0)).current;

  const cardGesture = useMemo(() => {
    const tap = Gesture.Tap()
      .runOnJS(true)
      .maxDuration(280)
      .onEnd((_, success) => {
        if (success) onPress();
      });

    const drag = Gesture.Pan()
      .runOnJS(true)
      .activateAfterLongPress(300)
      .onStart(() => {
        setIsDragging(true);
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      })
      .onUpdate((event) => {
        translateY.setValue(event.translationY);
        onDragUpdate(event.absoluteY);
      })
      .onEnd((event, success) => {
        setIsDragging(false);
        Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        onDragEnd(event.absoluteY, success);
      })
      .onFinalize((event, success) => {
        if (!success) {
          setIsDragging(false);
          Animated.timing(translateY, { toValue: 0, duration: 160, useNativeDriver: true }).start();
        }
      });

    return Gesture.Exclusive(drag, tap);
  }, [onDragEnd, onDragUpdate, onPress, translateY]);

  return (
    <GestureDetector gesture={cardGesture}>
      <Animated.View
        style={[
          s.trayCard,
          {
            backgroundColor: palette.surface,
            borderColor: palette.separator,
            transform: [{ translateY }, { scale: isDragging ? 1.03 : 1 }],
            zIndex: isDragging ? 20 : 1,
            elevation: isDragging ? 6 : 0,
          },
        ]}
      >
        <RNView style={[s.trayCardAccent, { backgroundColor: accentColor }]} />
        {renderTypeIcon(type, palette.textSecondary, 13)}
        <RNText style={[s.trayCardTitle, { color: palette.text }]} numberOfLines={1}>
          {title}
        </RNText>
        <RNText style={[s.trayCardTime, { color: palette.textTertiary }]} numberOfLines={1}>
          {timeLabel}
        </RNText>
      </Animated.View>
    </GestureDetector>
  );
}
```

- [ ] **Step 5: Wire `onDragUpdate`/`onDragEnd` at each `TrayCard` call site**

In the tray JSX from Task 5 Step 2, add a shared conversion helper right before the `return` of `CalendarScreen` (near `handleTrayDrop`):

```typescript
const handleTrayDragUpdate = (absoluteY: number) => {
  const contentY = absoluteY - scrollViewAbsoluteYRef.current + scrollYRef.current;
  const target = computeDropTarget(daySectionLayouts, contentY, {
    hourHeight: TIMELINE_METRICS.hourHeight,
    dayTransitionHeight: TIMELINE_METRICS.dayTransitionHeight,
    laneHeaderHeight: TIMELINE_METRICS.laneHeaderHeight,
    snapMinutes: TIMELINE_METRICS.snapMinutes,
  });
  setDragTarget(target);
};

const handleTrayDragEnd = (itemId: string, absoluteY: number, committed: boolean) => {
  const contentY = absoluteY - scrollViewAbsoluteYRef.current + scrollYRef.current;
  const target = computeDropTarget(daySectionLayouts, contentY, {
    hourHeight: TIMELINE_METRICS.hourHeight,
    dayTransitionHeight: TIMELINE_METRICS.dayTransitionHeight,
    laneHeaderHeight: TIMELINE_METRICS.laneHeaderHeight,
    snapMinutes: TIMELINE_METRICS.snapMinutes,
  });
  setDragTarget(null);
  if (committed && target) {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    handleTrayDrop(itemId, target);
  }
};
```

Update both `<TrayCard ...>` call sites from Task 5 Step 2 to pass the new props, e.g. for the "Unscheduled" group:

```tsx
<TrayCard
  key={item.id}
  id={item.id}
  title={item.title}
  type={item.type}
  timeLabel="No date"
  palette={palette}
  onPress={() => openItem(item.id, item.type)}
  onDragUpdate={handleTrayDragUpdate}
  onDragEnd={(absoluteY, committed) => handleTrayDragEnd(item.id, absoluteY, committed)}
/>
```

and for the "Today" group:

```tsx
<TrayCard
  key={entry.instance?.id ?? entry.item.id}
  id={entry.item.id}
  title={entry.item.title}
  type={entry.item.type}
  timeLabel="Anytime today"
  palette={palette}
  onPress={() => openEdit(entry, dateStr)}
  onDragUpdate={handleTrayDragUpdate}
  onDragEnd={(absoluteY, committed) => handleTrayDragEnd(entry.item.id, absoluteY, committed)}
/>
```

- [ ] **Step 6: Highlight the drop target on `DayTimeline`**

Add a new prop to `DayTimelineProps` (`CalendarScreen.tsx:599-613`):

```typescript
  dragHighlightMinutes: number | null | undefined; // undefined = no drag targeting this day at all; null = "Anytime" (header) targeted; number = that minute row targeted
```

Pass it from each of the 3 `<DayTimeline>` call sites (Task 5's surrounding context, `CalendarScreen.tsx:1417-1459`), e.g. for the currently-viewed day:

```tsx
dragHighlightMinutes={dragTarget?.dateStr === dateStr ? dragTarget.minutes : undefined}
```

(and the equivalent `dragTarget?.dateStr === prevDateStr ? dragTarget.minutes : undefined` / `nextDateStr` variants for the other two instances).

Inside `DayTimeline`'s render (`CalendarScreen.tsx:726-739`), add a highlight overlay: a highlighted day-transition banner when `dragHighlightMinutes === null`, or a highlighted hour-row overlay positioned via `timelineOffsetForMinutes` when it's a number. Add directly after the existing `<RNView style={s.dayTransition}>` block's closing tag and before the `laneHeader` view:

```tsx
{dragHighlightMinutes === null && (
  <RNView pointerEvents="none" style={[s.dropHighlightBanner, { borderColor: CALENDAR_GOLD }]} />
)}
```

And inside `s.timelineContent` (the hour-grid container), add after its opening tag:

```tsx
{typeof dragHighlightMinutes === 'number' && (
  <RNView
    pointerEvents="none"
    style={[
      s.dropHighlightRow,
      { top: timelineOffsetForMinutes(dragHighlightMinutes), borderColor: CALENDAR_GOLD },
    ]}
  />
)}
```

Add the new styles:

```typescript
  dropHighlightBanner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: TIMELINE_METRICS.dayTransitionHeight,
    borderWidth: 2,
    borderRadius: 8,
  },
  dropHighlightRow: {
    position: 'absolute',
    left: TIMELINE_METRICS.gutterWidth,
    right: 0,
    height: TIMELINE_METRICS.hourHeight / 4,
    borderWidth: 2,
    borderRadius: 6,
  },
```

- [ ] **Step 7: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "CalendarScreen"`
Expected: no output.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/screens/CalendarScreen.tsx
git commit -m "feat(mobile): drag tray cards onto the Calendar timeline to schedule them"
```

---

### Task 7: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -v "^App\.web\|^src/webApp"`
Expected: zero errors (the `webApp/` filter excludes this repo's known-unrelated, pre-existing `.web.tsx`-resolution false positives).

- [ ] **Step 2: Run the full test suite**

Run: `cd apps/mobile && npm test 2>&1 | tail -20`
Expected: all tests pass, including the 8 new `timelineDayLookup.test.ts` tests from Task 1.

- [ ] **Step 3: On-device walkthrough**

Start Metro per `apps/mobile/CLAUDE.md`'s Quick Reference, open the app, navigate to Calendar, and verify:
- The Timeblocking card is now collapsed by default, showing a count summary ("N to schedule · tap to expand") instead of the old Blocks/Done/Flexible stats.
- Tapping it expands into "UNSCHEDULED" and "TODAY" groups; tapping again collapses it.
- The old FLEXIBLE section below the timeline no longer appears (its content is now only in the tray's "TODAY" group).
- Long-pressing a tray card and dragging it onto an hour row highlights that row (gold outline) while dragging, and releasing there sets the item's date to whichever day-section it landed on and time to that row — confirm by checking the item now appears in that day's timeline at the right time.
- Dragging a tray card and releasing it on a day's date-transition banner (the header area, not the hour grid) schedules it to that day with no time — confirm it now shows "Anytime" for that day instead of appearing at a specific hour.
- Releasing a drag outside the timeline (e.g. back over the tray) does nothing — the item stays where it was.
- Dragging from the "TODAY" group (already-scheduled-but-timeless items) still works the same way as from "UNSCHEDULED".
- Existing in-timeline reschedule dragging (long-press an already-placed card and drag it to a new time) still works unchanged — this plan didn't touch `TimelineEntryCard`'s own gesture.
- Test with the 3-day scroll window: scroll so the viewed day, previous day, and next day are all partially visible, then drag a tray card and confirm dropping onto the *previous* or *next* day's section (not just the currently-selected day) schedules it there correctly.

Expected: all of the above behave as described. Note and fix anything found before considering this done.

- [ ] **Step 4: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address manual verification findings for Calendar timeblocking tray"
```

(Skip this step if Step 3 found nothing to fix.)
