# Web Companion Core GTD — Plan 2: Calendar/Timeline, Instances & Triage Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the remaining Core GTD stubs in `db/database.web.ts` — item instances, calendar/timeline reads, timed scheduling, and GTD triage — so Calendar and Inbox triage work in the browser, completing the Core GTD slice defined in the design spec.

**Architecture:** Same approach as Plan 1: each function is a mechanical port of the SQL in `db/database.ts` to a filter over the in-memory Firestore mirror in `db/firestoreWebStore.ts`, with writes going straight to Firestore. The one structural change is extracting the timeline-entry building logic (currently private to `database.ts`) into a shared pure module both platforms import, so the subtle time/duration fallback chains can't drift between them — and can finally be unit-tested.

**Tech Stack:** `firebase/firestore` (already a dependency), existing `node --test` runner, browser preview tools for verification.

## Global Constraints

- Mobile behaviour must not change. `db/database.ts` is only edited to consume the extracted shared module; every existing test must still pass and `npx tsc --noEmit` must stay clean.
- Metadata (`metadata`, `instanceMetadata`) stay JSON **strings**, matching what mobile writes and what's already in production Firestore.
- Fields cleared with SQL `NULL` use Firestore's `deleteField()` so they read back absent, matching the optional-property types on `Item`/`ItemInstance` — established in Plan 1.
- Web writes stay fire-and-forget through the existing `write(promise, label)` helper in `database.web.ts`, keeping signatures synchronous so no call site changes.
- No new Firestore rules or indexes: `itemInstances` is already covered by the rules deployed earlier, and every read is a full-collection filter, not a server-side query.
- Out of scope and still throwing stubs after this plan: medications, workouts, voice capture, objects. Only the four Core GTD screens are being completed.

---

## File Structure

**Create:**
- `apps/mobile/src/db/timelineEntry.ts` — `TimelineEntry` type plus the pure `buildTimelineEntries(items, instances)` used by both platforms
- `apps/mobile/src/db/timelineEntry.test.ts` — unit tests for the above

**Modify:**
- `apps/mobile/src/db/database.ts` — consume the shared module, re-export `TimelineEntry` so existing importers are unaffected
- `apps/mobile/src/db/firestoreWebStore.ts` — add the instance write helpers the ported functions need
- `apps/mobile/src/db/database.web.ts` — replace the instance, calendar, scheduling and triage stubs with real implementations

---

## Task 1: Extract timeline entry building into a shared module

**Files:**
- Create: `apps/mobile/src/db/timelineEntry.ts`
- Create: `apps/mobile/src/db/timelineEntry.test.ts`
- Modify: `apps/mobile/src/db/database.ts` (removes the private `parseJson`/`getEntryTiming`/`TimelineEntry` and the body of `getTimelineEntriesForDate`)

**Interfaces:**
- Consumes: `normalizeTimeInput`, `timeToMinutes`, `getTimeOfDayFromHour`, `TimeOfDay` from `../utils/time`; `Item`, `ItemInstance` from `./types`.
- Produces: `interface TimelineEntry` and `buildTimelineEntries(items: Item[], instances: ItemInstance[]): TimelineEntry[]`. Task 3 calls `buildTimelineEntries` from `database.web.ts`.

- [ ] **Step 1: Write the failing tests**

```typescript
// apps/mobile/src/db/timelineEntry.test.ts
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
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `Cannot find module './timelineEntry.ts'`.

- [ ] **Step 3: Write the shared module**

This is a verbatim move of `parseJson`, `getEntryTiming`, the `TimelineEntry` interface, and the body of `getTimelineEntriesForDate` out of `database.ts` — the only change is taking `items`/`instances` as arguments instead of querying for them.

```typescript
// apps/mobile/src/db/timelineEntry.ts
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';
import type { Item, ItemInstance } from './types';

export interface TimelineEntry {
  item: Item;
  instance?: ItemInstance;
  time: string | null;
  minutes: number | null;
  timeOfDay: TimeOfDay;
  preferredTimeBucket: TimeOfDay;
  durationMinutes: number;
}

function parseJson<T extends Record<string, any>>(value?: string | null): T {
  if (!value) return {} as T;
  try {
    return JSON.parse(value) as T;
  } catch {
    return {} as T;
  }
}

// Instance values win over item values, then a clock time, then 'anytime'.
function getEntryTiming(item: Item, instance?: ItemInstance) {
  const itemMeta = parseJson<Record<string, any>>(item.metadata);
  const instanceMeta = parseJson<Record<string, any>>(instance?.instanceMetadata);
  const time = normalizeTimeInput(instanceMeta.time ?? itemMeta.time);
  const minutes = timeToMinutes(time);
  const derivedHour = minutes != null ? Math.floor(minutes / 60) : null;
  const timeOfDay = (instanceMeta.timeOfDay ?? itemMeta.timeOfDay ?? (derivedHour != null ? getTimeOfDayFromHour(derivedHour) : 'anytime')) as TimeOfDay;
  const preferredTimeBucket = (instanceMeta.preferredTimeBucket ?? itemMeta.preferredTimeBucket ?? timeOfDay) as TimeOfDay;
  const rawDuration = instanceMeta.durationMinutes ?? itemMeta.durationMinutes;
  const durationMinutes = typeof rawDuration === 'number' && Number.isFinite(rawDuration) && rawDuration > 0
    ? Math.max(5, Math.min(24 * 60, Math.round(rawDuration)))
    : 45;

  return { time, minutes, timeOfDay, preferredTimeBucket, durationMinutes };
}

// Pure: both the SQLite and Firestore data layers hand it the day's rows and
// get back the same ordered timeline, so the fallback rules above can't drift
// between platforms.
export function buildTimelineEntries(items: Item[], instances: ItemInstance[]): TimelineEntry[] {
  const instanceByItemId = new Map(instances.map((instance) => [instance.itemId, instance] as const));
  const usedInstanceIds = new Set<string>();

  const entries: TimelineEntry[] = items.map((item) => {
    const instance = instanceByItemId.get(item.id);
    if (instance) usedInstanceIds.add(instance.id);
    return { item, instance, ...getEntryTiming(item, instance) };
  });

  for (const instance of instances) {
    if (usedInstanceIds.has(instance.id)) continue;
    const item = items.find((candidate) => candidate.id === instance.itemId);
    if (!item) continue;
    entries.push({ item, instance, ...getEntryTiming(item, instance) });
  }

  return entries.sort((a, b) => {
    const timeA = a.minutes ?? Number.POSITIVE_INFINITY;
    const timeB = b.minutes ?? Number.POSITIVE_INFINITY;
    if (timeA !== timeB) return timeA - timeB;
    return a.item.createdAt - b.item.createdAt;
  });
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `cd apps/mobile && npm test`
Expected: PASS — the 9 new tests plus the 82 that already existed.

- [ ] **Step 5: Point `database.ts` at the shared module**

In `apps/mobile/src/db/database.ts`, delete the `TimelineEntry` interface, `parseJson`, and `getEntryTiming` (they sit together around lines 1071–1104), and replace the body of `getTimelineEntriesForDate`:

```typescript
export function getTimelineEntriesForDate(date: string): TimelineEntry[] {
  return buildTimelineEntries(getItemsForDate(date), getInstancesForDate(date));
}
```

Add the import alongside the other `./` imports at the top of the file:

```typescript
import { buildTimelineEntries, type TimelineEntry } from './timelineEntry';
```

`CalendarScreen.tsx` and `useDb.ts` both do `import type { TimelineEntry } from '../db/database'`, so keep that name resolvable by re-exporting it — add this next to the other exports:

```typescript
export type { TimelineEntry } from './timelineEntry';
```

- [ ] **Step 6: Verify mobile is unchanged**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

Run: `cd apps/mobile && npm test`
Expected: all tests pass, 0 failures.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/db/timelineEntry.ts apps/mobile/src/db/timelineEntry.test.ts apps/mobile/src/db/database.ts
git commit -m "refactor(mobile): extract timeline entry building into a shared module"
```

---

## Task 2: Item instances on web

**Files:**
- Modify: `apps/mobile/src/db/firestoreWebStore.ts`
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `getItemInstancesSnapshot`, `putItemInstance`, `deleteItemInstanceDoc` from `./firestoreWebStore` (all exist from Plan 1).
- Produces: `deletePendingInstancesForItem(itemId: string): Promise<void>` in `firestoreWebStore.ts`; and in `database.web.ts` real implementations of `getInstancesForDate`, `getTodayInstances`, `completeInstance`, `updateInstanceMetadata` — replacing their throwing stubs. Tasks 3 and 4 rely on all of these.

- [ ] **Step 1: Add the bulk-delete helper to the store**

`updateTimelineItemSchedule` clears every pending instance for an item at once, which has no single-document equivalent. Append to `apps/mobile/src/db/firestoreWebStore.ts`:

```typescript
// Mirrors `DELETE FROM itemInstances WHERE itemId = ? AND status = 'pending'`.
// Reads the ids off the mirror rather than querying, since the listener already
// holds every instance for this user.
export async function deletePendingInstancesForItem(itemId: string): Promise<void> {
  const db = requireFirestore();
  const userId = requireUid();
  const pending = state.itemInstances.filter((i) => i.itemId === itemId && i.status === 'pending');
  if (pending.length === 0) return;
  const batch = writeBatch(db);
  pending.forEach((instance) => {
    batch.delete(doc(db, 'users', userId, 'itemInstances', instance.id));
  });
  await batch.commit();
}
```

- [ ] **Step 2: Replace the instance stubs in `database.web.ts`**

Delete these four throwing stubs from the "calendar/timeline, Plan 2" block — `getInstancesForDate`, `updateInstanceMetadata`, `getTodayInstances`, `completeInstance` — and add the implementations below. Put them under a new `// ── Instances ──` heading placed just above the `// ── Activity Logs ──` heading:

```typescript
// ── Instances ──────────────────────────────────────────────────────────

export function getInstancesForDate(date: string): ItemInstance[] {
  return getItemInstancesSnapshot()
    .filter((i) => i.scheduledDate === date)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getTodayInstances(): ItemInstance[] {
  const today = formatDate(new Date());
  return getItemInstancesSnapshot().filter((i) => i.scheduledDate === today);
}

// A missing instance is a no-op, matching an UPDATE that matches no rows.
export function updateInstanceMetadata(instanceId: string, metadata: Record<string, any>): void {
  const instance = getItemInstancesSnapshot().find((i) => i.id === instanceId);
  if (!instance) return;
  write(
    putItemInstance({ ...instance, instanceMetadata: JSON.stringify(metadata), updatedAt: Date.now() }),
    'updateInstanceMetadata'
  );
}

export function completeInstance(instanceId: string): void {
  const instance = getItemInstancesSnapshot().find((i) => i.id === instanceId);
  if (!instance) return;
  const now = Date.now();
  write(
    putItemInstance({ ...instance, status: 'completed', completedAt: now, updatedAt: now }),
    'completeInstance'
  );
}
```

Extend the existing import from `./firestoreWebStore` to bring in what these need:

```typescript
import {
  getItemsSnapshot,
  getActivityLogsSnapshot,
  getItemRelationsSnapshot,
  getItemOrderSnapshot,
  getItemInstancesSnapshot,
  putItem,
  patchItem,
  putActivityLogDoc,
  putItemRelation,
  deleteItemRelationDoc,
  replaceItemOrder,
  putItemInstance,
  deletePendingInstancesForItem,
} from './firestoreWebStore';
```

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

Run: `cd apps/mobile && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/firestoreWebStore.ts apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement item instances in database.web.ts"
```

---

## Task 3: Calendar reads on web

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `buildTimelineEntries` from `./timelineEntry` (Task 1); `getInstancesForDate` (Task 2); `getItemsSnapshot` from the store.
- Produces: real `getItemsForDate` and `getTimelineEntriesForDate`, replacing their stubs.

- [ ] **Step 1: Replace the calendar read stubs**

Delete the `getItemsForDate` and `getTimelineEntriesForDate` stubs and add these under a new `// ── Calendar ──` heading, placed just above the `// ── Instances ──` heading from Task 2:

```typescript
// ── Calendar ───────────────────────────────────────────────────────────

export function getItemsForDate(date: string): Item[] {
  return getItemsSnapshot()
    .filter((i) => i.scheduledDate === date && i.deletedAt == null)
    .sort((a, b) => a.createdAt - b.createdAt);
}

export function getTimelineEntriesForDate(date: string): TimelineEntry[] {
  return buildTimelineEntries(getItemsForDate(date), getInstancesForDate(date));
}
```

`TimelineEntry` is already re-exported as a type at the top of `database.web.ts`, so it needs no new import. Add the value import for the builder:

```typescript
import { buildTimelineEntries } from './timelineEntry';
```

- [ ] **Step 2: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

Run: `cd apps/mobile && npm test`
Expected: all tests pass.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement calendar reads in database.web.ts"
```

---

## Task 4: Timed scheduling on web

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `createItem`, `updateItemMetadata`, `getItemWithMetadata`, `formatDate`, `uuid`, `write` (all in `database.web.ts` from Plan 1); `getInstancesForDate`, `updateInstanceMetadata` (Task 2); `putItemInstance`, `deletePendingInstancesForItem`, `patchItem` from the store.
- Produces: real `createTimedItem`, `updateTimelineItemTime`, `updateTimelineItemSchedule`, replacing their stubs.

- [ ] **Step 1: Add the time utilities import**

`database.web.ts` doesn't import from `../utils/time` yet. Add it near the other imports at the top:

```typescript
import { getTimeOfDayFromHour, normalizeTimeInput, timeToMinutes, type TimeOfDay } from '../utils/time';
```

- [ ] **Step 2: Replace the scheduling stubs**

Delete the `createTimedItem`, `updateTimelineItemTime` and `updateTimelineItemSchedule` stubs, and add these to the `// ── Calendar ──` section below `getTimelineEntriesForDate`.

Note the `updateTimelineItemTime` stub currently takes two parameters; the real function takes an optional third (`timeOfDay?: TimeOfDay`), matching `database.ts`. That widening is intentional, not a typo — `CalendarScreen` calls it with two arguments, which still type-checks.

```typescript
export function createTimedItem(
  type: Item['type'],
  title: string,
  scheduledDate: string,
  time: string,
  notes?: string,
): { itemId: string; instanceId: string } {
  const normalizedTime = normalizeTimeInput(time) ?? '09:00';
  const itemId = createItem(type, title, 'scheduled', scheduledDate, notes);
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const nextMeta = { time: normalizedTime, timeOfDay, preferredTimeBucket: 'anytime', durationMinutes: 45 };
  updateItemMetadata(itemId, nextMeta);

  const now = Date.now();
  const instanceId = uuid();
  write(
    putItemInstance({
      id: instanceId,
      itemId,
      scheduledDate,
      status: 'pending',
      instanceMetadata: JSON.stringify(nextMeta),
      createdAt: now,
      updatedAt: now,
    }),
    'createTimedItem'
  );

  return { itemId, instanceId };
}

export function updateTimelineItemTime(id: string, time: string, timeOfDay?: TimeOfDay): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;

  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const nextTimeOfDay = timeOfDay ?? getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const preferredTimeBucket = meta.preferredTimeBucket ?? meta.timeOfDay ?? 'anytime';
  updateItemMetadata(id, {
    ...meta,
    time: normalizedTime,
    timeOfDay: nextTimeOfDay,
    preferredTimeBucket,
  });

  // Newest instance on the item's own scheduled date, matching the ORDER BY
  // createdAt DESC LIMIT 1 in database.ts.
  const instance = getInstancesForDate(item.scheduledDate ?? '')
    .filter((i) => i.itemId === id)
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (instance) {
    const parsed = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = parsed.preferredTimeBucket ?? preferredTimeBucket;
    updateInstanceMetadata(instance.id, {
      ...parsed,
      time: normalizedTime,
      timeOfDay: nextTimeOfDay,
      preferredTimeBucket: instancePreferredTimeBucket,
    });
  }
}

export function updateTimelineItemSchedule(id: string, scheduledDate?: string, time?: string): void {
  const item = getItemWithMetadata(id);
  if (!item) return;

  const metadata: Record<string, unknown> = item.metadata ? JSON.parse(item.metadata) : {};
  const now = Date.now();

  if (!scheduledDate) {
    delete metadata.time;
    delete metadata.timeOfDay;
    write(
      patchItem(id, {
        scheduledDate: deleteField(),
        status: item.status === 'scheduled' ? 'active' : item.status,
        metadata: JSON.stringify(metadata),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
    write(deletePendingInstancesForItem(id), 'updateTimelineItemSchedule');
    return;
  }

  if (!time) {
    // Date-only: keep the date, drop the time-of-day and any pending timed
    // instance that went with it, but don't clear the date itself.
    delete metadata.time;
    delete metadata.timeOfDay;
    write(
      patchItem(id, {
        scheduledDate,
        status: 'scheduled',
        metadata: JSON.stringify(metadata),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
    write(deletePendingInstancesForItem(id), 'updateTimelineItemSchedule');
    return;
  }

  const normalizedTime = normalizeTimeInput(time);
  if (!normalizedTime) return;
  const timeOfDay = getTimeOfDayFromHour(Math.floor(timeToMinutes(normalizedTime)! / 60));
  const preferredTimeBucket = metadata.preferredTimeBucket ?? metadata.timeOfDay ?? 'anytime';
  const nextMetadata = { ...metadata, time: normalizedTime, timeOfDay, preferredTimeBucket };

  write(
    patchItem(id, {
      scheduledDate,
      status: 'scheduled',
      metadata: JSON.stringify(nextMetadata),
      updatedAt: now,
    }),
    'updateTimelineItemSchedule'
  );

  const instance = getItemInstancesSnapshot()
    .filter((i) => i.itemId === id && i.status === 'pending')
    .sort((a, b) => b.createdAt - a.createdAt)[0];

  if (instance) {
    const instanceMetadata = instance.instanceMetadata ? JSON.parse(instance.instanceMetadata) : {};
    const instancePreferredTimeBucket = instanceMetadata.preferredTimeBucket ?? preferredTimeBucket;
    write(
      putItemInstance({
        ...instance,
        scheduledDate,
        instanceMetadata: JSON.stringify({
          ...instanceMetadata,
          time: normalizedTime,
          timeOfDay,
          preferredTimeBucket: instancePreferredTimeBucket,
        }),
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
  } else {
    write(
      putItemInstance({
        id: uuid(),
        itemId: id,
        scheduledDate,
        status: 'pending',
        instanceMetadata: JSON.stringify({ time: normalizedTime, timeOfDay }),
        createdAt: now,
        updatedAt: now,
      }),
      'updateTimelineItemSchedule'
    );
  }
}
```

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

Run: `cd apps/mobile && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement timed scheduling in database.web.ts"
```

---

## Task 5: GTD triage on web

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts`

**Interfaces:**
- Consumes: `getItemWithMetadata`, `updateItem`, `updateItemMetadata`, `setRelation`, `logActivity`, `formatDate`, `patchItem`, `write` — all already in `database.web.ts`.
- Produces: real `processInboxItem` and `applyTaskTriage`, replacing the final two stubs in the Core GTD scope.

- [ ] **Step 1: Replace the triage stubs**

Delete the `processInboxItem` and `applyTaskTriage` stubs and add these under a new `// ── GTD triage ──` heading placed above the `// ── Activity Logs ──` heading. Each destination writes the same status/type/metadata combination as `database.ts`, expressed as one patch instead of one UPDATE:

```typescript
// ── GTD triage ─────────────────────────────────────────────────────────

export function processInboxItem(id: string, destination: GtdDestination): void {
  const now = Date.now();
  const today = formatDate(new Date());

  if (destination === 'delete') {
    write(patchItem(id, { deletedAt: now, updatedAt: now }), 'processInboxItem');
    return;
  }

  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};

  const patches: Record<GtdDestination, Record<string, unknown> | null> = {
    delete: null, // handled above
    today: { status: 'active', scheduledDate: today, metadata: JSON.stringify({ ...meta, gtdContext: 'today' }) },
    morning: {
      status: 'active',
      scheduledDate: today,
      metadata: JSON.stringify({ ...meta, timeOfDay: 'morning', gtdContext: 'scheduled' }),
    },
    evening: {
      status: 'active',
      scheduledDate: today,
      metadata: JSON.stringify({ ...meta, timeOfDay: 'evening', gtdContext: 'scheduled' }),
    },
    project: { type: 'project', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'project' }) },
    area: { type: 'area', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'area' }) },
    habit: { type: 'habit', status: 'active', metadata: JSON.stringify({ ...meta, gtdContext: 'habit' }) },
    medication: {
      type: 'medication',
      status: 'active',
      metadata: JSON.stringify({ ...meta, gtdContext: 'medication' }),
    },
    object: {
      type: 'object',
      status: 'active',
      metadata: JSON.stringify({ ...meta, gtdContext: 'object', objectStatus: 'want' }),
    },
    reference: { status: 'archived', metadata: JSON.stringify({ ...meta, gtdContext: 'reference' }) },
    someday: { status: 'someday', metadata: JSON.stringify({ ...meta, gtdContext: 'someday' }) },
  };

  const patch = patches[destination];
  if (patch) {
    write(patchItem(id, { ...patch, updatedAt: now }), 'processInboxItem');
  }
  logActivity(id, 'status-changed', JSON.stringify({ destination }));
}

// Three separate writes rather than processInboxItem's single patch, matching
// database.ts — triage carries richer combined state than one GTD destination.
export function applyTaskTriage(
  id: string,
  decision: {
    priority: 'low' | 'medium' | 'high';
    when: 'today' | 'tomorrow' | 'week' | 'someday';
    projectId: string | null;
  },
): void {
  const item = getItemWithMetadata(id);
  const meta = item?.metadata ? JSON.parse(item.metadata) : {};
  meta.priority = decision.priority;

  const today = formatDate(new Date());
  const tomorrow = formatDate(new Date(Date.now() + 24 * 60 * 60 * 1000));

  switch (decision.when) {
    case 'today':
      updateItem(id, { status: 'active', scheduledDate: today });
      break;
    case 'tomorrow':
      updateItem(id, { status: 'active', scheduledDate: tomorrow });
      break;
    case 'week':
      meta.gtdContext = 'week';
      updateItem(id, { status: 'active', scheduledDate: null });
      break;
    case 'someday':
      updateItem(id, { status: 'someday', scheduledDate: null });
      break;
  }

  updateItemMetadata(id, meta);
  setRelation(id, 'project', decision.projectId);
  logActivity(id, 'status-changed', JSON.stringify({ destination: 'triage-task', ...decision }));
}
```

- [ ] **Step 2: Confirm no Core GTD stubs remain**

Run: `cd apps/mobile && grep -n "Plan 2" src/db/database.web.ts`
Expected: no output — both "calendar/timeline, Plan 2" and "GTD triage, Plan 2" comment blocks are gone. The only remaining `notImplementedOnWeb` stubs should be medication functions plus `getDb`/`syncItemToRemote`.

Run: `cd apps/mobile && grep -c "notImplementedOnWeb('" src/db/database.web.ts`
Expected: 29. It is 40 before this plan; the 11 stubs replaced across Tasks 2–5 are `getItemsForDate`, `getInstancesForDate`, `getTimelineEntriesForDate`, `createTimedItem`, `updateTimelineItemTime`, `updateTimelineItemSchedule`, `updateInstanceMetadata`, `getTodayInstances`, `completeInstance`, `processInboxItem`, `applyTaskTriage`. What remains is the medication surface plus `getDb` and `syncItemToRemote`.

- [ ] **Step 3: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no output.

Run: `cd apps/mobile && npm test`
Expected: all tests pass.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/database.web.ts
git commit -m "feat(mobile): implement GTD triage in database.web.ts"
```

---

## Task 6: Verify Core GTD in the browser

**Files:** none (verification only)

Note on tooling, learned in Plan 1: the preview browser does not execute the page's own `<script defer>` tag, and it dies once the fully-rendered app has been running for a few seconds. The reliable technique is to fetch the bundle and `eval` it manually, then read the DOM within ~1 second — and to send findings to an external HTTP probe rather than relying on `console` capture, which drops React's `%s`-formatted messages.

- [ ] **Step 1: Start the probe server**

```bash
cat > /tmp/probe_server.py <<'EOF'
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs

class H(BaseHTTPRequestHandler):
    def do_GET(self):
        q = parse_qs(urlparse(self.path).query)
        with open('/tmp/probe.log', 'a') as f:
            f.write(q.get('m', [''])[0] + '\n---\n')
        self.send_response(204)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
    def log_message(self, *a):
        pass

HTTPServer(('127.0.0.1', 8123), H).serve_forever()
EOF
rm -f /tmp/probe.log
nohup python3 /tmp/probe_server.py > /dev/null 2>&1 &
sleep 2
curl -s "http://localhost:8123/?m=ready" -o /dev/null -w "probe %{http_code}\n"
```

Expected: `probe 204`.

- [ ] **Step 2: Start the web dev server**

Use `preview_start` with the `mobile-web` configuration already in `.claude/launch.json`, then wait ~20 seconds for Metro to finish bundling. Note the port it reports — it may not be 8098 if that port is taken.

- [ ] **Step 3: Load the app and report what rendered**

Run via `preview_eval`, substituting the port from Step 2:

```javascript
(async () => {
  window.__beacon = (msg) => {
    try { fetch('http://localhost:8123/?m=' + encodeURIComponent(String(msg).slice(0, 900)), { mode: 'no-cors' }); } catch(e) {}
  };
  const orig = console.error;
  console.error = function(...args) {
    window.__beacon('ERR: ' + args.map(a => (a && a.stack) ? a.stack : String(a)).join(' :: '));
    orig.apply(console, args);
  };
  window.addEventListener('error', (e) => window.__beacon('WINDOW: ' + (e.error && e.error.stack ? e.error.stack : e.message)));

  const snap = (tag) => {
    const root = document.getElementById('root');
    window.__beacon(tag + ' children=' + (root ? root.children.length : -1) + ' TEXT=' + (root ? root.innerText.slice(0,250).replace(/\n/g,' | ') : 'none'));
  };

  const res = await fetch('http://localhost:8098/index.ts.bundle?platform=web&dev=true&hot=false&lazy=true&transform.engine=hermes&transform.routerRoot=app&unstable_transformProfile=hermes-stable');
  const text = await res.text();
  try { (0, eval)(text); window.__beacon('EVAL_OK'); } catch (e) { window.__beacon('THREW: ' + (e && e.stack ? e.stack : String(e))); }
  snap('T0');
  setTimeout(() => snap('T150'), 150);
  return 'started';
})()
```

Then read the results:

```bash
sleep 8 && cat /tmp/probe.log
```

Expected: `EVAL_OK`, then a `T0` line with `children=1` and the Home screen's text, and no `ERR:`/`WINDOW:` lines. Any `is not implemented on web yet` message names a function this plan was supposed to cover — fix it before continuing.

- [ ] **Step 4: Sign in and confirm real data loads**

This is the part Plan 1 could not verify. In the same eval session — the tab survives for a few seconds after render — sign in with the account whose data is already in Firestore, then snapshot again:

```javascript
(async () => {
  const snap = (tag) => {
    const root = document.getElementById('root');
    window.__beacon(tag + ' TEXT=' + (root ? root.innerText.slice(0,400).replace(/\n/g,' | ') : 'none'));
  };
  setTimeout(() => snap('AFTER_LOAD'), 500);
  return 'watching';
})()
```

If the tab dies before this lands, fall back to signing in manually: run `npm run web` in a terminal, open the printed URL in a real browser, sign in, and check that Inbox/Tasks show the same items as the phone.

Expected: item titles from Firestore appear rather than the empty-state copy.

- [ ] **Step 5: Clean up**

```bash
pkill -f probe_server.py
rm -f /tmp/probe.log /tmp/probe_server.py
```

---

## What this plan does not do (by design)

- Medications, workouts, voice capture and object tracking stay stubbed — out of scope per the design spec, and their screens will throw if opened on web.
- No production build or hosting. `expo export -p web` and a Firebase Hosting config are a separate piece of work, best done once Core GTD is verified.
- No Tauri/Mac wrapper — downstream of a deployable web build.
- Drag-to-reorder on web is unverified; `react-native-draggable-flatlist`'s browser support is unknown and `setManualOrder` may simply never be called there.
