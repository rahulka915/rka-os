# Logbook (Completed Items View) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Logbook" tab to the mobile Tasks screen that shows every completed item grouped by completion day, with tap-to-restore.

**Architecture:** Add a `completedAt` column to the `items` SQLite table, stamp it in `updateItemStatus()`, expose it via a new `useCompletedItems()` hook, group results by day with a pure utility function, and render a second tab inside `TasksScreen.tsx` using the existing row/section visual patterns.

**Tech Stack:** React Native (Expo SDK 54), expo-sqlite, existing `LacquerDiscControl` component, `node --test` for pure-logic unit tests (matches `src/domain/medicationTimer/timerMath.test.ts` pattern).

## Global Constraints

- No new dependencies — build the segmented control from existing `TouchableOpacity`/`StyleSheet` primitives, matching `apps/mobile/CLAUDE.md`'s "Styling Strategy" (StyleSheet + theme-aware colors, no Tamagui for this screen since `TasksScreen.tsx` already uses plain RN primitives).
- Reuse `palette` tokens from `getThemeColors(isDark)` for all new colors — no hardcoded hex outside the theme file.
- `expo-sqlite` runs on a native binding unavailable under plain `node --test`, so DB-layer and hook changes are verified via `npx tsc --noEmit` plus manual run in the Expo dev client, not automated tests. Only the pure day-grouping function gets a `node --test` unit test.
- Spec source: `docs/superpowers/specs/2026-07-15-logbook-completed-items-design.md`.

---

### Task 1: Add `completedAt` column and stamp it on status change

**Files:**
- Modify: `apps/mobile/src/db/types.ts` (Item interface)
- Modify: `apps/mobile/src/db/database.ts:18-83` (`initSchema`), `:995-998` (`updateItemStatus`)

**Interfaces:**
- Produces: `Item.completedAt?: number` field; `updateItemStatus(id: string, status: Item['status']): void` now also writes `completedAt` (unchanged signature, callers need no changes).

- [ ] **Step 1: Add `completedAt` to the `Item` interface**

In `apps/mobile/src/db/types.ts`, add the field alongside the existing optional timestamp fields:

```typescript
export interface Item {
  id: string;
  type: ItemType;
  title: string;
  status: ItemStatus;
  notes?: string;
  voice_transcript?: string; // Original voice transcript before editing
  scheduledDate?: string; // YYYY-MM-DD
  dueDate?: string;       // YYYY-MM-DD
  rrule?: string;
  metadata?: string;      // JSON string in SQLite
  createdAt: number;
  updatedAt: number;
  userId?: string;
  archivedAt?: number;
  deletedAt?: number;
  completedAt?: number;
}
```

- [ ] **Step 2: Add a guarded `ALTER TABLE` migration in `initSchema`**

In `apps/mobile/src/db/database.ts`, the `items` table is created with `CREATE TABLE IF NOT EXISTS`, which does not add columns to an already-existing table on-device. Add a guarded `ALTER TABLE` right after the `db.execSync(...)` block in `initSchema` (after line 82's closing `` ` ``, before the function's closing `}`):

```typescript
function initSchema() {
  db.execSync(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL,
      notes TEXT,
      voice_transcript TEXT,
      scheduledDate TEXT,
      dueDate TEXT,
      rrule TEXT,
      metadata TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL,
      userId TEXT,
      archivedAt INTEGER,
      deletedAt INTEGER
    );

    CREATE TABLE IF NOT EXISTS itemInstances (
      id TEXT PRIMARY KEY,
      itemId TEXT NOT NULL,
      scheduledDate TEXT NOT NULL,
      completedAt INTEGER,
      status TEXT NOT NULL,
      instanceMetadata TEXT,
      createdAt INTEGER NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS activityLogs (
      id TEXT PRIMARY KEY,
      entityId TEXT NOT NULL,
      actionType TEXT NOT NULL,
      timestamp INTEGER NOT NULL,
      details TEXT,
      createdAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS appSettings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL,
      updatedAt INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS itemRelations (
      id TEXT PRIMARY KEY,
      sourceId TEXT NOT NULL,
      targetId TEXT NOT NULL,
      relationType TEXT NOT NULL,
      createdAt INTEGER NOT NULL,
      UNIQUE(sourceId, relationType)
    );

    CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
    CREATE INDEX IF NOT EXISTS idx_items_scheduledDate ON items(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_scheduledDate ON itemInstances(scheduledDate);
    CREATE INDEX IF NOT EXISTS idx_instances_itemId ON itemInstances(itemId);
    CREATE INDEX IF NOT EXISTS idx_relations_target ON itemRelations(targetId, relationType);
  `);

  try {
    db.execSync(`ALTER TABLE items ADD COLUMN completedAt INTEGER`);
  } catch {
    // Column already exists on this device's DB — safe to ignore.
  }
}
```

- [ ] **Step 3: Stamp `completedAt` inside `updateItemStatus`**

Replace the current implementation at `apps/mobile/src/db/database.ts:995-998`:

```typescript
export function updateItemStatus(id: string, status: Item['status']): void {
  const now = Date.now();
  getDb().runSync(
    `UPDATE items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?`,
    [status, status === 'completed' ? now : null, now, id]
  );
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}
```

This always recomputes `completedAt` from the new status: non-null only while `status === 'completed'`, cleared (`null`) for every other status — including restore-to-active.

- [ ] **Step 4: Add `getCompletedItems()` query**

Add this function near `getItemsByStatus` (around `apps/mobile/src/db/database.ts:112-117`):

```typescript
export function getCompletedItems(): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE status = 'completed' AND deletedAt IS NULL ORDER BY COALESCE(completedAt, updatedAt) DESC`
  );
}
```

`COALESCE(completedAt, updatedAt)` keeps items completed before this migration (which have `completedAt IS NULL`) sorted correctly using their last-known `updatedAt`.

- [ ] **Step 5: Verify with typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/db/types.ts apps/mobile/src/db/database.ts
git commit -m "feat(mobile): add completedAt tracking to items

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 2: Day-grouping utility (TDD)

**Files:**
- Create: `apps/mobile/src/utils/completedGrouping.ts`
- Create: `apps/mobile/src/utils/completedGrouping.test.ts`

**Interfaces:**
- Consumes: `Item` type from `apps/mobile/src/db/types.ts` (only needs `id`, `title`, `completedAt`, `updatedAt` — takes a minimal shape so the test file doesn't need a full DB `Item`).
- Produces: `groupCompletedByDay<T extends { completedAt?: number; updatedAt: number }>(items: T[], now?: Date): { label: string; items: T[] }[]` — used by Task 4's Logbook rendering.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/utils/completedGrouping.test.ts`:

```typescript
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupCompletedByDay } from './completedGrouping';

const DAY_MS = 24 * 60 * 60 * 1000;

function itemAt(id: string, timestamp: number) {
  return { id, title: id, completedAt: timestamp, updatedAt: timestamp };
}

test('groups items completed today under TODAY', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', now.getTime() - 60_000)];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'TODAY');
  assert.deepEqual(groups[0].items, items);
});

test('groups items completed yesterday under YESTERDAY', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', now.getTime() - DAY_MS)];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'YESTERDAY');
});

test('groups older items under a month-day label', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [itemAt('a', new Date('2026-07-12T09:00:00Z').getTime())];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups.length, 1);
  assert.equal(groups[0].label, 'JULY 12');
});

test('preserves descending order and splits multiple days into separate groups', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [
    itemAt('today', now.getTime() - 60_000),
    itemAt('yesterday', now.getTime() - DAY_MS),
    itemAt('older', new Date('2026-07-01T09:00:00Z').getTime()),
  ];
  const groups = groupCompletedByDay(items, now);
  assert.deepEqual(groups.map(g => g.label), ['TODAY', 'YESTERDAY', 'JULY 1']);
  assert.deepEqual(groups.map(g => g.items[0].id), ['today', 'yesterday', 'older']);
});

test('falls back to updatedAt when completedAt is missing', () => {
  const now = new Date('2026-07-15T18:00:00Z');
  const items = [{ id: 'legacy', title: 'legacy', updatedAt: now.getTime() - 60_000 }];
  const groups = groupCompletedByDay(items, now);
  assert.equal(groups[0].label, 'TODAY');
});

test('returns no groups for an empty list', () => {
  assert.deepEqual(groupCompletedByDay([]), []);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/completedGrouping.test.ts`
Expected: FAIL — `Cannot find module './completedGrouping'` (or similar), since the module doesn't exist yet.

- [ ] **Step 3: Implement `groupCompletedByDay`**

Create `apps/mobile/src/utils/completedGrouping.ts`:

```typescript
const MONTH_NAMES = [
  'JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE',
  'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER',
];

function startOfDay(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime();
}

function dayLabel(timestamp: number, todayStart: number): string {
  const itemStart = startOfDay(new Date(timestamp));
  const dayMs = 24 * 60 * 60 * 1000;
  const diffDays = Math.round((todayStart - itemStart) / dayMs);

  if (diffDays === 0) return 'TODAY';
  if (diffDays === 1) return 'YESTERDAY';

  const date = new Date(timestamp);
  return `${MONTH_NAMES[date.getMonth()]} ${date.getDate()}`;
}

export interface CompletedGroup<T> {
  label: string;
  items: T[];
}

export function groupCompletedByDay<T extends { completedAt?: number; updatedAt: number }>(
  items: T[],
  now: Date = new Date(),
): CompletedGroup<T>[] {
  if (items.length === 0) return [];

  const todayStart = startOfDay(now);
  const groups: CompletedGroup<T>[] = [];

  for (const item of items) {
    const timestamp = item.completedAt ?? item.updatedAt;
    const label = dayLabel(timestamp, todayStart);
    const lastGroup = groups[groups.length - 1];

    if (lastGroup && lastGroup.label === label) {
      lastGroup.items.push(item);
    } else {
      groups.push({ label, items: [item] });
    }
  }

  return groups;
}
```

This assumes the input `items` array is already sorted descending by completion time (which `getCompletedItems()` from Task 1 guarantees) — it only groups adjacent same-day runs, it does not sort.

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/completedGrouping.test.ts`
Expected: PASS, 6 tests passing, 0 failing.

- [ ] **Step 5: Run the full test suite to check for regressions**

Run: `cd apps/mobile && npm test`
Expected: all tests pass (existing `timerMath.test.ts` plus the new file).

- [ ] **Step 6: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/utils/completedGrouping.ts apps/mobile/src/utils/completedGrouping.test.ts
git commit -m "feat(mobile): add day-grouping utility for completed items

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 3: `useCompletedItems` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts` (near `useTasks`, `apps/mobile/src/hooks/useDb.ts:177-184`)

**Interfaces:**
- Consumes: `getCompletedItems()` from Task 1 (`apps/mobile/src/db/database.ts`).
- Produces: `useCompletedItems(): { items: Item[]; refresh: () => void }` — used by Task 4's `TasksScreen.tsx`.

- [ ] **Step 1: Check the existing imports in `useDb.ts`**

Run: `grep -n "^import" apps/mobile/src/hooks/useDb.ts`
Confirm `getCompletedItems` needs to be added to the existing `from '../db/database'` import (it will already import `getItemsByType`, `getTodayItems`, etc. from the same module — add `getCompletedItems` to that same import list rather than adding a new import line).

- [ ] **Step 2: Add the hook**

In `apps/mobile/src/hooks/useDb.ts`, immediately after `useTasks` (after line 184's closing `}`), add:

```typescript
export function useCompletedItems() {
  const [items, setItems] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setItems(getCompletedItems());
  }, []);
  useEffect(() => { refresh(); }, [refresh]);
  return { items, refresh };
}
```

(Matches the exact shape of `useTasks` immediately above it — same `useState`/`useCallback`/`useEffect` pattern already imported at the top of the file.)

- [ ] **Step 3: Verify with typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/hooks/useDb.ts
git commit -m "feat(mobile): add useCompletedItems hook

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```

---

### Task 4: Logbook tab in TasksScreen

**Files:**
- Modify: `apps/mobile/src/screens/TasksScreen.tsx` (entire file — adds a tab state, a segmented control, and a Logbook render branch)

**Interfaces:**
- Consumes: `useCompletedItems()` from Task 3, `groupCompletedByDay()` from Task 2, `updateItemStatus` (already imported), `palette` (already imported via `getThemeColors`).

- [ ] **Step 1: Read the current full file to confirm line numbers before editing**

Run: `cat -n apps/mobile/src/screens/TasksScreen.tsx`

Use the output to confirm exact current line numbers match this plan's references (the file was last read in full during design and is reproduced in the diff below; if line numbers have shifted, apply the same edits by content match instead of line number).

- [ ] **Step 2: Add imports and tab state**

At the top of `apps/mobile/src/screens/TasksScreen.tsx`, change:

```typescript
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTasks, useProjects } from '../hooks/useDb';
import { deleteItem, updateItemStatus, setRelation, getRelation } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import type { Item } from '../db/types';
```

to:

```typescript
import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTasks, useProjects, useCompletedItems } from '../hooks/useDb';
import { deleteItem, updateItemStatus, setRelation, getRelation } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import { groupCompletedByDay } from '../utils/completedGrouping';
import type { Item } from '../db/types';

type TasksTab = 'tasks' | 'logbook';
```

- [ ] **Step 3: Add tab state and the completed-items hook inside the component**

Change the top of the `TasksScreen` component body from:

```typescript
export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
```

to:

```typescript
export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { items: completedItems, refresh: refreshCompleted } = useCompletedItems();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');
```

- [ ] **Step 4: Add a `handleRestore` function next to `handleComplete`**

After the existing `handleComplete` function (currently `apps/mobile/src/screens/TasksScreen.tsx:77-89`), add:

```typescript
  const handleRestore = (item: Item) => {
    if (restoringIds.has(item.id)) return;
    setRestoringIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'active');
      refresh();
      refreshCompleted();
      setRestoringIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };
```

Also update `handleComplete` to refresh the Logbook list too, since a newly-completed item should be visible there without needing a manual tab switch-away-and-back:

```typescript
  const handleComplete = (item: Item) => {
    if (completingIds.has(item.id)) return;
    setCompletingIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'completed');
      refresh();
      refreshCompleted();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };
```

- [ ] **Step 5: Add a `renderCompletedRow` function next to `renderRow`**

After the existing `renderRow` function (currently `apps/mobile/src/screens/TasksScreen.tsx:91-107`), add:

```typescript
  const renderCompletedRow = (item: Item) => {
    const projectTitle = getProjectTitle(item);
    return (
      <View
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
      >
        <LacquerDiscControl
          isCompleted={!restoringIds.has(item.id)}
          accessibilityLabel={`Restore ${item.title}`}
          onToggle={() => handleRestore(item)}
        />
        <View style={styles.rowContent}>
          <Text
            style={[styles.rowTitle, styles.rowTitleCompleted, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {projectTitle && (
            <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>{projectTitle}</Text>
          )}
        </View>
      </View>
    );
  };
```

This mirrors `renderRow` but: the disc always starts filled (`isCompleted={!restoringIds.has(item.id)}` — true at rest, flips to false to play the un-fill animation when tapped), title gets the strikethrough style, and there's no `TouchableOpacity`/long-press wrapper since Logbook rows don't need the project-reassignment or delete context menu from the spec's "Out of scope" list.

- [ ] **Step 6: Add the segmented control and swap the render based on `activeTab`**

Replace the `return (...)` block at the end of the component (currently `apps/mobile/src/screens/TasksScreen.tsx:117-137`) from:

```typescript
  return (
    <LensSurface title="Tasks">
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap the + in the dock to create one</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {active.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ACTIVE</Text>
              <View style={styles.sectionRows}>{active.map(renderRow)}</View>
            </View>
          )}
          {someday.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>SOMEDAY</Text>
              <View style={styles.sectionRows}>{someday.map(renderRow)}</View>
            </View>
          )}
        </ScrollView>
      )}
    </LensSurface>
  );
}
```

to:

```typescript
  const completedGroups = groupCompletedByDay(completedItems);

  return (
    <LensSurface title="Tasks">
      <View style={[styles.segmentedControl, { backgroundColor: palette.fill }]}>
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'tasks' && { backgroundColor: palette.surface },
          ]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'tasks' ? palette.text : palette.textSecondary }]}>
            Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'logbook' && { backgroundColor: palette.surface },
          ]}
          onPress={() => setActiveTab('logbook')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'logbook' ? palette.text : palette.textSecondary }]}>
            Logbook
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tasks' ? (
        tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap the + in the dock to create one</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ACTIVE</Text>
                <View style={styles.sectionRows}>{active.map(renderRow)}</View>
              </View>
            )}
            {someday.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>SOMEDAY</Text>
                <View style={styles.sectionRows}>{someday.map(renderRow)}</View>
              </View>
            )}
          </ScrollView>
        )
      ) : completedGroups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing completed yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {completedGroups.map((group) => (
            <View key={group.label} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              <View style={styles.sectionRows}>{group.items.map(renderCompletedRow)}</View>
            </View>
          ))}
        </ScrollView>
      )}
    </LensSurface>
  );
}
```

- [ ] **Step 7: Add the new styles**

In the `StyleSheet.create({...})` block at the bottom of the file, add these entries (alongside the existing `listContent`, `section`, etc.):

```typescript
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
  },
```

- [ ] **Step 8: Verify with typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 9: Manual verification in the Expo dev client**

Per `apps/mobile/CLAUDE.md` Quick Reference, start the dev client:

```bash
cd apps/mobile
npx expo start --dev-client --port 8082
```

On the device:
1. Open Tasks tab — confirm "Tasks" / "Logbook" segmented control renders above the existing ACTIVE/SOMEDAY sections, "Tasks" segment selected by default.
2. Complete a task (tap its disc or swipe) — confirm it disappears from ACTIVE.
3. Switch to "Logbook" — confirm the just-completed task appears under a "TODAY" header, title struck through, disc shown filled.
4. Tap the disc on that Logbook row — confirm it plays the un-fill animation and disappears from the Logbook.
5. Switch back to "Tasks" — confirm the restored item is back under ACTIVE.
6. With zero completed items (fresh state or after restoring everything), confirm the Logbook tab shows "Nothing completed yet".
7. Toggle dark/light mode (if a manual toggle exists per `useThemeContext`) — confirm segmented control and struck-through text use theme-appropriate colors in both.

Report the outcome of each numbered check.

- [ ] **Step 10: Commit**

```bash
cd "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os"
git add apps/mobile/src/screens/TasksScreen.tsx
git commit -m "feat(mobile): add Logbook tab with restore to Tasks screen

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>"
```
