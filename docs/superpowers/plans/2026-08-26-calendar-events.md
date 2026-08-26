# Calendar Events Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a new `event` item type to RKA OS — a fixed-date, optionally-timed, never-completable calendar entry (concert, birthday, appointment), distinct from `task`, on both native iOS and desktop web.

**Architecture:** `event` extends the existing single-table `items` model (`type='event'`, `status` fixed at `'scheduled'`, `rrule='FREQ=YEARLY'` for the yearly-repeat checkbox). A new `EventMeta` metadata shape (mirroring `BackwardPlanMeta`) carries `startTime`/`endTime`/`location`/reminder/device-calendar fields. Native gets a dedicated `AddEventSheet.tsx` (modeled on the existing `AnchorEventEditSheet.tsx`) wired into `CalendarScreen.tsx`; web gets a `DetailPanel`-hosted `AddEventForm.web.tsx` (modeled on `MedicationEditForm.web.tsx`) wired into `CalendarScreen.web.tsx`. Both DB layers (`database.ts` native SQLite, `database.web.ts` Firestore-web) get parallel `createEvent`/`updateEvent`/`deleteEvent` wrappers.

**Tech Stack:** React Native 0.86.2 + Expo SDK 57, SQLite (native) / Firestore (web), `expo-notifications`, `expo-calendar/legacy`, Node's built-in test runner (`node --test`) for pure-function unit tests.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-08-26-calendar-events-design.md` — read it before starting; every task below implements one of its sections.
- Events are never completable: `status` is always `'scheduled'`, and no UI path may render a checkbox or call `updateItemStatus`/`onComplete` for `type === 'event'`.
- No overnight events: `endTime`, when set, must be later than `startTime` on the same day. Enforce in the form, not the DB.
- Recurrence is yearly-only, via `rrule = 'FREQ=YEARLY'` — no other rrule values are produced by this feature.
- Reminder offsets are a fixed picker (15m / 30m / 1h / 1 day) — no free-entry duration field.
- Device calendar write is one-way, create-only, native-only, opt-in per event, and must never block or roll back the RKA-side save on permission denial or failure (fail soft).
- Native-only pieces: local push reminder, device-calendar write toggle. Web gets full create/edit/render parity otherwise.
- `WEB_PARITY.md` must be updated in the same pass (Task 13) — this is a repo-wide rule (`AGENTS.md`/`CLAUDE.md`), not optional cleanup.
- Testing reality check: this codebase has **no test harness for SQLite (`database.ts`), Firestore (`database.web.ts`), or React Native components** — the only existing automated tests are plain Node (`node --experimental-strip-types --test src/**/*.test.ts`) against pure `.ts` utility functions (see `src/db/timelineEntry.test.ts`). Tasks that touch pure logic (Task 1) get real write-test-first steps. Tasks that touch DB wrappers, UI components, or native modules (expo-calendar, expo-notifications) are verified by a manual simulator smoke-test step instead of an automated test, consistent with how every other DB/UI change in this codebase is verified today.
- Follow existing patterns exactly: `EventMeta`/`parseEventMeta` mirror `BackwardPlanMeta`/`parseBackwardPlanMeta` (`src/utils/backwardPlanMeta.ts`); `createEvent`/`updateEvent`/`deleteEvent` mirror `createBackwardPlan`/`updateBackwardPlan`/`deleteBackwardPlan`; `AddEventSheet.tsx` mirrors `AnchorEventEditSheet.tsx`; `AddEventForm.web.tsx` mirrors `MedicationEditForm.web.tsx`.

---

### Task 1: `eventMeta.ts` utility + `ItemType` addition

**Files:**
- Create: `apps/mobile/src/utils/eventMeta.ts`
- Create: `apps/mobile/src/utils/eventMeta.test.ts`
- Modify: `apps/mobile/src/db/types.ts:1`

**Interfaces:**
- Produces: `EventMeta` interface, `parseEventMeta(metadata?: string | null): EventMeta`, `REMINDER_OPTIONS: ReminderOption[]`, `ALL_DAY_REMINDER_HOUR: number`, `computeReminderFireDate(scheduledDate: string, meta: Pick<EventMeta, 'startTime'|'reminderMinutesBefore'>, now?: Date): Date | null`, `formatClockTime(time: string): string`, `formatEventTimeLabel(meta: Pick<EventMeta, 'startTime'|'endTime'>): string` — all consumed by Tasks 2–12.
- Produces: `ItemType` now includes `'event'` — consumed by every later task.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/utils/eventMeta.test.ts`:

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import {
  parseEventMeta,
  computeReminderFireDate,
  formatClockTime,
  formatEventTimeLabel,
  REMINDER_OPTIONS,
  ALL_DAY_REMINDER_HOUR,
} from './eventMeta.ts';

test('parseEventMeta returns {} for null/undefined/empty metadata', () => {
  assert.deepEqual(parseEventMeta(undefined), {});
  assert.deepEqual(parseEventMeta(null), {});
  assert.deepEqual(parseEventMeta(''), {});
});

test('parseEventMeta returns {} for unparseable JSON', () => {
  assert.deepEqual(parseEventMeta('{not json'), {});
});

test('parseEventMeta round-trips a full metadata object', () => {
  const json = JSON.stringify({
    startTime: '15:30',
    endTime: '17:00',
    location: 'The Fillmore',
    reminderMinutesBefore: 60,
    reminderNotificationId: 'notif-1',
    deviceCalendarEventId: 'device-1',
  });
  assert.deepEqual(parseEventMeta(json), {
    startTime: '15:30',
    endTime: '17:00',
    location: 'The Fillmore',
    reminderMinutesBefore: 60,
    reminderNotificationId: 'notif-1',
    deviceCalendarEventId: 'device-1',
  });
});

test('parseEventMeta drops non-string/non-number garbage fields', () => {
  const json = JSON.stringify({ startTime: 42, reminderMinutesBefore: 'soon', location: '' });
  assert.deepEqual(parseEventMeta(json), {});
});

test('computeReminderFireDate returns null when no reminderMinutesBefore is set', () => {
  assert.equal(computeReminderFireDate('2026-09-01', { startTime: '15:30' }), null);
});

test('computeReminderFireDate returns null once the fire time has already passed', () => {
  const now = new Date(2026, 8, 1, 15, 20); // Sept 1 2026, 3:20pm
  const result = computeReminderFireDate('2026-09-01', { startTime: '15:30', reminderMinutesBefore: 60 }, now);
  assert.equal(result, null);
});

test('computeReminderFireDate offsets from startTime for a timed event', () => {
  const now = new Date(2026, 8, 1, 8, 0);
  const result = computeReminderFireDate('2026-09-01', { startTime: '15:30', reminderMinutesBefore: 30 }, now);
  assert.equal(result.getHours(), 15);
  assert.equal(result.getMinutes(), 0);
});

test('computeReminderFireDate uses ALL_DAY_REMINDER_HOUR for an all-day event', () => {
  const now = new Date(2026, 7, 1, 8, 0);
  const result = computeReminderFireDate('2026-09-01', { reminderMinutesBefore: 1440 }, now);
  assert.equal(result.getDate(), 31); // Aug 31, 1 day before Sept 1 at ALL_DAY_REMINDER_HOUR
  assert.equal(result.getMonth(), 7);
  assert.equal(result.getHours(), ALL_DAY_REMINDER_HOUR);
});

test('formatClockTime formats 24h HH:MM as 12h with AM/PM', () => {
  assert.equal(formatClockTime('15:30'), '3:30 PM');
  assert.equal(formatClockTime('00:05'), '12:05 AM');
  assert.equal(formatClockTime('12:00'), '12:00 PM');
});

test('formatEventTimeLabel handles all-day, start-only, and start+end', () => {
  assert.equal(formatEventTimeLabel({}), 'All day');
  assert.equal(formatEventTimeLabel({ startTime: '15:30' }), '3:30 PM');
  assert.equal(formatEventTimeLabel({ startTime: '15:30', endTime: '17:00' }), '3:30 PM – 5:00 PM');
});

test('REMINDER_OPTIONS has the four fixed offsets', () => {
  assert.deepEqual(REMINDER_OPTIONS.map((o) => o.minutesBefore), [15, 30, 60, 1440]);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && npm test -- src/utils/eventMeta.test.ts`
Expected: FAIL — `Cannot find module './eventMeta.ts'` (or similar) since the file doesn't exist yet.

- [ ] **Step 3: Write `eventMeta.ts`**

Create `apps/mobile/src/utils/eventMeta.ts`:

```typescript
// Calendar Events metadata — see database.ts's createEvent/updateEvent for the
// repository functions that read/write these, and
// docs/superpowers/specs/2026-08-26-calendar-events-design.md for the full spec.

export interface EventMeta {
  startTime?: string;               // 'HH:MM' 24h, absent = all-day event
  endTime?: string;                 // 'HH:MM' 24h, optional, only meaningful when startTime is set
  location?: string;
  reminderMinutesBefore?: number;   // one of REMINDER_OPTIONS' values; absent = no reminder
  reminderNotificationId?: string;  // expo-notifications id, native only — for cancel/reschedule on edit/delete
  deviceCalendarEventId?: string;   // id of the device calendar event created alongside this one, native only — never re-read or written back to after creation
}

export function parseEventMeta(metadata?: string | null): EventMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    const str = (v: unknown) => (typeof v === 'string' && v.length > 0 ? v : undefined);
    const num = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) ? v : undefined);
    return {
      startTime: str(parsed.startTime),
      endTime: str(parsed.endTime),
      location: str(parsed.location),
      reminderMinutesBefore: num(parsed.reminderMinutesBefore),
      reminderNotificationId: str(parsed.reminderNotificationId),
      deviceCalendarEventId: str(parsed.deviceCalendarEventId),
    };
  } catch {
    return {};
  }
}

export interface ReminderOption {
  label: string;
  minutesBefore: number;
}

export const REMINDER_OPTIONS: ReminderOption[] = [
  { label: '15 minutes before', minutesBefore: 15 },
  { label: '30 minutes before', minutesBefore: 30 },
  { label: '1 hour before', minutesBefore: 60 },
  { label: '1 day before', minutesBefore: 1440 },
];

// Default local hour an all-day event's reminder fires at, since there's no
// clock time to offset from (spec: "fires at a fixed default local time").
export const ALL_DAY_REMINDER_HOUR = 9;

// Computes the wall-clock Date a reminder should fire at, or null if that
// moment has already passed relative to `now` — never schedule a past-dated
// notification (spec's Reminder section).
export function computeReminderFireDate(
  scheduledDate: string,
  meta: Pick<EventMeta, 'startTime' | 'reminderMinutesBefore'>,
  now: Date = new Date(),
): Date | null {
  if (!meta.reminderMinutesBefore) return null;
  const [year, month, day] = scheduledDate.split('-').map(Number);
  let anchor: Date;
  if (meta.startTime) {
    const [hour, minute] = meta.startTime.split(':').map(Number);
    anchor = new Date(year, month - 1, day, hour, minute, 0, 0);
  } else {
    anchor = new Date(year, month - 1, day, ALL_DAY_REMINDER_HOUR, 0, 0, 0);
  }
  const fireDate = new Date(anchor.getTime() - meta.reminderMinutesBefore * 60000);
  return fireDate.getTime() > now.getTime() ? fireDate : null;
}

// 'HH:MM' 24h -> "7:50 PM", for display only — mirrors backwardPlanMeta.ts's
// formatClockTime so the two features read consistently.
export function formatClockTime(time: string): string {
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return time;
  const period = h < 12 ? 'AM' : 'PM';
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, '0')} ${period}`;
}

// For the timeline/row label: "3:30 PM" (start only), "3:30 PM – 5:00 PM"
// (both), "All day" (no startTime).
export function formatEventTimeLabel(meta: Pick<EventMeta, 'startTime' | 'endTime'>): string {
  if (!meta.startTime) return 'All day';
  if (!meta.endTime) return formatClockTime(meta.startTime);
  return `${formatClockTime(meta.startTime)} – ${formatClockTime(meta.endTime)}`;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && npm test -- src/utils/eventMeta.test.ts`
Expected: PASS, all 11 tests green.

- [ ] **Step 5: Add `'event'` to `ItemType`**

In `apps/mobile/src/db/types.ts`, line 1, change:

```typescript
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'supplement' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session' | 'skill' | 'backward-plan' | 'potential-attribute';
```

to:

```typescript
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'supplement' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session' | 'skill' | 'backward-plan' | 'potential-attribute' | 'event';
```

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/utils/eventMeta.ts src/utils/eventMeta.test.ts src/db/types.ts
git commit -m "feat: add EventMeta utility and event ItemType

Why: first piece of the Calendar Events feature — a typed metadata shape and
pure helpers (reminder timing, time-label formatting) other tasks build on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Native DB layer — `createEvent`/`getEvent`/`updateEvent`/`deleteEvent` + Inbox destination

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (add event CRUD wrapper near `createBackwardPlan`, ~line 2524; add `'event'` to `GtdDestination`, line 3774-3777; add `case 'event':` to `processInboxItem`, ~line 3820)

**Interfaces:**
- Consumes: `EventMeta`, `parseEventMeta` from `../utils/eventMeta` (Task 1); existing `createItem`, `updateItem`, `updateItemMetadata`, `getItemWithMetadata`, `deleteItem` (already in this file).
- Produces: `createEvent(title: string, date: string, meta?: EventMeta, notes?: string, repeatsYearly?: boolean): string`, `getEvent(eventId: string): Item | null`, `updateEvent(eventId: string, updates: Partial<{title, date, notes, repeatsYearly}>, metaUpdates?: Partial<EventMeta>): void`, `deleteEvent(eventId: string): void` — consumed by Task 4 (`AddEventSheet.tsx`).
- Produces: `GtdDestination` now includes `'event'` — consumed by Task 9 (Inbox classification) and Task 3 (web `processInboxItem`, which will fail to compile without a matching case).

- [ ] **Step 1: Add the import**

In `apps/mobile/src/db/database.ts`, find the existing import of `BackwardPlanMeta`/`parseBackwardPlanMeta` near the top of the file and add a sibling import line directly after it:

```typescript
import { EventMeta, parseEventMeta } from '../utils/eventMeta';
```

- [ ] **Step 2: Add the Calendar Events CRUD block**

Directly after `deleteBackwardPlan` (ends around line 2524), insert:

```typescript
// --- Calendar Events -------------------------------------------------------
// An event is an 'items' row (type='event') — title/scheduledDate/notes use
// the standard item columns, status is always 'scheduled' (events are never
// completable), rrule is 'FREQ=YEARLY' when the user checks "repeats
// yearly", and startTime/endTime/location/reminder/device-calendar-link live
// in metadata as EventMeta (utils/eventMeta.ts). See
// docs/superpowers/specs/2026-08-26-calendar-events-design.md.

export function createEvent(
  title: string,
  date: string,
  meta: EventMeta = {},
  notes?: string,
  repeatsYearly?: boolean,
): string {
  const id = createItem('event', title, 'scheduled', date, notes);
  updateItemMetadata(id, meta as unknown as Record<string, any>);
  if (repeatsYearly) updateItem(id, { rrule: 'FREQ=YEARLY' });
  return id;
}

export function getEvent(eventId: string): Item | null {
  return getItemWithMetadata(eventId);
}

export function updateEvent(
  eventId: string,
  updates: Partial<{ title: string; date: string | null; notes: string | null; repeatsYearly: boolean }>,
  metaUpdates?: Partial<EventMeta>,
): void {
  if (updates.title !== undefined || updates.date !== undefined || updates.notes !== undefined) {
    updateItem(eventId, { title: updates.title, scheduledDate: updates.date, notes: updates.notes });
  }
  if (updates.repeatsYearly !== undefined) {
    updateItem(eventId, { rrule: updates.repeatsYearly ? 'FREQ=YEARLY' : null });
  }
  if (metaUpdates) {
    const current = getItemWithMetadata(eventId);
    const currentMeta = parseEventMeta(current?.metadata);
    updateItemMetadata(eventId, { ...currentMeta, ...metaUpdates });
  }
}

export function deleteEvent(eventId: string): void {
  deleteItem(eventId);
}
```

- [ ] **Step 3: Add `'event'` to `GtdDestination`**

At lines 3774-3777, change:

```typescript
export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication' | 'supplement' | 'object'
  | 'reference' | 'someday' | 'delete';
```

to:

```typescript
export type GtdDestination =
  | 'today' | 'morning' | 'evening'
  | 'project' | 'area' | 'habit' | 'medication' | 'supplement' | 'object'
  | 'reference' | 'someday' | 'delete' | 'event';
```

- [ ] **Step 4: Add the `'event'` branch to `processInboxItem`**

In the `switch (destination)` block inside `processInboxItem` (starts ~line 3793), add a new case right after the existing `case 'habit':` branch (mirrors its exact shape):

```typescript
    case 'event':
      db.runSync(
        'UPDATE items SET type = ?, status = ?, metadata = ?, updatedAt = ? WHERE id = ?',
        ['event', 'scheduled', JSON.stringify({ ...meta, gtdContext: 'event' }), now, id]
      );
      break;
```

- [ ] **Step 5: Manual verification**

This touches SQLite via `expo-sqlite`, which has no Node-runnable test harness in this repo (see Global Constraints). Verify manually once the app is running (can be deferred until Task 4/7 give you a UI path to call `createEvent` from):
1. Run `npx tsc --noEmit` from `apps/mobile/` — expect no new type errors.
2. Once Task 4's `AddEventSheet` exists, create an event from the Calendar screen and confirm it persists across an app reload.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/db/database.ts
git commit -m "feat: add native createEvent/updateEvent/deleteEvent + Inbox event destination

Why: the SQLite-side CRUD wrappers and Inbox classification hook for the new
event item type, mirroring the existing createBackwardPlan pattern.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: Web DB layer — `createEvent`/`getEvent`/`updateEvent`/`deleteEvent` + Inbox destination

**Files:**
- Modify: `apps/mobile/src/db/database.web.ts` (add event CRUD wrapper near `createBackwardPlan`, ~line 1998; add `event:` entry to `processInboxItem`'s `patches` record, ~line 895)

**Interfaces:**
- Consumes: `EventMeta`, `parseEventMeta` from `../utils/eventMeta` (Task 1); `GtdDestination` (now includes `'event'`, Task 2); existing `createItem`, `updateItem` (or web's item-patch helper), `getItemWithMetadata`, `patchItem`/`deleteItem` equivalents already in this file.
- Produces: same four function signatures as Task 2's native versions — consumed by Task 11 (`AddEventForm.web.tsx`).

- [ ] **Step 1: Add the import**

Near the top of `apps/mobile/src/db/database.web.ts`, alongside its existing `BackwardPlanMeta` import, add:

```typescript
import { EventMeta, parseEventMeta } from '../utils/eventMeta';
```

- [ ] **Step 2: Add the Calendar Events CRUD block**

Directly after the web `createBackwardPlan` (lines 1994-1998), insert:

```typescript
// --- Calendar Events -------------------------------------------------------
// See database.ts's matching section for the full design note — this is the
// Firestore-web mirror, same shape as native.

export function createEvent(
  title: string,
  date: string,
  meta: EventMeta = {},
  notes?: string,
  repeatsYearly?: boolean,
): string {
  const id = createItem('event', title, 'scheduled', date, notes);
  updateItemMetadata(id, meta as unknown as Record<string, any>);
  if (repeatsYearly) write(patchItem(id, { rrule: 'FREQ=YEARLY' }), 'createEvent');
  return id;
}

export function getEvent(eventId: string): Item | null {
  return getItemWithMetadata(eventId);
}

export function updateEvent(
  eventId: string,
  updates: Partial<{ title: string; date: string | null; notes: string | null; repeatsYearly: boolean }>,
  metaUpdates?: Partial<EventMeta>,
): void {
  if (updates.title !== undefined || updates.date !== undefined || updates.notes !== undefined) {
    write(
      patchItem(eventId, { title: updates.title, scheduledDate: updates.date, notes: updates.notes, updatedAt: Date.now() }),
      'updateEvent',
    );
  }
  if (updates.repeatsYearly !== undefined) {
    write(patchItem(eventId, { rrule: updates.repeatsYearly ? 'FREQ=YEARLY' : null, updatedAt: Date.now() }), 'updateEvent');
  }
  if (metaUpdates) {
    const current = getItemWithMetadata(eventId);
    const currentMeta = parseEventMeta(current?.metadata);
    updateItemMetadata(eventId, { ...currentMeta, ...metaUpdates });
  }
}

export function deleteEvent(eventId: string): void {
  deleteItem(eventId);
}
```

Note: this mirrors `createBackwardPlan`'s exact web shape (identical to native except writes go through `write(...)`/`patchItem(...)`). If `patchItem`/`write` names differ slightly from what's used elsewhere in the file for updating `rrule`/`title`/`scheduledDate`/`notes` together, match whatever helper `updateItem`'s web equivalent already uses for those same four columns — check the file's existing `updateItem` (or nearest equivalent) implementation before writing this step, and use its exact helper name instead of `patchItem` if different.

- [ ] **Step 3: Add `event:` to `processInboxItem`'s `patches` record**

In the `patches: Record<GtdDestination, ...>` object literal (~lines 886-897), add a new entry alongside `habit:`:

```typescript
    event: { type: 'event', status: 'scheduled', metadata: JSON.stringify({ ...meta, gtdContext: 'event' }) },
```

This is compile-enforced — `Record<GtdDestination, ...>` will fail `tsc` if this entry is missing now that `GtdDestination` includes `'event'` (Task 2, Step 3). Run `npx tsc --noEmit` after this step to confirm the compiler catches an omission before moving on (temporarily remove the line, confirm a type error appears, then put it back) — this doubles as the "test" for this step since there's no runtime harness for this file.

- [ ] **Step 4: Verify the compile-time check works, then verify it's fixed**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected (with the `event:` entry temporarily removed): a type error naming the `patches` object literal, something like `Property 'event' is missing in type ... but required in type 'Record<GtdDestination, ...>'`.

Restore the `event:` line, then run again.
Expected: no error related to `patches`.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/db/database.web.ts
git commit -m "feat: add web createEvent/updateEvent/deleteEvent + Inbox event destination

Why: Firestore-web mirror of Task 2's native DB layer, keeping web/native at
parity for the new event item type from the data layer up.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: `AddEventSheet.tsx` — native create/edit form (core fields)

**Files:**
- Create: `apps/mobile/src/components/AddEventSheet.tsx`

**Interfaces:**
- Consumes: `createEvent`, `updateEvent`, `deleteEvent`, `formatDate` from `../db/database` (Task 2); `EventMeta`, `parseEventMeta` from `../utils/eventMeta` (Task 1); `BottomSheet` from `./ui/BottomSheet`; `LacquerDatePicker`, `LacquerTimePicker` from `./item-composer/SchedulePickers`; `LocationSearchField` from `./LocationSearchField`; `useThemeContext`, `getItemComposerMaterial`, `getThemeColors`, `spacing` from `../theme`.
- Produces: `AddEventSheet` component with props `{ visible: boolean; initialItem?: Item; onClose: () => void; onSaved: (eventId: string) => void; onDeleted?: () => void }` — consumed by Task 6 (Calendar wiring), extended by Task 5 (reminder) and Task 6b (device calendar toggle).

This task builds the core fields only (title, date, all-day toggle, start/end time, location, notes, repeat-yearly checkbox) — the reminder picker and device-calendar toggle are added on top of this same file in Tasks 5 and 6.

- [ ] **Step 1: Write the component**

Create `apps/mobile/src/components/AddEventSheet.tsx`, closely modeled on `apps/mobile/src/components/AnchorEventEditSheet.tsx`:

```typescript
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View, Alert } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { LacquerDatePicker, LacquerTimePicker } from './item-composer/SchedulePickers';
import { LocationSearchField } from './LocationSearchField';
import { createEvent, updateEvent, deleteEvent, formatDate } from '../db/database';
import { parseEventMeta, type EventMeta } from '../utils/eventMeta';
import { Clock, MapPin } from '../icons';
import type { Item } from '../db/types';

interface EventDraft {
  title: string;
  date: string;
  notes: string;
  allDay: boolean;
  meta: EventMeta;
  repeatsYearly: boolean;
}

interface AddEventSheetProps {
  visible: boolean;
  initialItem?: Item;
  initialDate?: string;
  onClose: () => void;
  onSaved: (eventId: string) => void;
  onDeleted?: () => void;
}

function draftFromItem(item: Item): EventDraft {
  const meta = parseEventMeta(item.metadata);
  return {
    title: item.title,
    date: item.scheduledDate ?? formatDate(new Date()),
    notes: item.notes ?? '',
    allDay: !meta.startTime,
    meta,
    repeatsYearly: item.rrule === 'FREQ=YEARLY',
  };
}

function defaultDraft(initialDate?: string): EventDraft {
  return {
    title: '',
    date: initialDate ?? formatDate(new Date()),
    notes: '',
    allDay: false,
    meta: { startTime: '18:00' },
    repeatsYearly: false,
  };
}

// Create/edit a Calendar Event — a fixed-date, optionally-timed item that is
// never completable (no checkbox anywhere in the app for type === 'event').
// See docs/superpowers/specs/2026-08-26-calendar-events-design.md.
export function AddEventSheet({ visible, initialItem, initialDate, onClose, onSaved, onDeleted }: AddEventSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [draft, setDraft] = useState<EventDraft>(defaultDraft(initialDate));
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setDraft(initialItem ? draftFromItem(initialItem) : defaultDraft(initialDate));
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
  }, [visible, initialItem, initialDate]);

  const canSave = Boolean(draft.title.trim()) && (draft.allDay || Boolean(draft.meta.startTime));

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  const handleSave = async () => {
    const title = draft.title.trim();
    if (!title || !canSave) return;
    const meta: EventMeta = draft.allDay
      ? { ...draft.meta, startTime: undefined, endTime: undefined }
      : draft.meta;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (initialItem) {
      updateEvent(
        initialItem.id,
        { title, date: draft.date, notes: draft.notes || null, repeatsYearly: draft.repeatsYearly },
        meta,
      );
      onSaved(initialItem.id);
    } else {
      const id = createEvent(title, draft.date, meta, draft.notes || undefined, draft.repeatsYearly);
      onSaved(id);
    }
    onClose();
  };

  const handleDelete = () => {
    if (!initialItem) return;
    Alert.alert('Delete Event', `Delete "${initialItem.title}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteEvent(initialItem.id);
          onDeleted?.();
          onClose();
        },
      },
    ]);
  };

  const toggleAllDay = () => {
    setDraft((prev) => ({
      ...prev,
      allDay: !prev.allDay,
      meta: prev.allDay ? { ...prev.meta, startTime: prev.meta.startTime ?? '18:00' } : prev.meta,
    }));
  };

  const toggleEndTime = () => {
    setDraft((prev) => ({
      ...prev,
      meta: { ...prev.meta, endTime: prev.meta.endTime ? undefined : addOneHour(prev.meta.startTime ?? '18:00') },
    }));
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={initialItem ? 'Edit Event' : 'New Event'}
      fullHeight
      scrollable
      sheetStyle={{ backgroundColor: material.surface, borderColor: material.rim }}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!canSave}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent, opacity: canSave ? 1 : 0.3 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
      <TextInput
        ref={titleRef}
        style={[styles.titleInput, { color: palette.text }]}
        placeholder="Event title"
        placeholderTextColor={palette.textTertiary}
        value={draft.title}
        onChangeText={(title) => setDraft((prev) => ({ ...prev, title }))}
      />

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DATE</Text>
        <View style={[styles.pickerRow, { borderColor: material.rim }]}>
          <LacquerDatePicker value={draft.date} onChange={(date) => setDraft((prev) => ({ ...prev, date }))} />
        </View>
      </View>

      <View style={[styles.section, styles.rowBetween]}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ALL DAY</Text>
        <Switch value={draft.allDay} onValueChange={toggleAllDay} />
      </View>

      {!draft.allDay && (
        <>
          <View style={styles.section}>
            <View style={styles.labelWithIcon}>
              <Clock size={15} color={material.accent} strokeWidth={2} />
              <Text style={[styles.sectionLabel, { color: material.accent }]}>START TIME</Text>
            </View>
            <View style={[styles.pickerRow, { borderColor: material.rim }]}>
              <LacquerTimePicker
                value={draft.meta.startTime ?? '18:00'}
                onChange={(startTime) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, startTime } }))}
              />
            </View>
          </View>

          {draft.meta.endTime ? (
            <View style={styles.section}>
              <View style={styles.rowBetween}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>END TIME</Text>
                <TouchableOpacity onPress={toggleEndTime} hitSlop={8}>
                  <Text style={[styles.removeText, { color: palette.textTertiary }]}>Remove</Text>
                </TouchableOpacity>
              </View>
              <View style={[styles.pickerRow, { borderColor: material.rim }]}>
                <LacquerTimePicker
                  value={draft.meta.endTime}
                  onChange={(endTime) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, endTime } }))}
                />
              </View>
            </View>
          ) : (
            <TouchableOpacity style={styles.addOptionalRow} onPress={toggleEndTime}>
              <Text style={[styles.addOptionalText, { color: material.accent }]}>+ Add End Time</Text>
            </TouchableOpacity>
          )}
        </>
      )}

      <View style={styles.section}>
        <View style={styles.labelWithIcon}>
          <MapPin size={15} color={palette.textTertiary} strokeWidth={1.8} />
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LOCATION</Text>
        </View>
        <LocationSearchField
          placeholder="Optional"
          value={draft.meta.location ?? ''}
          onChangeText={(location) => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, location } }))}
        />
      </View>

      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>NOTES</Text>
        <TextInput
          style={[styles.fieldInput, styles.notesInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          value={draft.notes}
          onChangeText={(notes) => setDraft((prev) => ({ ...prev, notes }))}
          multiline
        />
      </View>

      <View style={[styles.section, styles.rowBetween]}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>REPEATS YEARLY</Text>
        <Switch
          value={draft.repeatsYearly}
          onValueChange={(repeatsYearly) => setDraft((prev) => ({ ...prev, repeatsYearly }))}
        />
      </View>

      {initialItem && (
        <TouchableOpacity style={styles.deleteRow} onPress={handleDelete}>
          <Text style={[styles.deleteText, { color: palette.red }]}>Delete Event</Text>
        </TouchableOpacity>
      )}
    </BottomSheet>
  );
}

function addOneHour(time: string): string {
  const [h, m] = time.split(':').map(Number);
  const next = (h + 1) % 24;
  return `${String(next).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: spacing[6], gap: 4 },
  actionText: { fontSize: 16, fontFamily: 'Inter_400Regular', fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  titleInput: {
    fontSize: 22,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    letterSpacing: -0.3,
    paddingVertical: 12,
  },
  section: { marginTop: 16, gap: 6 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.4 },
  labelWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  removeText: { fontSize: 13, fontFamily: 'Inter_400Regular' },
  addOptionalRow: { paddingVertical: 8 },
  addOptionalText: { fontSize: 14, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  pickerRow: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 8,
    paddingVertical: 4,
    alignItems: 'flex-start',
  },
  fieldInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  deleteRow: { marginTop: 24, alignItems: 'center', paddingVertical: 12 },
  deleteText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors from `AddEventSheet.tsx` (pre-existing `.web.tsx` module-resolution false alarms elsewhere are expected and unrelated — see `CLAUDE.md`'s note on this).

- [ ] **Step 3: Manual verification**

No wiring exists yet to open this sheet (that's Task 7) — defer visual verification until then. For now, confirm the file compiles standalone.

- [ ] **Step 4: Commit**

```bash
cd apps/mobile && git add src/components/AddEventSheet.tsx
git commit -m "feat: add AddEventSheet native create/edit form

Why: core event fields (title, date, all-day, start/end time, location,
notes, yearly repeat) modeled on AnchorEventEditSheet.tsx's existing pattern.
Not yet wired into the Calendar screen — that's the next task.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 5: Reminder scheduling — wire into `AddEventSheet`

**Files:**
- Modify: `apps/mobile/src/components/AddEventSheet.tsx`

**Interfaces:**
- Consumes: `computeReminderFireDate`, `REMINDER_OPTIONS` from `../utils/eventMeta` (Task 1); `scheduleReminder`, `cancelNotification`, `requestNotificationPermission` from `../hooks/useNotifications`.
- Produces: reminder picker UI + save/delete side effects — no new exports (internal to the sheet).

- [ ] **Step 1: Add the import**

In `apps/mobile/src/components/AddEventSheet.tsx`, add:

```typescript
import { computeReminderFireDate, REMINDER_OPTIONS } from '../utils/eventMeta';
import { scheduleReminder, cancelNotification, requestNotificationPermission } from '../hooks/useNotifications';
```

- [ ] **Step 2: Add the reminder picker UI**

Insert a new section right after the "REPEATS YEARLY" row (before the `{initialItem && ...delete row}` block):

```typescript
      <View style={styles.section}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>REMINDER</Text>
        <View style={styles.reminderRow}>
          <TouchableOpacity
            style={[
              styles.reminderChip,
              {
                backgroundColor: !draft.meta.reminderMinutesBefore ? material.accentSoft : 'transparent',
                borderColor: material.rim,
              },
            ]}
            onPress={() => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, reminderMinutesBefore: undefined } }))}
          >
            <Text style={[styles.reminderChipText, { color: palette.text }]}>None</Text>
          </TouchableOpacity>
          {REMINDER_OPTIONS.map((option) => (
            <TouchableOpacity
              key={option.minutesBefore}
              style={[
                styles.reminderChip,
                {
                  backgroundColor: draft.meta.reminderMinutesBefore === option.minutesBefore ? material.accentSoft : 'transparent',
                  borderColor: material.rim,
                },
              ]}
              onPress={() => setDraft((prev) => ({ ...prev, meta: { ...prev.meta, reminderMinutesBefore: option.minutesBefore } }))}
            >
              <Text style={[styles.reminderChipText, { color: palette.text }]}>{option.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>
```

Add the matching styles to the `StyleSheet.create` block:

```typescript
  reminderRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  reminderChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  reminderChipText: { fontSize: 13, fontFamily: 'Inter_500Medium', fontWeight: '500' },
```

- [ ] **Step 3: Wire reminder scheduling into `handleSave`**

Replace `handleSave`'s body with a version that schedules/cancels the notification around the existing create/update calls:

```typescript
  const handleSave = async () => {
    const title = draft.title.trim();
    if (!title || !canSave) return;
    const meta: EventMeta = draft.allDay
      ? { ...draft.meta, startTime: undefined, endTime: undefined }
      : draft.meta;

    // Cancel any existing reminder before scheduling a new one — an edit
    // that changes the date/time/offset must never leave a stale
    // notification pointing at the old fire time.
    if (initialItem) {
      const previousMeta = parseEventMeta(initialItem.metadata);
      if (previousMeta.reminderNotificationId) {
        await cancelNotification(previousMeta.reminderNotificationId);
      }
    }

    if (meta.reminderMinutesBefore) {
      const fireDate = computeReminderFireDate(draft.date, meta);
      if (fireDate) {
        const granted = await requestNotificationPermission();
        if (granted) {
          const seconds = Math.max(1, Math.round((fireDate.getTime() - Date.now()) / 1000));
          meta.reminderNotificationId = await scheduleReminder(title, 'Event reminder', seconds);
        }
      } else {
        meta.reminderNotificationId = undefined;
      }
    } else {
      meta.reminderNotificationId = undefined;
    }

    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    if (initialItem) {
      updateEvent(
        initialItem.id,
        { title, date: draft.date, notes: draft.notes || null, repeatsYearly: draft.repeatsYearly },
        meta,
      );
      onSaved(initialItem.id);
    } else {
      const id = createEvent(title, draft.date, meta, draft.notes || undefined, draft.repeatsYearly);
      onSaved(id);
    }
    onClose();
  };
```

- [ ] **Step 4: Wire reminder cancellation into `handleDelete`**

Replace `handleDelete`'s `onPress` body:

```typescript
        onPress: async () => {
          const meta = parseEventMeta(initialItem.metadata);
          if (meta.reminderNotificationId) await cancelNotification(meta.reminderNotificationId);
          deleteEvent(initialItem.id);
          onDeleted?.();
          onClose();
        },
```

- [ ] **Step 5: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification (deferred to Task 7)**

Reminder firing requires a real device/simulator with notification permission — verify once Task 7 wires this sheet into the Calendar screen: create an event 2 minutes out with a 15-minute-before reminder set to something already in the past (to confirm it correctly does NOT schedule), then create one further out and confirm `computeReminderFireDate` produces a real future date (add a temporary `console.log` if needed, remove before commit).

- [ ] **Step 7: Commit**

```bash
cd apps/mobile && git add src/components/AddEventSheet.tsx
git commit -m "feat: wire local push reminders into AddEventSheet

Why: reuses the existing (previously uncalled) scheduleReminder/
cancelNotification exports from useNotifications.ts — first real caller of
that infrastructure. Cancels and reschedules on every edit/delete so a
stale notification is never left pointing at an old fire time.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 6: Device calendar write — `deviceCalendar.ts` extension + `AddEventSheet` toggle

**Files:**
- Modify: `apps/mobile/src/services/deviceCalendar.ts`
- Modify: `apps/mobile/src/components/AddEventSheet.tsx`
- Create: `apps/mobile/src/services/deviceCalendar.test.ts`

**Interfaces:**
- Produces (in `deviceCalendar.ts`): `requestCalendarWriteAccess(): Promise<boolean>`, `getCalendarWriteAccessStatus(): Promise<'granted'|'denied'|'undetermined'>`, `buildDeviceCalendarEventInput(title: string, date: string, meta: Pick<EventMeta,'startTime'|'endTime'|'location'|'notes'>): { title: string; startDate: Date; endDate: Date; location?: string; notes?: string }` (pure, tested), `createDeviceCalendarEvent(title: string, date: string, meta: EventMeta, notes?: string): Promise<string | undefined>` — consumed by `AddEventSheet.tsx`.

This is a deliberate, opt-in extension of a file whose every prior export was read-only — see the spec's "Device calendar write" section for why this is safe (one-way, create-only, fails soft).

- [ ] **Step 1: Write the failing test for the pure param-builder**

Create `apps/mobile/src/services/deviceCalendar.test.ts`:

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDeviceCalendarEventInput } from './deviceCalendar.ts';

test('buildDeviceCalendarEventInput builds a timed event with start and end', () => {
  const result = buildDeviceCalendarEventInput('Concert', '2026-09-15', { startTime: '19:00', endTime: '22:00', location: 'The Fillmore' });
  assert.equal(result.title, 'Concert');
  assert.equal(result.startDate.getFullYear(), 2026);
  assert.equal(result.startDate.getMonth(), 8);
  assert.equal(result.startDate.getDate(), 15);
  assert.equal(result.startDate.getHours(), 19);
  assert.equal(result.endDate.getHours(), 22);
  assert.equal(result.location, 'The Fillmore');
});

test('buildDeviceCalendarEventInput defaults a missing end time to one hour after start', () => {
  const result = buildDeviceCalendarEventInput('Appointment', '2026-09-15', { startTime: '15:30' });
  assert.equal(result.startDate.getHours(), 15);
  assert.equal(result.startDate.getMinutes(), 30);
  assert.equal(result.endDate.getHours(), 16);
  assert.equal(result.endDate.getMinutes(), 30);
});

test('buildDeviceCalendarEventInput treats an all-day event as spanning midnight to midnight', () => {
  const result = buildDeviceCalendarEventInput('Birthday', '2026-09-15', {});
  assert.equal(result.startDate.getHours(), 0);
  assert.equal(result.endDate.getDate(), 16);
  assert.equal(result.endDate.getHours(), 0);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `cd apps/mobile && npm test -- src/services/deviceCalendar.test.ts`
Expected: FAIL — `buildDeviceCalendarEventInput` is not exported yet.

- [ ] **Step 3: Extend `deviceCalendar.ts`**

Add to `apps/mobile/src/services/deviceCalendar.ts`, after the existing `getDeviceEventsForDate` function:

```typescript
import type { EventMeta } from '../utils/eventMeta';

// --- Write path (new, opt-in) ----------------------------------------------
// Every export above this line is read-only by design (see file header).
// This section is a deliberate, additive exception scoped to Calendar
// Events only: one-way, create-only writes, never re-read or updated after
// creation — see docs/superpowers/specs/2026-08-26-calendar-events-design.md's
// "Device calendar write" section for the full rationale.

export async function requestCalendarWriteAccess(): Promise<boolean> {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === 'granted';
}

export async function getCalendarWriteAccessStatus(): Promise<'granted' | 'denied' | 'undetermined'> {
  const { status } = await Calendar.getCalendarPermissionsAsync();
  if (status === 'granted') return 'granted';
  if (status === 'undetermined') return 'undetermined';
  return 'denied';
}

// Pure — no device calls — so it's unit-testable without a native module.
export function buildDeviceCalendarEventInput(
  title: string,
  date: string,
  meta: Pick<EventMeta, 'startTime' | 'endTime' | 'location'>,
): { title: string; startDate: Date; endDate: Date; location?: string } {
  const [year, month, day] = date.split('-').map(Number);
  if (!meta.startTime) {
    const startDate = new Date(year, month - 1, day, 0, 0, 0, 0);
    const endDate = new Date(year, month - 1, day + 1, 0, 0, 0, 0);
    return { title, startDate, endDate, location: meta.location };
  }
  const [startHour, startMinute] = meta.startTime.split(':').map(Number);
  const startDate = new Date(year, month - 1, day, startHour, startMinute, 0, 0);
  let endDate: Date;
  if (meta.endTime) {
    const [endHour, endMinute] = meta.endTime.split(':').map(Number);
    endDate = new Date(year, month - 1, day, endHour, endMinute, 0, 0);
  } else {
    endDate = new Date(startDate.getTime() + 60 * 60000);
  }
  return { title, startDate, endDate, location: meta.location };
}

export async function createDeviceCalendarEvent(
  title: string,
  date: string,
  meta: EventMeta,
  notes?: string,
): Promise<string | undefined> {
  const granted = await requestCalendarWriteAccess();
  if (!granted) return undefined;
  try {
    const defaultCalendar = await Calendar.getDefaultCalendarAsync();
    const input = buildDeviceCalendarEventInput(title, date, meta);
    return await Calendar.createEventAsync(defaultCalendar.id, {
      title: input.title,
      startDate: input.startDate,
      endDate: input.endDate,
      location: input.location,
      notes,
      allDay: !meta.startTime,
    });
  } catch {
    // Fail soft — the RKA-side event is still created regardless (see spec).
    return undefined;
  }
}
```

- [ ] **Step 4: Run to verify the pure-function tests pass**

Run: `cd apps/mobile && npm test -- src/services/deviceCalendar.test.ts`
Expected: PASS, all 3 tests green. (`requestCalendarWriteAccess`/`createDeviceCalendarEvent` are not covered by this run — they call the native `expo-calendar` module and are verified manually in Step 7.)

- [ ] **Step 5: Add the device-calendar toggle to `AddEventSheet.tsx`**

Add the import:

```typescript
import { createDeviceCalendarEvent, getCalendarWriteAccessStatus } from '../services/deviceCalendar';
```

Add state for the toggle, defaulted based on prior permission (mirrors spec: "defaulted based on whether write permission was previously granted"):

```typescript
  const [addToDeviceCalendar, setAddToDeviceCalendar] = useState(false);

  useEffect(() => {
    if (!visible || initialItem) return; // only offer on create, not edit — see spec's create-only scope
    getCalendarWriteAccessStatus().then((status) => setAddToDeviceCalendar(status === 'granted'));
  }, [visible, initialItem]);
```

Add the toggle row, right after the "REMINDER" section:

```typescript
      {!initialItem && (
        <View style={[styles.section, styles.rowBetween]}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ALSO ADD TO IPHONE CALENDAR</Text>
          <Switch value={addToDeviceCalendar} onValueChange={setAddToDeviceCalendar} />
        </View>
      )}
```

- [ ] **Step 6: Wire the device-calendar write into `handleSave`**

In `handleSave`, insert this block right before the `if (initialItem) { ... } else { const id = createEvent(...) ...}` branch (only the create branch needs it — per spec, the write is create-only):

```typescript
    if (!initialItem && addToDeviceCalendar) {
      const deviceEventId = await createDeviceCalendarEvent(title, draft.date, meta, draft.notes || undefined);
      if (deviceEventId) meta.deviceCalendarEventId = deviceEventId;
    }
```

- [ ] **Step 7: Manual verification**

On a physical device or simulator with a dev-client build (native modules like `expo-calendar` don't run in Expo Go):
1. Create an event with "Also add to iPhone Calendar" on. Grant the permission prompt. Confirm the event appears in the iOS Calendar app.
2. Edit that same RKA event's title. Confirm the device-side event is unchanged (one-way, create-only — this is the expected, correct behavior).
3. Create an event with the toggle off. Confirm no device-calendar permission prompt appears and no device event is created.
4. Deny the permission prompt once (Settings > re-test), confirm the RKA event still saves successfully.

- [ ] **Step 8: Commit**

```bash
cd apps/mobile && git add src/services/deviceCalendar.ts src/services/deviceCalendar.test.ts src/components/AddEventSheet.tsx
git commit -m "feat: add one-way device calendar write for new events

Why: opt-in, create-only extension to deviceCalendar.ts (previously
read-only by design) — an event created with the toggle on also creates a
matching event in the user's iPhone Calendar app. Edits/deletes never touch
the device-side event afterward; failures fall back soft to the RKA-only
event still saving.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 7: Wire `AddEventSheet` into `CalendarScreen.tsx`

**Files:**
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `AddEventSheet` (Task 6); `useRegisterFabHoldAction` from `../hooks/useFabHoldAction` (existing).

- [ ] **Step 1: Add the import and local state**

Near `CalendarScreen.tsx`'s other imports, add:

```typescript
import { AddEventSheet } from '../components/AddEventSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
```

Inside the `CalendarScreen` component body, near its other `useState` calls (close to where `openCreate`/`refreshAll` are defined, ~line 1240):

```typescript
  const [addEventVisible, setAddEventVisible] = useState(false);
  const [editingEvent, setEditingEvent] = useState<Item | undefined>(undefined);

  const openAddEvent = useCallback(() => {
    setEditingEvent(undefined);
    setAddEventVisible(true);
  }, []);

  const openEditEvent = useCallback((item: Item) => {
    setEditingEvent(item);
    setAddEventVisible(true);
  }, []);

  useRegisterFabHoldAction(useCallback(openAddEvent, [openAddEvent]));
```

- [ ] **Step 2: Add the "Add Event" button next to the existing drawer add button**

At the existing drawer add-button block (lines 1627-1634), add a sibling button directly after it:

```typescript
                <TouchableOpacity
                  onPress={() => setEditingEvent(undefined) || setAddEventVisible(true)}
                  style={[s.drawerAddButton, { backgroundColor: palette.blue }]}
                  accessibilityRole="button"
                  accessibilityLabel="Add event"
                >
                  <CalendarPlus size={18} color="#fff8ef" strokeWidth={2.4} />
                </TouchableOpacity>
```

Add `CalendarPlus` to the existing icon import line at the top of the file (wherever `Plus` is currently imported from — likely `../icons` or `lucide-react-native`, matching the existing `Plus` import's source).

- [ ] **Step 3: Route event taps to `AddEventSheet` instead of the generic editor**

Find the existing `onOpenEdit`/`openEdit` handler (~line 1241 area, called from `TimelineMarker`'s `onEdit` prop). Wrap its body with a type check:

```typescript
  const openEdit = (entry: TimelineEntry) => {
    if (entry.item.type === 'event') {
      openEditEvent(entry.item);
      return;
    }
    // ...existing openEdit body for every other type, unchanged...
  };
```

- [ ] **Step 4: Render the sheet**

Near the end of `CalendarScreen`'s returned JSX, alongside its other modal/sheet renders, add:

```typescript
      <AddEventSheet
        visible={addEventVisible}
        initialItem={editingEvent}
        initialDate={dateStr}
        onClose={() => setAddEventVisible(false)}
        onSaved={() => refreshAll()}
        onDeleted={() => refreshAll()}
      />
```

(`refreshAll` and `dateStr` already exist in this component per the earlier research — `refreshAll` is called from `openCreate`'s `onComplete`, `dateStr` is the selected day's date string used throughout the file.)

- [ ] **Step 5: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 6: Manual verification**

Run the app (`cd apps/mobile && npm start -- --clear`, per `CLAUDE.md`'s Mobile Metro Port guidance — port 8082), open Calendar:
1. Tap the new blue "Add event" drawer button — confirm `AddEventSheet` opens.
2. Create a timed event for today. Confirm it appears somewhere on the Calendar screen (rendering polish is Task 8 — for now just confirm it doesn't crash and the data round-trips).
3. Long-press the dock FAB while on the Calendar tab — confirm it now opens `AddEventSheet` instead of falling through to the assistant overlay.
4. Tap the created event again — confirm it opens `AddEventSheet` in edit mode with the correct field values.

- [ ] **Step 7: Commit**

```bash
cd apps/mobile && git add src/screens/CalendarScreen.tsx
git commit -m "feat: wire AddEventSheet into Calendar screen

Why: adds the entry points from the design spec — a drawer button and the
Calendar tab's FAB long-press (following the same useRegisterFabHoldAction
pattern 8 other screens already use), plus routing taps on an existing event
to AddEventSheet instead of the generic task editor.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 8: Calendar timeline rendering — event icon/accent + all-day header strip

**Files:**
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`

**Interfaces:**
- Consumes: `formatEventTimeLabel` from `../utils/eventMeta` (Task 1).

- [ ] **Step 1: Add an `'event'` entry to `TYPE_OPTIONS`**

At the `TYPE_OPTIONS` array (lines 179-187 area), add:

```typescript
  { value: 'event', label: 'Event', accent: 'purple', icon: 'event' },
```

(Pick an `icon` key not already used by another type — `'event'` — and add its rendering to `renderTypeIcon` in the next step. `accent: 'purple'` reuses an existing `AccentKey`; adjust if `'project'` already owns purple and a visually distinct accent is wanted — check `getAccentColor`'s `AccentKey` union for an unused one first, e.g. `'teal'` or `'pink'` if available, otherwise purple is acceptable since Missions and Events don't appear on the same timeline row type visually (Missions aren't timeline-scheduled items).)

- [ ] **Step 2: Add the `'event'` case to `renderTypeIcon`**

In `renderTypeIcon` (lines 245-263), add a case using a calendar-style icon already imported elsewhere in the file (e.g. the same icon used for `TimelinePreviewSheet`'s calendar glyph, or `CalendarIcon` from `../icons` per `AnchorEventEditSheet.tsx`'s import):

```typescript
    case 'event':
      return <CalendarIcon size={size} color={color} strokeWidth={2} />;
```

Add `CalendarIcon` to the file's existing icon imports if not already present (check the top-of-file import block first — `AnchorEventEditSheet.tsx` imports it as `import { Calendar as CalendarIcon, ... } from '../icons'`, so `CalendarScreen.tsx` likely already imports something similar for its own calendar-related UI; reuse that import rather than adding a duplicate).

- [ ] **Step 3: Add the `'event'` case to `getTimelineLane`**

In `getTimelineLane`'s switch (lines 139-156), add:

```typescript
    case 'event':
      return 'event';
```

(This requires `'event'` to be a valid lane id in `TIMELINE_LANES` — add a matching entry there too, e.g. `{ id: 'event', label: 'Events', accent: 'purple' }`, following the exact shape of the other entries in that array.)

- [ ] **Step 4: Use `formatEventTimeLabel` for the timeline's time label**

In the `TimelineMarker` render block (lines ~1027-1055), the `timeLabel` prop currently reads `formatTimelineTimeRange(entryMinutes, entry.durationMinutes)` for every type. For events specifically, prefer the "All day" label when there's no start time — change:

```typescript
        timeLabel={formatTimelineTimeRange(entryMinutes, entry.durationMinutes)}
```

to:

```typescript
        timeLabel={
          entry.item.type === 'event'
            ? formatEventTimeLabel(parseEventMeta(entry.item.metadata))
            : formatTimelineTimeRange(entryMinutes, entry.durationMinutes)
        }
```

Add the import: `import { formatEventTimeLabel, parseEventMeta } from '../utils/eventMeta';`

- [ ] **Step 5: Add an all-day header strip**

This is genuinely new UI — no "all-day" concept exists anywhere in the current Calendar screen (confirmed by research). Inside `DayTimeline` (starts line 746), before the existing hour-grid `<RNView>` (find where the scrollable hour grid begins, right after `positionedEntries` is computed at line 766), insert a new section that filters all-day events out of the timed grid and renders them as a horizontal strip:

```typescript
  const allDayEntries = entries.filter((entry) => entry.item.type === 'event' && !parseEventMeta(entry.item.metadata).startTime);
  const timedEntries = entries.filter((entry) => !(entry.item.type === 'event' && !parseEventMeta(entry.item.metadata).startTime));
  const positionedEntries = positionTimelineEntries(timedEntries);
```

(This replaces the existing `const positionedEntries = positionTimelineEntries(entries);` line — `entries` is `DayTimeline`'s existing prop holding all of the day's `TimelineEntry[]`.)

Then, in `DayTimeline`'s returned JSX, add the strip immediately above the hour-grid `ScrollView`/container:

```tsx
      {allDayEntries.length > 0 && (
        <View style={s.allDayStrip}>
          {allDayEntries.map((entry) => (
            <TouchableOpacity
              key={entry.item.id}
              style={[s.allDayChip, { backgroundColor: getAccentSoftColor(palette, 'purple'), borderColor: getAccentColor(palette, 'purple') }]}
              onPress={() => onOpenEdit(entry)}
            >
              <Text numberOfLines={1} style={[s.allDayChipText, { color: palette.text }]}>{entry.item.title}</Text>
            </TouchableOpacity>
          ))}
        </View>
      )}
```

Add the matching styles wherever `DayTimeline`'s own `StyleSheet.create` (referenced as `s` in this scope) is defined:

```typescript
  allDayStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, paddingHorizontal: 12, paddingVertical: 8 },
  allDayChip: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 5, maxWidth: 160 },
  allDayChipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
```

`onOpenEdit` must already be reachable inside `DayTimeline`'s scope (it's passed in as a prop per `DayTimelineProps`, lines 728-744 — confirm it's already listed there; if not, add it alongside the file's other timeline callback props and thread it through from the `<DayTimeline onOpenEdit={openEdit} .../>` call site at line 1675/1685).

- [ ] **Step 6: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual verification**

In the running app's Calendar screen:
1. Create a timed event (e.g. 3:30pm). Confirm it renders on the hour grid with a distinct purple accent and calendar icon, showing "3:30 PM" as its time label (not a range, since no end time was set).
2. Create a timed event with both start and end time. Confirm the time label reads "3:30 PM – 5:00 PM".
3. Create an all-day event. Confirm it renders as a chip in the new strip above the hour grid, not on the grid itself.
4. Tap the all-day chip. Confirm it opens `AddEventSheet` in edit mode.

- [ ] **Step 8: Commit**

```bash
cd apps/mobile && git add src/screens/CalendarScreen.tsx
git commit -m "feat: render events distinctly on the Calendar timeline

Why: events get their own icon/accent and an 'All day' / time-range label
instead of the generic task time format, plus a new all-day header strip
above the hour grid — this UI concept didn't exist before this feature.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 9: Inbox classification — add "Event" destination

**Files:**
- Modify: `apps/mobile/src/screens/InboxScreenV2.tsx`

**Interfaces:**
- Consumes: `'event'` `GtdDestination` (Task 2).

- [ ] **Step 1: Add the "Event" option to the Classify-as alert**

In `handleClassify` (lines 112-124), add a new entry to the `Alert.alert` options array, right after `'Mission'`:

```typescript
  Alert.alert('Classify as...', 'This reassigns the entity type, not just when it happens.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Mission', onPress: () => handleBulkProcess('project') },
    { text: 'Event', onPress: () => handleBulkProcess('event') },
    { text: 'Domain', onPress: () => handleBulkProcess('area') },
    { text: 'Habit', onPress: () => handleBulkProcess('habit') },
    { text: 'Medication', onPress: () => handleBulkProcess('medication') },
    { text: 'Supplement', onPress: () => handleBulkProcess('supplement') },
    { text: 'Object', onPress: () => handleBulkProcess('object') },
    { text: 'Reference', onPress: () => handleBulkProcess('reference') },
  ]);
```

Note: classifying an inbox item as `'event'` via this path sets `type: 'event', status: 'scheduled'` (per Task 2's `processInboxItem` case) but leaves `scheduledDate`/`EventMeta` fields unset — the resulting event has no date/time yet. Since `AddEventSheet` requires a title and (for timed events) a start time to save, but this path bypasses that sheet entirely, the classified item needs a follow-up edit. Handle this by opening `AddEventSheet` in edit mode immediately after a successful `'event'` classification:

- [ ] **Step 2: Open `AddEventSheet` immediately after classifying as Event**

This requires `InboxScreenV2.tsx` to render `AddEventSheet` itself. Add the import and local state:

```typescript
import { AddEventSheet } from '../components/AddEventSheet';
import { getEvent } from '../db/database';
```

```typescript
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
```

Change the `'Event'` alert entry from Step 1 to capture the classified item's id (assuming `handleBulkProcess` operates on `selectedIds` already tracked by this screen — check the existing `handleBulkProcess` signature/closure before wiring this; if it processes multiple selected ids at once, only offer this follow-up edit when exactly one item was selected):

```typescript
    {
      text: 'Event',
      onPress: () => {
        const ids = Array.from(selectedIds); // reuse whatever the screen's existing selection state is named
        handleBulkProcess('event');
        if (ids.length === 1) setEditingEventId(ids[0]);
      },
    },
```

Add the sheet render near the screen's other modals:

```typescript
      <AddEventSheet
        visible={editingEventId !== null}
        initialItem={editingEventId ? getEvent(editingEventId) ?? undefined : undefined}
        onClose={() => setEditingEventId(null)}
        onSaved={() => { setEditingEventId(null); refresh(); }}
        onDeleted={() => { setEditingEventId(null); refresh(); }}
      />
```

(`refresh` is whatever this screen already calls after `handleBulkProcess` to reload its item list — match the existing call, don't invent a new name.)

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

In the running app's Inbox: long-press an item, select it, tap the tag/"Classify as..." icon, choose "Event". Confirm `AddEventSheet` opens immediately in edit mode so the date/time can be filled in before the item leaves the Inbox in a half-configured state.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/screens/InboxScreenV2.tsx
git commit -m "feat: add Event as an Inbox classification destination

Why: completes the third entry point from the design spec. Classifying
immediately opens AddEventSheet so the item never sits as an event with no
date/time.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 10: Native Home rendering — include events, no checkbox

**Files:**
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/components/TaskRow.tsx`

**Interfaces:**
- Consumes: `formatEventTimeLabel`, `parseEventMeta` from `../utils/eventMeta` (Task 1).

Per the research findings, native Home's "Today" list (`TodayCard`) is a single flat manually-ordered `DraggableFlatList`, not literal Morning/Afternoon/Evening sections (those exist only on web). "Events show up on Home's Today view" is implemented here as: events appear in the same list tasks do, rendered without a checkbox/complete-toggle.

- [ ] **Step 1: Extend Home's two type filters (Today and Upcoming)**

In `apps/mobile/src/screens/HomeScreen.tsx`, at line 391:

```typescript
const visibleTodayItems = useMemo(
  () => todayItems.filter((item) => item.type === 'task' && item.status !== 'completed' && !pendingActions.has(item.id)),
  [todayItems, pendingActions],
);
```

change to:

```typescript
const visibleTodayItems = useMemo(
  () =>
    todayItems.filter(
      (item) => (item.type === 'task' || item.type === 'event') && item.status !== 'completed' && !pendingActions.has(item.id),
    ),
  [todayItems, pendingActions],
);
```

At line 151 (`upcomingItems`):

```typescript
getUpcomingItems(today).filter((item) => item.type === 'task')
```

change to:

```typescript
getUpcomingItems(today).filter((item) => item.type === 'task' || item.type === 'event')
```

Leave line 157 (`logbookItems`, filtered to completed tasks) **unchanged** — events are never completed, so they should never appear in the Logbook.

- [ ] **Step 2: Make `TaskRow` render events without a checkbox**

In `apps/mobile/src/components/TaskRow.tsx`, the checkbox is `LacquerDiscControl` (line 87-91). Replace it with a type-conditional render that keeps the exact same footprint (critical per the project's own uniform-row-height constraint — see `TaskRow.tsx`'s own comments about drag-library row-offset caching):

```typescript
              {item.type === 'event' ? (
                <View style={styles.eventDot} accessibilityLabel={`Event: ${item.title}`} />
              ) : (
                <LacquerDiscControl
                  isCompleted={isCompleting}
                  accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
                  onToggle={() => onComplete(item)}
                />
              )}
```

Add the import: `import { parseEventMeta, formatEventTimeLabel } from '../utils/eventMeta';`

Add `eventDot` to the `StyleSheet.create` block, sized to match `LacquerDiscControl`'s footprint (check that component's own size — the existing `CHECKBOX_CENTER_X = 32` constant implies a 44pt touch target; match that):

```typescript
  eventDot: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

Also, since `blocker`/dependency logic (`getBlockingTask`) is task-specific, guard it for events:

```typescript
  const blocker = item.type === 'event' ? null : getBlockingTask(item.id);
```

Finally, show the event's time in the existing `metaRow` (so a timed event's row displays "3:30 PM" the way a task shows its project/badges) — inside the `metaRow` block, add:

```typescript
                  {item.type === 'event' && (
                    <Text style={[styles.rowSub, { color: palette.greige }]} numberOfLines={1}>
                      {formatEventTimeLabel(parseEventMeta(item.metadata))}
                    </Text>
                  )}
```

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

In the running app: create an event scheduled for today (via Calendar's Add Event). Navigate to Home. Confirm:
1. The event appears in the Today list alongside tasks.
2. It has no checkbox — instead a plain dot/icon in the same slot — and tapping it does not toggle completion.
3. Its time label ("3:30 PM" or "All day") shows in the row's meta line.
4. The row's height matches every task row exactly (no visual jump/misalignment when dragging to reorder).

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/screens/HomeScreen.tsx src/components/TaskRow.tsx
git commit -m "feat: show events on native Home Today, without a checkbox

Why: events join the same Today/Upcoming lists tasks already populate
(Logbook stays task-only since events never complete); TaskRow swaps the
LacquerDiscControl checkbox for a same-footprint static dot when rendering
an event, preserving the uniform-row-height constraint the drag-reorder
list depends on.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 11: Web Calendar — "Add Event" entry point + `AddEventForm.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/AddEventForm.web.tsx`
- Modify: `apps/mobile/src/webApp/CalendarScreen.web.tsx`

**Interfaces:**
- Consumes: `createEvent`, `updateEvent`, `deleteEvent` from `../db/database` (Task 3); `EventMeta`, `parseEventMeta`, `formatEventTimeLabel` from `../utils/eventMeta` (Task 1); `DetailPanel` pattern already used elsewhere in `webApp/`.
- Produces: `AddEventForm` component, props `{ item: Item; onChanged: () => void; onDeleted: () => void }` — matches the exact prop shape of `MedicationEditForm.web.tsx` so it can be dropped into a `DetailPanel` the same way.

Web has no reminder picker and no device-calendar toggle (native-only per spec) — this form only covers title/date/all-day/start-end time/location/notes/repeat-yearly.

- [ ] **Step 1: Write `AddEventForm.web.tsx`**

Modeled on `apps/mobile/src/webApp/MedicationEditForm.web.tsx`'s onBlur-save pattern (plain `TextInput`s, no native pickers — web has no `LacquerTimePicker` equivalent, so time fields are free-text `HH:MM` inputs, matching `CalendarScreen.web.tsx`'s existing Plan-your-day `HH:MM` text field convention):

```typescript
import { useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, View, Pressable } from 'react-native';
import { updateEvent, deleteEvent } from '../db/database';
import { parseEventMeta, type EventMeta } from '../utils/eventMeta';
import { webColors, webSpacing, webFontSize, webRadius } from '../theme/webTheme';
import type { Item } from '../db/types';

interface AddEventFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

function normalizeTime(value: string): string | undefined {
  const match = value.trim().match(/^([01]?\d|2[0-3]):([0-5]\d)$/);
  if (!match) return undefined;
  return `${match[1].padStart(2, '0')}:${match[2]}`;
}

export function AddEventForm({ item, onChanged, onDeleted }: AddEventFormProps) {
  const meta = parseEventMeta(item.metadata);
  const [title, setTitle] = useState(item.title);
  const [date, setDate] = useState(item.scheduledDate ?? '');
  const [notes, setNotes] = useState(item.notes ?? '');
  const [allDay, setAllDay] = useState(!meta.startTime);
  const [startTime, setStartTime] = useState(meta.startTime ?? '');
  const [endTime, setEndTime] = useState(meta.endTime ?? '');
  const [location, setLocation] = useState(meta.location ?? '');
  const [repeatsYearly, setRepeatsYearly] = useState(item.rrule === 'FREQ=YEARLY');

  const save = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const nextMeta: EventMeta = allDay
      ? { location: location.trim() || undefined }
      : {
          startTime: normalizeTime(startTime),
          endTime: normalizeTime(endTime),
          location: location.trim() || undefined,
        };
    updateEvent(
      item.id,
      { title: trimmedTitle, date: date || null, notes: notes.trim() || null, repeatsYearly },
      nextMeta,
    );
    onChanged();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    deleteEvent(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <TextInput style={styles.titleInput} value={title} onChangeText={setTitle} onBlur={save} />

      <Text style={styles.label}>DATE</Text>
      <TextInput style={styles.input} value={date} onChangeText={setDate} onBlur={save} placeholder="YYYY-MM-DD" />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>ALL DAY</Text>
        <Switch value={allDay} onValueChange={(value) => { setAllDay(value); save(); }} />
      </View>

      {!allDay && (
        <>
          <Text style={styles.label}>START TIME</Text>
          <TextInput style={styles.input} value={startTime} onChangeText={setStartTime} onBlur={save} placeholder="HH:MM" />
          <Text style={styles.label}>END TIME (OPTIONAL)</Text>
          <TextInput style={styles.input} value={endTime} onChangeText={setEndTime} onBlur={save} placeholder="HH:MM" />
        </>
      )}

      <Text style={styles.label}>LOCATION</Text>
      <TextInput style={styles.input} value={location} onChangeText={setLocation} onBlur={save} placeholder="Optional" />

      <Text style={styles.label}>NOTES</Text>
      <TextInput style={[styles.input, styles.notesInput]} value={notes} onChangeText={setNotes} onBlur={save} multiline placeholder="Optional" />

      <View style={styles.rowBetween}>
        <Text style={styles.label}>REPEATS YEARLY</Text>
        <Switch value={repeatsYearly} onValueChange={(value) => { setRepeatsYearly(value); save(); }} />
      </View>

      <Pressable style={styles.deleteRow} onPress={handleDelete}>
        <Text style={styles.deleteText}>Delete Event</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: webSpacing[4], gap: webSpacing[3] },
  titleInput: { fontSize: webFontSize.xl, fontWeight: '600', color: webColors.foreground, paddingVertical: webSpacing[2] },
  label: { fontSize: webFontSize.xs, fontWeight: '700', color: webColors.mutedForeground, letterSpacing: 0.4 },
  input: {
    borderWidth: 1,
    borderColor: webColors.border,
    borderRadius: webRadius.md,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    fontSize: webFontSize.md,
    color: webColors.foreground,
  },
  notesInput: { minHeight: 72, textAlignVertical: 'top' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  deleteRow: { marginTop: webSpacing[4], alignItems: 'center', paddingVertical: webSpacing[3] },
  deleteText: { color: webColors.destructive ?? '#ff3b30', fontWeight: '600' },
});
```

Note: `webColors`/`webSpacing`/`webFontSize`/`webRadius` token names above (`border`, `foreground`, `mutedForeground`, `destructive`, spacing/radius scale indices) must match `apps/mobile/src/theme/webTheme.ts`'s actual exported keys — cross-check against `MedicationEditForm.web.tsx`'s own imports/usage before finalizing, since that file is the confirmed-working reference for exactly these tokens.

- [ ] **Step 2: Add "Add Event" capture to `CalendarScreen.web.tsx`**

The existing `submitCapture` (lines 291-297) hardcodes `type: 'task'`. Add a sibling function and a second button next to the existing capture row, rather than changing `submitCapture`'s behavior (which task capture elsewhere may depend on):

```typescript
import { createEvent } from '../db/database';
import { AddEventForm } from './AddEventForm.web';
```

```typescript
  const submitEventCapture = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    const id = createEvent(trimmed, viewedDate, {});
    setCaptureText('');
    refreshAll();
    setSelectedId(id);
  };
```

In the JSX near the existing capture row (lines ~291-297's surrounding markup), add a button:

```tsx
        <Pressable onPress={submitEventCapture} style={styles.addEventButton} accessibilityLabel="Add event">
          <Text style={styles.addEventButtonText}>+ Event</Text>
        </Pressable>
```

with a matching style entry:

```typescript
  addEventButton: { paddingHorizontal: webSpacing[3], paddingVertical: webSpacing[2], borderRadius: webRadius.md, backgroundColor: webColors.accentSoft ?? webColors.muted },
  addEventButtonText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.accent ?? webColors.foreground },
```

(Match `webColors`' actual exported keys as in Step 1's note.)

- [ ] **Step 3: Route the `DetailPanel` to `AddEventForm` for events**

At the existing `DetailPanel` + `ItemDetailForm` render (lines 518-529), branch on the selected item's type:

```tsx
      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={selectedItem?.type === 'event' ? 'Event' : 'Task'}>
        {selectedItem?.type === 'event' ? (
          <AddEventForm
            item={selectedItem}
            onChanged={() => refreshAll()}
            onDeleted={() => { setSelectedId(null); refreshAll(); }}
          />
        ) : selectedItem ? (
          <ItemDetailForm item={selectedItem} onChanged={refreshAll} onDeleted={() => { setSelectedId(null); refreshAll(); }} />
        ) : null}
      </DetailPanel>
```

(Match whatever the existing `ItemDetailForm` render's exact prop names/callback wiring already are — this step should change only the added `selectedItem?.type === 'event'` branch, not alter the existing `ItemDetailForm` call.)

- [ ] **Step 4: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors (aside from the pre-existing, documented `.web.tsx` module-resolution false alarms — see `CLAUDE.md`).

- [ ] **Step 5: Manual verification**

Run `cd apps/mobile && npm run web`, open Calendar in a browser:
1. Type a title, click "+ Event" — confirm it creates an event (not a task) for the viewed date and opens its `DetailPanel`.
2. Edit the date/time/location/notes fields, confirm each auto-saves on blur (no explicit Save button, matching the rest of web's DetailPanel forms).
3. Toggle "All day" — confirm the start/end time fields hide.
4. Click "Delete Event" — confirm the browser's native confirm dialog appears, then the event is removed.

- [ ] **Step 6: Commit**

```bash
cd apps/mobile && git add src/webApp/AddEventForm.web.tsx src/webApp/CalendarScreen.web.tsx
git commit -m "feat: add web Calendar event creation/edit form

Why: web parity for event creation — a DetailPanel-hosted form modeled on
MedicationEditForm.web.tsx's onBlur-autosave pattern, using plain HH:MM text
fields (web has no LacquerTimePicker equivalent) since native-only pieces
(reminder, device-calendar write) are intentionally omitted here per spec.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 12: Web Home rendering — hide the checkbox for events

**Files:**
- Modify: `apps/mobile/src/webApp/HomeScreen.web.tsx`

**Interfaces:**
- Consumes: `parseEventMeta`, `formatEventTimeLabel` from `../utils/eventMeta` (Task 1).

Per the research findings, `getTodayItems()` on web is already type-agnostic and `useHomeData()` applies no task-only filter — an event scheduled for today already appears in web Home's Morning/Afternoon/Evening/Anytime buckets with zero query changes. This task only needs to stop the checkbox from rendering (and toggling completion) for an event row.

- [ ] **Step 1: Add the import**

```typescript
import { parseEventMeta, formatEventTimeLabel } from '../utils/eventMeta';
```

- [ ] **Step 2: Branch the row's checkbox/press behavior on `item.type`**

The bucket row rendering (lines ~150-165) currently is:

```tsx
                {bucketItems.map((item) => {
                  const completed = item.status === 'completed';
                  return (
                    <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                      <Pressable
                        onPress={(event) => {
                          event.stopPropagation();
                          toggleComplete(item);
                        }}
                        style={[styles.checkbox, completed && styles.checkboxDone]}
                      >
                        {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                      </Pressable>
                      <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                        {item.title}
                      </Text>
                    </Pressable>
                  );
                })}
```

Change to:

```tsx
                {bucketItems.map((item) => {
                  const completed = item.status === 'completed';
                  const isEvent = item.type === 'event';
                  return (
                    <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                      {isEvent ? (
                        <View style={styles.eventDot} />
                      ) : (
                        <Pressable
                          onPress={(event) => {
                            event.stopPropagation();
                            toggleComplete(item);
                          }}
                          style={[styles.checkbox, completed && styles.checkboxDone]}
                        >
                          {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                        </Pressable>
                      )}
                      <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                        {item.title}
                      </Text>
                      {isEvent && (
                        <Text style={styles.eventTime} numberOfLines={1}>
                          {formatEventTimeLabel(parseEventMeta(item.metadata))}
                        </Text>
                      )}
                    </Pressable>
                  );
                })}
```

Add `View` to this file's existing `react-native` import line if not already imported (it already is, per the top-of-file import list quoted in the research — `Pressable, ScrollView, StyleSheet, Text, TextInput, View`).

Add the matching styles to this file's `StyleSheet.create` block, sized to match the existing `checkbox` style's footprint (match whatever `styles.checkbox`'s width/height/borderRadius already are, from the same stylesheet):

```typescript
  eventDot: { width: 18, height: 18, borderRadius: 4, backgroundColor: webColors.accentSoft ?? webColors.muted },
  eventTime: { fontSize: webFontSize.xs, color: webColors.mutedForeground, marginLeft: webSpacing[2] },
```

(Check `styles.checkbox`'s actual width/height in this file first and match `eventDot`'s dimensions to it exactly, the same footprint-preservation reasoning as Task 10's native `eventDot`.)

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Manual verification**

In the running web app: create an event for today via Task 11's Calendar flow, navigate to Home. Confirm it appears in the correct Morning/Afternoon/Evening/Anytime section (based on its `startTime`, via the shared `resolveTimeBucket`/`bucketOf` — no code change needed for this part, per the research), with a small square dot instead of a checkbox, and its time label to the right of the title. Clicking the dot must not toggle completion.

- [ ] **Step 5: Commit**

```bash
cd apps/mobile && git add src/webApp/HomeScreen.web.tsx
git commit -m "feat: render events without a checkbox on web Home

Why: getTodayItems()/useHomeData() were already type-agnostic, so events
appeared in web Home's time buckets automatically — this task only stops
the checkbox from rendering/toggling completion for type === 'event' rows.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 13: `WEB_PARITY.md` update

**Files:**
- Modify: `apps/mobile/WEB_PARITY.md`

- [ ] **Step 1: Add a dated callout paragraph**

Near the top of the file, alongside its other dated callout paragraphs (matching the existing style, e.g. the "Downtime Tasks" one), add:

```markdown
**Calendar Events — new item type, native-only gaps (2026-08-26):** 🟡 A new `event` item type (fixed date, optional start/end time or all-day, optional yearly repeat, never completable) ships on both targets — full create/edit/render parity on Calendar and Home. Two pieces are intentionally native-only: **local push reminders** (web has no local-notification equivalent, so `AddEventForm.web.tsx` omits the reminder picker entirely) and **one-way device-calendar write** (native's "Also add to iPhone Calendar" toggle uses `expo-calendar`, which has no browser equivalent — `deviceCalendar.ts`'s write path stays native-only). See `docs/superpowers/specs/2026-08-26-calendar-events-design.md`.
```

- [ ] **Step 2: Update the `## 1. Top-level destinations` table's Calendar row**

Find the `| Calendar | ✅ | ✅ | 🟡 | ... |` row and append to its Notes cell:

```markdown
Events (new 2026-08-26): both targets create/edit/render; native-only reminder + one-way device-calendar write.
```

- [ ] **Step 3: Commit**

```bash
cd apps/mobile && git add WEB_PARITY.md
git commit -m "docs: record Calendar Events parity in WEB_PARITY.md

Why: repo-wide rule (AGENTS.md/CLAUDE.md) — any feature change on either
target must update WEB_PARITY.md in the same pass.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

## Self-Review Notes

**Spec coverage:** Data model (Tasks 1–3), entry points (Tasks 7 Calendar+FAB, 9 Inbox), reminder (Task 5), device-calendar write (Task 6), rendering on Calendar (Task 8) and Home (Tasks 10, 12), web parity (Tasks 3, 11, 12, 13) — every spec section maps to at least one task.

**Known implementation deviations from the spec's literal wording, both necessary given real codebase architecture discovered during planning (not scope cuts — the user-visible outcomes are preserved):**
- The spec's "AddEventSheet.tsx" is realized as a standalone component (Task 4) rather than routed through the shared item-composer/`CaptureSheet` system, because that system has no per-item-type field extension point today and touching it would risk every other item type's capture flow. `AnchorEventEditSheet.tsx` was already doing exactly this same thing for a different anchor-time item, so this follows an existing precedent, not a new pattern.
- The spec's "FAB gains an Event option next to Task" is realized as a Calendar-screen-registered long-press action (Task 7), because the app's FAB no longer has a Type/Speak/Task chooser (removed in a prior pass — a single tap now always opens the generic capture sheet). Long-press-to-open-a-screen's-own-create-sheet is the actual current idiom, used by 8 other screens.
- The spec's "events slot into Home's Morning/Afternoon/Evening/Anytime buckets" is literal on web (those buckets already exist there) but on native is realized as inclusion in the single flat Today list (Task 10) — native Home has no bucket headers for tasks either today, so this doesn't under-deliver relative to how tasks already work there.

**Type consistency:** `EventMeta`, `parseEventMeta`, `createEvent`/`getEvent`/`updateEvent`/`deleteEvent` signatures are identical across Tasks 1–3 (native/web) and consumed unchanged by Tasks 4–12. `GtdDestination`'s `'event'` addition (Task 2) is consumed by both `processInboxItem` implementations (Tasks 2, 3) and `InboxScreenV2.tsx` (Task 9).

**No placeholders:** every step has complete, runnable code or an explicit manual-verification checklist (used only where the codebase's own testing conventions already stop at "manual verify" — DB writes, native-module calls, RN component rendering).
