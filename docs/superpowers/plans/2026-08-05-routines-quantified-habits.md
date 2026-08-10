# Routines and Quantified Habits Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add (1) quantified habit measurement (count/duration, target periods, contextual actions) on top of the existing binary habit system, and (2) a first-class `routine` domain — templates of ordered timed steps, played one-at-a-time with a durable, crash/backgrounding-safe live session — without touching Missions/Harada/Potential semantics or double-counting.

**Architecture:** Both features are new `items` rows (`type: 'routine'`, `'routine-step'`, `'routine-session'`) plus JSON `metadata`, following the exact pattern already used by `workout-template`/`workout-block`/`workout-session`. No new SQLite tables — `itemRelations` links steps→routine and session→routine, `activityLogs` records step/session events and quantified habit samples. A session is durable because it's written to SQLite the instant it's created (not buffered in React/AsyncStorage), mirroring `WorkoutSessionScreen`; relaunch recovery is added on top since that gap exists even in the workout precedent. Habit quantification extends `Item.metadata` (measurement type/target/period) and reads manual numeric samples from `activityLogs`, computing period progress on read — no new "current value" column, avoiding stale-state bugs.

**Tech Stack:** React Native + Expo SDK 57, expo-sqlite, existing `BottomSheet`/`LensSurface`/theme token components, `expo-haptics`, React Navigation (`MenuStack`).

## Global Constraints

- No Apple Health / HealthKit packages, permissions, sync, or UI in this implementation — document as future measurement source only.
- Routines are a separate `ItemType`, never `'project'`/`'task'` (Missions) — no Harada/Potential semantics on routines.
- Routine session completion must NOT write to `domainContributions` and must NOT carry `metadata.potentialStat` — only a habit's own maintenance math (via `getItemsByType('habit')` + streak) may feed Potential, per `docs/design/routines-and-habits-product-brief.md:34`.
- Preserve the existing fast single-tap habit completion flow (`HabitsScreen.tsx`'s `LacquerDiscControl` tap-to-complete) as the default action for binary habits — quantified habits get a contextual action (mark done / add one / enter value) but must not add friction to the binary case.
- Completion/logging must remain reversible (undo), consistent with `toggleHabitOccurrence`.
- Follow the existing migration pattern exactly: new columns via `CREATE TABLE IF NOT EXISTS` (for fresh installs) + `ALTER TABLE ... ADD COLUMN` wrapped in try/catch (for existing installs) in `apps/mobile/src/db/database.ts`. No new tables unless explicitly justified below.
- Update `apps/mobile/SCHEMA.md`, `apps/mobile/CLAUDE.md`, `AGENTS.md`, `HANDOVER_SUMMARY.md` in the same turn as any schema/component change, per the multi-agent protocol.
- Styling: StyleSheet + `useThemeContext()`/`getThemeColors` (not Tamagui), matching `HabitsScreen`/`QuickCreateSheet`/`BlockEditSheet` conventions. `expo-haptics` on save/complete actions.
- No new bottom-sheet library — reuse `src/components/ui/BottomSheet.tsx`.

---

## Phase 1: Quantified Habits

### Task 1: Extend habit metadata schema and types

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/utils/habits.ts`
- Test: `apps/mobile/src/utils/__tests__/habits.test.ts` (create if it doesn't exist — check first with `ls apps/mobile/src/utils/__tests__/`)

**Interfaces:**
- Produces: `HabitMeasurement` type, `HabitMeta` interface, `parseHabitMeta(item: Item): HabitMeta`, `computeHabitPeriodProgress(item: Item, samples: ActivityLog[], today: Date): { current: number; target: number; unit?: string; periodLabel: string }`

- [ ] **Step 1: Add types**

In `apps/mobile/src/db/types.ts`, no changes needed to `ItemType`/`Item` (metadata stays a JSON string) — quantified fields live inside the existing `metadata` JSON blob, not as new columns. Confirm this by re-reading the file; do not add new top-level columns for habit measurement.

- [ ] **Step 2: Define `HabitMeta` shape in `apps/mobile/src/utils/habits.ts`**

```typescript
export type HabitIntent = 'build' | 'quit';
export type HabitMeasurement = 'binary' | 'count' | 'duration';
export type HabitTargetPeriod = 'daily' | 'weekly' | 'monthly' | 'custom';

export interface HabitMeta {
  intent: HabitIntent;
  measurement: HabitMeasurement;
  targetValue: number; // ignored for binary
  targetUnit?: string; // e.g. 'reps', 'min', 'glasses' — ignored for binary
  targetPeriod: HabitTargetPeriod;
  customPeriodDays?: number; // only when targetPeriod === 'custom'
  contextualAction: 'mark-done' | 'add-one' | 'enter-value';
  potentialStat?: string;
  potentialTargetDays?: number;
}

const DEFAULT_HABIT_META: HabitMeta = {
  intent: 'build',
  measurement: 'binary',
  targetValue: 1,
  targetPeriod: 'daily',
  contextualAction: 'mark-done',
};

export function parseHabitMeta(item: Item): HabitMeta {
  if (!item.metadata) return DEFAULT_HABIT_META;
  try {
    const parsed = JSON.parse(item.metadata);
    return { ...DEFAULT_HABIT_META, ...parsed };
  } catch {
    return DEFAULT_HABIT_META;
  }
}
```

Binary habits get `measurement: 'binary'` and are unaffected — `DEFAULT_HABIT_META` is exactly today's implicit behavior, so every existing habit item (no metadata, or metadata missing these fields) continues to behave identically.

- [ ] **Step 3: Write the failing test for period-window math**

```typescript
// apps/mobile/src/utils/__tests__/habits.test.ts
import { computeHabitPeriodProgress, parseHabitMeta } from '../habits';
import type { Item, ActivityLog } from '../../db/types';

function makeHabit(metadata: object): Item {
  return {
    id: 'h1', type: 'habit', title: 'Drink water', status: 'active',
    metadata: JSON.stringify(metadata), createdAt: 0, updatedAt: 0,
  };
}

describe('computeHabitPeriodProgress', () => {
  it('sums count samples within the current daily window', () => {
    const item = makeHabit({ measurement: 'count', targetValue: 8, targetUnit: 'glasses', targetPeriod: 'daily' });
    const today = new Date('2026-08-05T12:00:00Z');
    const samples: ActivityLog[] = [
      { id: 's1', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-05T09:00:00Z').getTime(), details: JSON.stringify({ value: 3 }), createdAt: 0 },
      { id: 's2', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-05T10:00:00Z').getTime(), details: JSON.stringify({ value: 2 }), createdAt: 0 },
      { id: 's3', entityId: 'h1', actionType: 'habit-sample', timestamp: new Date('2026-08-04T10:00:00Z').getTime(), details: JSON.stringify({ value: 5 }), createdAt: 0 },
    ];
    const progress = computeHabitPeriodProgress(item, samples, today);
    expect(progress.current).toBe(5);
    expect(progress.target).toBe(8);
  });

  it('defaults binary habits to a 0/1 progress shape', () => {
    const item = makeHabit({});
    const progress = computeHabitPeriodProgress(item, [], new Date('2026-08-05T12:00:00Z'));
    expect(progress.target).toBe(1);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npx jest src/utils/__tests__/habits.test.ts` (check `package.json` for the actual test script name first — likely `npm test` wraps jest; if no Jest config exists yet, check for one before assuming — see Task 1a below)

Expected: FAIL with "computeHabitPeriodProgress is not a function" (or a module-not-found if no test runner is configured yet — resolve that first, see note).

> **Note:** If `apps/mobile` has no test runner configured, check `package.json` `scripts`/`devDependencies` for `jest`/`vitest` before writing tests. If genuinely absent, this task's test step becomes "add a minimal Jest config for `apps/mobile` (jest-expo preset)" as a sub-step — do this once, not per-task.

- [ ] **Step 4: Implement `computeHabitPeriodProgress`**

```typescript
function periodWindow(period: HabitTargetPeriod, customDays: number | undefined, today: Date): { start: number; end: number } {
  const end = new Date(today); end.setHours(23, 59, 59, 999);
  const start = new Date(today); start.setHours(0, 0, 0, 0);
  if (period === 'weekly') start.setDate(start.getDate() - start.getDay());
  else if (period === 'monthly') start.setDate(1);
  else if (period === 'custom') start.setDate(start.getDate() - ((customDays ?? 1) - 1));
  return { start: start.getTime(), end: end.getTime() };
}

export function computeHabitPeriodProgress(item: Item, samples: ActivityLog[], today: Date) {
  const meta = parseHabitMeta(item);
  if (meta.measurement === 'binary') {
    return { current: 0, target: 1, unit: undefined, periodLabel: 'today' };
  }
  const { start, end } = periodWindow(meta.targetPeriod, meta.customPeriodDays, today);
  const current = samples
    .filter((s) => s.entityId === item.id && s.actionType === 'habit-sample' && s.timestamp >= start && s.timestamp <= end)
    .reduce((sum, s) => {
      try { return sum + (JSON.parse(s.details ?? '{}').value ?? 0); } catch { return sum; }
    }, 0);
  return { current, target: meta.targetValue, unit: meta.targetUnit, periodLabel: meta.targetPeriod };
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `cd apps/mobile && npx jest src/utils/__tests__/habits.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/utils/habits.ts apps/mobile/src/utils/__tests__/habits.test.ts
git commit -m "feat(mobile): add quantified habit metadata and period-progress math"
```

---

### Task 2: DB functions for logging and reading habit samples

**Files:**
- Modify: `apps/mobile/src/db/database.ts`

**Interfaces:**
- Consumes: `logActivity(entityId: string, actionType: string, details?: string)` (existing), `parseHabitMeta`/`computeHabitPeriodProgress` from Task 1
- Produces: `logHabitSample(habitId: string, value: number, note?: string): void`, `getHabitSamples(habitId: string, sinceMs?: number): ActivityLog[]`, `undoLastHabitSample(habitId: string): void`

- [ ] **Step 1: Locate the existing habit activity functions**

Read `apps/mobile/src/db/database.ts` around `updateItemStatus`/`toggleHabitOccurrence` (roughly lines 840-905) to match the existing `logActivity` call shape exactly (same `activityLogs` insert helper used elsewhere).

- [ ] **Step 2: Add `logHabitSample`**

```typescript
export function logHabitSample(habitId: string, value: number, note?: string): void {
  logActivity(habitId, 'habit-sample', JSON.stringify({ value, note }));
}

export function getHabitSamples(habitId: string, sinceMs?: number): ActivityLog[] {
  const db = getDb();
  const rows = sinceMs
    ? db.getAllSync<ActivityLog>(
        `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' AND timestamp >= ? ORDER BY timestamp DESC`,
        [habitId, sinceMs]
      )
    : db.getAllSync<ActivityLog>(
        `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' ORDER BY timestamp DESC`,
        [habitId]
      );
  return rows;
}

export function undoLastHabitSample(habitId: string): void {
  const db = getDb();
  const last = db.getFirstSync<ActivityLog>(
    `SELECT * FROM activityLogs WHERE entityId = ? AND actionType = 'habit-sample' ORDER BY timestamp DESC LIMIT 1`,
    [habitId]
  );
  if (last) db.runSync(`DELETE FROM activityLogs WHERE id = ?`, [last.id]);
}
```

Match exact `getDb()`/`db.getAllSync`/`db.runSync` call conventions already used elsewhere in the file — read a neighboring function first and copy its exact style (parameter binding syntax, whether it's `getAllSync<T>(sql, params)` or positional args) rather than trusting this snippet verbatim.

- [ ] **Step 3: Manual verification**

Since DB functions here are thin SQL wrappers over an already-tested table, verify via the app rather than a unit test: run the app (`cd apps/mobile && npm start -- --clear`), and in a scratch screen or via `useDb` temporarily call `logHabitSample`/`getHabitSamples`/`undoLastHabitSample` and confirm rows appear/disappear in `activityLogs` (can inspect via a temporary `console.log` or a SQLite browser). Remove any scratch code before committing.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/db/database.ts
git commit -m "feat(mobile): add habit sample logging/reading/undo DB functions"
```

---

### Task 3: Contextual completion control for quantified habits

**Files:**
- Modify: `apps/mobile/src/screens/HabitsScreen.tsx`
- Create: `apps/mobile/src/components/home/HabitQuantifiedSheet.tsx`

**Interfaces:**
- Consumes: `parseHabitMeta`, `computeHabitPeriodProgress` (Task 1), `logHabitSample`, `undoLastHabitSample` (Task 2)
- Produces: `<HabitQuantifiedSheet visible habit={item} onClose onLogged={(value) => void} />`

- [ ] **Step 1: Read the current tap-to-complete wiring**

Read `apps/mobile/src/screens/HabitsScreen.tsx` `handleCheckIn` (lines ~44-56) and the `LacquerDiscControl` usage to understand the exact completion animation sequence to preserve for binary habits unchanged.

- [ ] **Step 2: Branch the completion action on `meta.contextualAction`**

In `HabitsScreen.tsx`, where each row's tap handler is wired, branch:
```typescript
const meta = parseHabitMeta(row.item);
if (meta.measurement === 'binary') {
  handleCheckIn(row); // unchanged existing binary flow
} else if (meta.contextualAction === 'add-one') {
  logHabitSample(row.item.id, 1);
  refresh(); // existing refresh callback
} else {
  setQuantifiedSheetHabit(row.item); // opens HabitQuantifiedSheet for 'enter-value'
}
```
Binary habits (the overwhelming majority today, and the default) take the exact same code path as before — no behavior change, no added latency.

- [ ] **Step 3: Build `HabitQuantifiedSheet`**

Follow `apps/mobile/src/components/BlockEditSheet.tsx` structure exactly (same `BottomSheet` import, `fieldRow`/`fieldLabel`/`fieldInput` styles, `getThemeColors`/`getItemComposerMaterial`, haptics on save): single numeric `TextInput` pre-filled with `meta.targetValue - progress.current` remaining, a progress line (`"{current}/{target} {unit}"`), Cancel/Log toolbar. On save: `logHabitSample(habit.id, Number(value)); onLogged(); onClose();`.

- [ ] **Step 4: Add undo affordance**

On the habit row, when `progress.current > 0` for the current period, long-press (reuse existing `ContextMenu.tsx`) gains an "Undo last log" item calling `undoLastHabitSample(habit.id)` then `refresh()`.

- [ ] **Step 5: Manual verification via preview**

Start the dev client, create a habit with `measurement: 'count'` via a temporary DB call (or extend the habit creation sheet — see Task 4), tap it, confirm the sheet opens, log a value, confirm the row shows updated progress, undo via long-press, confirm it reverts. Confirm an existing binary habit's tap-to-complete animation is pixel-identical to before (no regression).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/HabitsScreen.tsx apps/mobile/src/components/home/HabitQuantifiedSheet.tsx
git commit -m "feat(mobile): add contextual quantified-habit completion sheet"
```

---

### Task 4: Habit creation/edit — measurement type and target period fields

**Files:**
- Modify: `apps/mobile/src/screens/HabitDetailScreen.tsx` (or wherever habit metadata is currently edited — confirm via the potential-stat chip code at lines ~69-92 found in research)
- Modify: `apps/mobile/src/components/QuickCreateSheet.tsx` only if it needs a post-creation "customize measurement" affordance; otherwise keep creation binary-by-default and push measurement config into the detail screen (progressive disclosure, per brief).

**Interfaces:**
- Consumes: `HabitMeta`, `parseHabitMeta` (Task 1)
- Produces: a saved `item.metadata` containing the full `HabitMeta` shape

- [ ] **Step 1: Keep `QuickCreateSheet` unchanged**

Confirm creation stays a single title field (fast capture, per brief guardrail "existing fast completion flow must remain fast" / "advanced settings belong behind optional rows or sheets"). New habits default to `measurement: 'binary'`.

- [ ] **Step 2: Add a collapsed "Measurement" section to `HabitDetailScreen.tsx`**

Below the existing Potential-stat assignment chips, add a row: `"Binary (done/not done)"` vs expandable options for Count/Duration, each revealing target value/unit/period inputs only when selected (progressive disclosure — same interaction pattern as the existing potential-stat chip picker in that screen). Also add intent (`build`/`quit`) and target-period (`daily`/`weekly`/`monthly`/`custom`) pickers, all collapsed under an "Advanced" disclosure row by default.

- [ ] **Step 3: Wire save to merge into `item.metadata`**

```typescript
const nextMeta: HabitMeta = { ...parseHabitMeta(item), measurement, targetValue, targetUnit, targetPeriod, customPeriodDays, intent, contextualAction };
await updateItemMetadata(item.id, JSON.stringify(nextMeta)); // check exact existing update function name in database.ts, e.g. updateItem or updateItemMetadata
```
Verify the exact update function name by grepping `database.ts` for how the existing potential-stat chip save already persists `metadata` changes — reuse that same function rather than inventing a new one.

- [ ] **Step 4: Manual verification**

In the dev client: open a habit's detail screen, switch it to Count with target 8/day, save, navigate back to `HabitsScreen`, confirm the row now shows quantified progress and opens the sheet from Task 3 on tap.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/screens/HabitDetailScreen.tsx
git commit -m "feat(mobile): expose quantified habit measurement settings behind progressive disclosure"
```

---

### Task 5: Update docs for Phase 1

**Files:**
- Modify: `apps/mobile/SCHEMA.md`
- Modify: `apps/mobile/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `HANDOVER_SUMMARY.md`

- [ ] **Step 1: Document the `HabitMeta` JSON shape in `SCHEMA.md`** in the habit metadata section, including all fields from Task 1 Step 2, and the `habit-sample` `activityLogs` `actionType`/`details` shape from Task 2.
- [ ] **Step 2: Add a one-line pointer in `apps/mobile/CLAUDE.md`** near the existing "Future routines and quantified habits" note, updating it from "not implemented yet" to describe what's now live and link to this plan file.
- [ ] **Step 3: Mirror the same pointer update in `AGENTS.md`** (its parallel "Future routines..." reference, if present — grep to confirm) — keep both docs in sync per the multi-agent protocol.
- [ ] **Step 4: Append a `HANDOVER_SUMMARY.md` entry** with date, files touched, and "quantified habits (count/duration, target periods, contextual logging, undo) shipped; routines still pending (Phase 2)".
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/SCHEMA.md apps/mobile/CLAUDE.md AGENTS.md HANDOVER_SUMMARY.md
git commit -m "docs: record quantified habits schema and phase-1 completion"
```

---

## Phase 2: Core Routines

### Task 6: Routine data model — types, schema, DB functions

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/db/database.ts`
- Test: `apps/mobile/src/db/__tests__/routines.test.ts` (create — mirror whatever test setup Task 1 established, e.g. an in-memory `expo-sqlite` mock or the existing test DB helper if one already exists for `database.ts` tests)

**Interfaces:**
- Produces: `ItemType` gains `'routine' | 'routine-step' | 'routine-session'`; `RoutineStepMeta { order: number; durationSeconds?: number; autoAdvance: boolean; instructions?: string }`; `RoutineSessionMeta { currentStepIndex: number; stepStartedAt: number; elapsedBeforePauseMs: number; status: 'running' | 'paused' }`; DB functions `createRoutine(title, notes?)`, `addRoutineStep(routineId, title, meta: RoutineStepMeta)`, `getRoutineSteps(routineId): Item[]`, `reorderRoutineSteps(routineId, orderedStepIds: string[])`, `startRoutineSession(routineId): string`, `getActiveRoutineSession(routineId?: string): Item | null`, `advanceRoutineSession(sessionId, opts?: { skipped?: boolean }): void`, `pauseRoutineSession(sessionId): void`, `resumeRoutineSession(sessionId): void`, `finishRoutineSession(sessionId): void`

- [ ] **Step 1: Extend `ItemType` in `apps/mobile/src/db/types.ts`**

```typescript
export type ItemType = 'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' | 'workout-block' | 'exercise' | 'workout-session' | 'meal' | 'object' | 'potential-stat' | 'achievement' | 'focus' | 'routine' | 'routine-step' | 'routine-session';
```

- [ ] **Step 2: Add routine DB functions in `database.ts`**, placed near the `workout-template`/`workout-session` functions (~line 1979) since the pattern is identical:

```typescript
export function createRoutine(title: string, notes?: string): string {
  return createItem('routine', title, 'active', undefined, notes);
}

export function addRoutineStep(routineId: string, title: string, meta: RoutineStepMeta): string {
  const stepId = createItem('routine-step', title, 'active', undefined, undefined);
  const db = getDb();
  db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), stepId]);
  setRelation(stepId, 'routine', routineId); // confirm exact setRelation signature by reading its use in workout-block wiring
  return stepId;
}

export function getRoutineSteps(routineId: string): Item[] {
  const db = getDb();
  const rows = db.getAllSync<Item>(
    `SELECT items.* FROM items JOIN itemRelations ON itemRelations.sourceId = items.id
     WHERE itemRelations.relationType = 'routine' AND itemRelations.targetId = ? AND items.deletedAt IS NULL`,
    [routineId]
  );
  return rows.sort((a, b) => {
    const ma = JSON.parse(a.metadata ?? '{}') as RoutineStepMeta;
    const mb = JSON.parse(b.metadata ?? '{}') as RoutineStepMeta;
    return (ma.order ?? 0) - (mb.order ?? 0);
  });
}

export function reorderRoutineSteps(routineId: string, orderedStepIds: string[]): void {
  const db = getDb();
  orderedStepIds.forEach((stepId, index) => {
    const row = db.getFirstSync<Item>(`SELECT * FROM items WHERE id = ?`, [stepId]);
    if (!row) return;
    const meta = { ...(JSON.parse(row.metadata ?? '{}') as RoutineStepMeta), order: index };
    db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), stepId]);
  });
}

export function startRoutineSession(routineId: string): string {
  const routine = db_getItem(routineId); // confirm exact existing single-item getter name, e.g. getItemById
  const sessionId = createItem('routine-session', routine?.title ?? 'Routine', 'active');
  setRelation(sessionId, 'routine-template', routineId);
  const meta: RoutineSessionMeta = { currentStepIndex: 0, stepStartedAt: Date.now(), elapsedBeforePauseMs: 0, status: 'running' };
  const db = getDb();
  db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify(meta), sessionId]);
  return sessionId;
}

export function getActiveRoutineSession(routineId?: string): Item | null {
  const db = getDb();
  const rows = db.getAllSync<Item>(
    `SELECT * FROM items WHERE type = 'routine-session' AND status = 'active' AND deletedAt IS NULL ORDER BY createdAt DESC`
  );
  if (!routineId) return rows[0] ?? null;
  for (const row of rows) {
    const rel = db.getFirstSync(`SELECT * FROM itemRelations WHERE sourceId = ? AND relationType = 'routine-template' AND targetId = ?`, [row.id, routineId]);
    if (rel) return row;
  }
  return null;
}

export function advanceRoutineSession(sessionId: string, opts?: { skipped?: boolean }): void {
  const db = getDb();
  const row = db.getFirstSync<Item>(`SELECT * FROM items WHERE id = ?`, [sessionId]);
  if (!row) return;
  const meta = JSON.parse(row.metadata ?? '{}') as RoutineSessionMeta;
  logActivity(sessionId, opts?.skipped ? 'routine-step-skipped' : 'routine-step-completed', JSON.stringify({ stepIndex: meta.currentStepIndex }));
  const nextMeta: RoutineSessionMeta = { ...meta, currentStepIndex: meta.currentStepIndex + 1, stepStartedAt: Date.now(), elapsedBeforePauseMs: 0 };
  db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify(nextMeta), sessionId]);
}

export function pauseRoutineSession(sessionId: string): void {
  const db = getDb();
  const row = db.getFirstSync<Item>(`SELECT * FROM items WHERE id = ?`, [sessionId]);
  if (!row) return;
  const meta = JSON.parse(row.metadata ?? '{}') as RoutineSessionMeta;
  const elapsed = meta.elapsedBeforePauseMs + (Date.now() - meta.stepStartedAt);
  db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify({ ...meta, status: 'paused', elapsedBeforePauseMs: elapsed }), sessionId]);
}

export function resumeRoutineSession(sessionId: string): void {
  const db = getDb();
  const row = db.getFirstSync<Item>(`SELECT * FROM items WHERE id = ?`, [sessionId]);
  if (!row) return;
  const meta = JSON.parse(row.metadata ?? '{}') as RoutineSessionMeta;
  db.runSync(`UPDATE items SET metadata = ? WHERE id = ?`, [JSON.stringify({ ...meta, status: 'running', stepStartedAt: Date.now() }), sessionId]);
}

export function finishRoutineSession(sessionId: string): void {
  updateItemStatus(sessionId, 'completed'); // does NOT touch domainContributions — no Potential linkage, by design
}
```

Before writing this, grep `database.ts` for `setRelation`, `createItem`, `updateItemStatus`, and the single-item getter to confirm exact signatures — the snippets above are illustrative and must be reconciled with real signatures found in Task 6 Step 1's read-through, not copied blindly.

- [ ] **Step 3: Add the two new columns/tables check**

No new tables — confirm `itemRelations.relationType` accepts arbitrary strings (`'routine'`, `'routine-template'`) without an enum constraint (it's `TEXT NOT NULL`, per schema in research — no CHECK constraint, so this is safe).

- [ ] **Step 4: Write DB-level tests**

```typescript
// apps/mobile/src/db/__tests__/routines.test.ts
import { createRoutine, addRoutineStep, getRoutineSteps, reorderRoutineSteps, startRoutineSession, advanceRoutineSession, finishRoutineSession, getActiveRoutineSession } from '../database';

describe('routine session lifecycle', () => {
  it('creates a routine with ordered steps and advances through them', () => {
    const routineId = createRoutine('Morning Routine');
    addRoutineStep(routineId, 'Stretch', { order: 0, durationSeconds: 60, autoAdvance: true });
    addRoutineStep(routineId, 'Meditate', { order: 1, durationSeconds: 300, autoAdvance: false });
    const steps = getRoutineSteps(routineId);
    expect(steps.map((s) => s.title)).toEqual(['Stretch', 'Meditate']);

    const sessionId = startRoutineSession(routineId);
    const active = getActiveRoutineSession(routineId);
    expect(active?.id).toBe(sessionId);

    advanceRoutineSession(sessionId);
    finishRoutineSession(sessionId);
    expect(getActiveRoutineSession(routineId)).toBeNull();
  });

  it('reorders steps', () => {
    const routineId = createRoutine('Evening Routine');
    const s1 = addRoutineStep(routineId, 'A', { order: 0, autoAdvance: false });
    const s2 = addRoutineStep(routineId, 'B', { order: 1, autoAdvance: false });
    reorderRoutineSteps(routineId, [s2, s1]);
    const steps = getRoutineSteps(routineId);
    expect(steps.map((s) => s.title)).toEqual(['B', 'A']);
  });
});
```

Use whatever DB test setup Task 1/existing tests use (check for a `beforeEach` that resets `expo-sqlite` state or an in-memory DB swap — grep for any existing `database.ts` tests first; if none exist, this may require adding a minimal test-mode DB path, e.g. `:memory:`, gated behind `NODE_ENV==='test'` in `getDb()`).

- [ ] **Step 5: Run tests, verify pass**

Run: `cd apps/mobile && npx jest src/db/__tests__/routines.test.ts`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/types.ts apps/mobile/src/db/database.ts apps/mobile/src/db/__tests__/routines.test.ts
git commit -m "feat(mobile): add routine/routine-step/routine-session data model and lifecycle functions"
```

---

### Task 7: Routine template list + editor screens

**Files:**
- Create: `apps/mobile/src/screens/RoutinesScreen.tsx`
- Create: `apps/mobile/src/screens/RoutineTemplateDetailScreen.tsx`
- Create: `apps/mobile/src/components/RoutineStepEditSheet.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/MenuScreen.tsx` (add a nav tile — confirm exact grid-item pattern by reading the file first)

**Interfaces:**
- Consumes: `createRoutine`, `addRoutineStep`, `getRoutineSteps`, `reorderRoutineSteps` (Task 6)
- Produces: `MenuStack` routes `Routines`, `RoutineTemplateDetail`

- [ ] **Step 1: `RoutinesScreen.tsx`** — copy `HabitsScreen.tsx`'s list-screen skeleton (flat rows, `LensSurface` chrome, capture row using `QuickCreateSheet`-style single-field creation calling `createRoutine(title)`), listing `getItemsByType('routine')`.

- [ ] **Step 2: `RoutineTemplateDetailScreen.tsx`** — shows the routine's steps via `getRoutineSteps`, using the same drag-reorder pattern as `WorkoutTemplateDetailScreen.tsx` (`ReorderableList`, per that file — read it before writing this to match the exact drag-reorder API and the uniform-row-height requirement from the drag-reorder memory: rows must stay a fixed height regardless of list position). Tapping a step opens `RoutineStepEditSheet`. A "Start" button at the bottom calls `startRoutineSession(routineId)` and navigates to `RoutineSession`.

- [ ] **Step 3: `RoutineStepEditSheet.tsx`** — copy `BlockEditSheet.tsx` structure: title, duration (mm:ss input or stepper), auto-advance toggle, instructions notes field. On save calls `addRoutineStep`/an `updateRoutineStep` (add this DB function alongside Task 6's if not yet present, following the same `UPDATE items SET metadata` pattern).

- [ ] **Step 4: Register routes**

In `apps/mobile/src/navigation/MenuStack.tsx`, add `<Stack.Screen name="Routines" component={RoutinesScreen} />` and `<Stack.Screen name="RoutineTemplateDetail" component={RoutineTemplateDetailScreen} />` next to the existing `Habits`/`Workouts`/`WorkoutTemplateDetail` entries (read the file first to match exact `options`/typing conventions, e.g. `RootStackParamList` additions if TypeScript-typed navigation is used).

- [ ] **Step 5: Manual verification**

Run the dev client, navigate Menu → Routines, create a routine, add 2-3 steps with durations, reorder them via drag, confirm order persists after navigating away and back (re-fetch from DB, not just in-memory state).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/RoutinesScreen.tsx apps/mobile/src/screens/RoutineTemplateDetailScreen.tsx apps/mobile/src/components/RoutineStepEditSheet.tsx apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/MenuScreen.tsx
git commit -m "feat(mobile): add routine template list, detail and step editor screens"
```

---

### Task 8: Routine session player with durable, recoverable state

**Files:**
- Create: `apps/mobile/src/screens/RoutineSessionScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/App.tsx` (relaunch-recovery check)

**Interfaces:**
- Consumes: `getRoutineSteps`, `getActiveRoutineSession`, `advanceRoutineSession`, `pauseRoutineSession`, `resumeRoutineSession`, `finishRoutineSession` (Task 6)
- Produces: `RoutineSessionScreen` route `params: { routineId: string }`; on-mount resume logic: `useState(() => getActiveRoutineSession(routineId) ?? startRoutineSession(routineId))` (never creates a duplicate session if one is already active — the key durability property).

- [ ] **Step 1: Build the player screen**

```typescript
// apps/mobile/src/screens/RoutineSessionScreen.tsx (skeleton — fill in per existing WorkoutSessionScreen.tsx styling conventions)
export default function RoutineSessionScreen({ route, navigation }) {
  const { routineId } = route.params;
  const [sessionId] = useState(() => {
    const existing = getActiveRoutineSession(routineId);
    return existing ? existing.id : startRoutineSession(routineId);
  });
  const steps = useMemo(() => getRoutineSteps(routineId), [routineId]);
  const [session, setSession] = useState(() => getItemById(sessionId)); // confirm exact getter name
  const meta: RoutineSessionMeta = JSON.parse(session?.metadata ?? '{}');
  const currentStep = steps[meta.currentStepIndex];

  useEffect(() => {
    if (!currentStep) {
      finishRoutineSession(sessionId);
      navigation.goBack();
    }
  }, [currentStep]);

  // remaining-time ticker: derive from meta.stepStartedAt + meta.elapsedBeforePauseMs, not local-only state,
  // so it's correct immediately after a relaunch (no dependency on how long the screen has been mounted)
  ...
}
```

The critical correctness property: remaining time for the current step must be computed as `currentStep.meta.durationSeconds - (elapsedBeforePauseMs + (status === 'running' ? Date.now() - stepStartedAt : 0)) / 1000`, i.e. always derived from persisted timestamps, never from a `setInterval` counter that resets to the step's full duration on remount. This is what makes backgrounding/relaunch safe.

- [ ] **Step 2: Wire pause/complete/skip/add-time controls**

- Pause → `pauseRoutineSession(sessionId)`; Resume → `resumeRoutineSession(sessionId)`.
- Complete step → `advanceRoutineSession(sessionId)`.
- Skip step → `advanceRoutineSession(sessionId, { skipped: true })`.
- Add time → extend `currentStep`'s effective duration for this session only (store an `extraSeconds` override in the session's `metadata`, not by mutating the step template — a session-local override, e.g. `meta.stepOverrides: Record<number, { extraSeconds: number }>`).
- Auto-advance (`currentStep meta.autoAdvance === true`) → when the derived remaining time hits 0, call `advanceRoutineSession` automatically.

- [ ] **Step 3: Register the route**

Add `<Stack.Screen name="RoutineSession" component={RoutineSessionScreen} />` to `MenuStack.tsx`, following the existing `WorkoutSession` registration exactly (same `options`).

- [ ] **Step 4: Add relaunch recovery**

In `App.tsx`, near where `PersistentTimerBanner`/medication timer recovery is wired (per research, App.tsx ~line 327), add an app-foreground/mount check: `const active = getActiveRoutineSession(); if (active) { /* surface a resumable banner or deep-link into RoutineSession */ }`. At minimum, add a small banner component (can reuse `PersistentTimerBanner`'s shell) that reads "Routine in progress — Resume" and navigates to `RoutineSession` with the session's linked `routineId` (read via the `routine-template` relation) when tapped. This closes the exact gap the research flagged as missing even in the `WorkoutSession` precedent — do not skip it, since "sessions must recover safely after interruption" is an explicit brief requirement.

- [ ] **Step 5: Manual verification (the core acceptance test for this feature)**

In the dev client: start a routine session, background the app (press home / lock screen) mid-step, wait past the step's duration, reopen the app — confirm the step shows 0:00 remaining (or has auto-advanced if `autoAdvance` was on) rather than resetting to full duration. Then force-quit the app entirely mid-session and relaunch — confirm the "Routine in progress" resume banner appears and tapping it returns to the correct step with correct remaining time.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/RoutineSessionScreen.tsx apps/mobile/src/navigation/MenuStack.tsx apps/mobile/App.tsx
git commit -m "feat(mobile): add durable routine session player with backgrounding/relaunch recovery"
```

---

### Task 9: Update docs for Phase 2

**Files:**
- Modify: `apps/mobile/SCHEMA.md`
- Modify: `apps/mobile/CLAUDE.md`
- Modify: `AGENTS.md`
- Modify: `HANDOVER_SUMMARY.md`

- [ ] **Step 1: Document `routine`/`routine-step`/`routine-session` in `SCHEMA.md`** — item type additions, `RoutineStepMeta`/`RoutineSessionMeta` JSON shapes, the `routine`/`routine-template` `itemRelations` types, and the `routine-step-completed`/`routine-step-skipped` `activityLogs` action types. Explicitly state: routine sessions do not write to `domainContributions` and carry no `potential-stat` linkage.
- [ ] **Step 2: Update `apps/mobile/CLAUDE.md`** — add `RoutinesScreen`/`RoutineTemplateDetailScreen`/`RoutineSessionScreen` to the Screens table, `RoutineStepEditSheet` to Components, and the routine DB functions to the Database quick-reference list. Replace the "Future routines and quantified habits" note with a description of what shipped.
- [ ] **Step 3: Mirror in `AGENTS.md`** (its parallel note/current-state bullets).
- [ ] **Step 4: `HANDOVER_SUMMARY.md` entry** — date, files touched, verified test/manual results from Tasks 6-8, explicit callout that Apple Health remains deferred and undone, next steps (reminders, Live Activity — Phase 3, not in this plan).
- [ ] **Step 5: Commit**

```bash
git add apps/mobile/SCHEMA.md apps/mobile/CLAUDE.md AGENTS.md HANDOVER_SUMMARY.md
git commit -m "docs: record routines schema, screens and phase-2 completion"
```

---

## Explicitly out of scope for this plan

- Apple Health / HealthKit (any form) — do not add packages, permissions, sync, or UI.
- Reminders and iOS Live Activity for routine steps — brief's Phase 3, separate future plan.
- Apple Watch, voice guidance, location triggers, generated routine suggestions, ambient audio.
- Weekly/monthly habit history visualizations beyond what Task 3/4 already surface as period progress — a dedicated review screen is future work, not blocking Phase 1/2 correctness.
