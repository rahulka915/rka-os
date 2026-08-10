# Medication Dose History Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the taken/not-taken checkmark grid and flat timestamp list on the Medications screen's HISTORY section with dose-count-aware displays, without adding any medication schedule concept.

**Architecture:** A new pure utility module (`src/utils/medicationDoseHistory.ts`) holds the day-grouping/counting logic so it's unit-testable under the project's plain Node test runner (importing anything from `src/db/database.ts` pulls in `expo-sqlite`, which crashes outside the Expo runtime — confirmed by running `node --experimental-strip-types -e "import('expo-sqlite')"`, which fails with `Cannot find module '.../expo-sqlite/build/SQLiteDatabase'`). `database.ts`'s existing `getMedicationDoseHistory` calls into this pure module instead of computing booleans inline. `MedicationsScreen.tsx`'s `HistoryRow` and `SeeAllHistorySheet` are then updated to render counts and day-grouped sections.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, `expo-sqlite`, Node's built-in test runner (`node --experimental-strip-types --test`, run via `npm test` from `apps/mobile/`).

## Global Constraints

- No new schema field, no changes to `MedicationMeta` or the add/edit medication form (per spec's "Non-goal" section).
- No change to stock/refill tracking (`getStockBreakdown`, "N left of M").
- Compact HISTORY row stays at 5 days (not expanded to 7).
- Dose count = number of `medication-taken` log entries per calendar day, not summed `amount` (split-dose halves each count as 1).
- Follow existing file conventions: `apps/mobile/src/utils/*.test.ts` files start with `// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.` and import from `'./<module>.ts'` (explicit `.ts` extension, per `upcomingGrouping.test.ts`).

---

### Task 1: Pure dose-count/day-grouping utility

**Files:**
- Create: `apps/mobile/src/utils/medicationDoseHistory.ts`
- Test: `apps/mobile/src/utils/medicationDoseHistory.test.ts`

**Interfaces:**
- Produces: `countDosesByDay(timestamps: number[], days: number, now?: number): DoseCountDay[]` where `DoseCountDay = { date: string; count: number }` (`date` is `YYYY-MM-DD`, oldest first, length === `days`).
- Produces: `groupLogsByDay(logs: DoseLogEntry[], now?: number): DoseDayGroup[]` where `DoseLogEntry = { id: string; timestamp: number }` and `DoseDayGroup = { date: string; label: string; count: number; logs: DoseLogEntry[] }`. Input `logs` is assumed sorted most-recent-first (matches `getMedicationLogs`'s `ORDER BY timestamp DESC`); output preserves that ordering both across day groups and within each group's `logs`. `label` is `'Today'`, `'Yesterday'`, or e.g. `'Jul 24'`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/utils/medicationDoseHistory.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { countDosesByDay, groupLogsByDay } from './medicationDoseHistory.ts';

const NOW = new Date('2026-07-26T18:00:00.000Z').getTime();

test('countDosesByDay counts logs per calendar day across the window', () => {
  const timestamps = [
    new Date('2026-07-26T10:00:00.000Z').getTime(),
    new Date('2026-07-26T14:00:00.000Z').getTime(),
    new Date('2026-07-24T09:00:00.000Z').getTime(),
  ];
  const history = countDosesByDay(timestamps, 5, NOW);
  assert.equal(history.length, 5);
  assert.deepEqual(history.map((d) => d.date), ['2026-07-22', '2026-07-23', '2026-07-24', '2026-07-25', '2026-07-26']);
  assert.equal(history.find((d) => d.date === '2026-07-26')?.count, 2);
  assert.equal(history.find((d) => d.date === '2026-07-24')?.count, 1);
  assert.equal(history.find((d) => d.date === '2026-07-25')?.count, 0);
});

test('countDosesByDay returns zero counts when there are no logs', () => {
  const history = countDosesByDay([], 3, NOW);
  assert.deepEqual(history.map((d) => d.count), [0, 0, 0]);
});

test('groupLogsByDay groups logs by calendar day, most recent day first', () => {
  const logs = [
    { id: 'c', timestamp: new Date('2026-07-26T14:00:00.000Z').getTime() },
    { id: 'b', timestamp: new Date('2026-07-26T10:00:00.000Z').getTime() },
    { id: 'a', timestamp: new Date('2026-07-24T09:00:00.000Z').getTime() },
  ];
  const groups = groupLogsByDay(logs, NOW);
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-07-26');
  assert.equal(groups[0].label, 'Today');
  assert.equal(groups[0].count, 2);
  assert.deepEqual(groups[0].logs.map((l) => l.id), ['c', 'b']);
  assert.equal(groups[1].date, '2026-07-24');
  assert.equal(groups[1].label, 'Jul 24');
});

test('groupLogsByDay labels yesterday specially', () => {
  const logs = [{ id: 'a', timestamp: new Date('2026-07-25T09:00:00.000Z').getTime() }];
  const groups = groupLogsByDay(logs, NOW);
  assert.equal(groups[0].label, 'Yesterday');
});

test('groupLogsByDay returns an empty array for no logs', () => {
  assert.deepEqual(groupLogsByDay([], NOW), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npm test -- --test-name-pattern="countDosesByDay|groupLogsByDay"`
Expected: FAIL — `Cannot find module './medicationDoseHistory.ts'` (file doesn't exist yet).

- [ ] **Step 3: Write the implementation**

```typescript
// apps/mobile/src/utils/medicationDoseHistory.ts

function dateKey(date: Date): string {
  return date.toISOString().split('T')[0];
}

export interface DoseCountDay {
  date: string;
  count: number;
}

export function countDosesByDay(timestamps: number[], days: number, now: number = Date.now()): DoseCountDay[] {
  const counts = new Map<string, number>();
  for (const ts of timestamps) {
    const key = dateKey(new Date(ts));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  const history: DoseCountDay[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(d.getDate() - i);
    const date = dateKey(d);
    history.push({ date, count: counts.get(date) ?? 0 });
  }
  return history;
}

export interface DoseLogEntry {
  id: string;
  timestamp: number;
}

export interface DoseDayGroup {
  date: string;
  label: string;
  count: number;
  logs: DoseLogEntry[];
}

function dayLabel(date: string, now: number): string {
  const today = dateKey(new Date(now));
  const yesterday = dateKey(new Date(now - 24 * 60 * 60 * 1000));
  if (date === today) return 'Today';
  if (date === yesterday) return 'Yesterday';
  return new Date(`${date}T00:00:00.000Z`).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

export function groupLogsByDay(logs: DoseLogEntry[], now: number = Date.now()): DoseDayGroup[] {
  const order: string[] = [];
  const byDate = new Map<string, DoseLogEntry[]>();
  for (const log of logs) {
    const date = dateKey(new Date(log.timestamp));
    if (!byDate.has(date)) {
      byDate.set(date, []);
      order.push(date);
    }
    byDate.get(date)!.push(log);
  }
  return order.map((date) => {
    const dayLogs = byDate.get(date)!;
    return { date, label: dayLabel(date, now), count: dayLogs.length, logs: dayLogs };
  });
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: All tests pass, including the 5 new ones above and the pre-existing suite (unaffected — this is a new, self-contained file).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/medicationDoseHistory.ts apps/mobile/src/utils/medicationDoseHistory.test.ts
git commit -m "feat(mobile): add pure dose-count/day-grouping helpers for medication history"
```

---

### Task 2: Wire `countDosesByDay` into `getMedicationDoseHistory`

**Files:**
- Modify: `apps/mobile/src/db/database.ts:770-785`

**Interfaces:**
- Consumes: `countDosesByDay(timestamps: number[], days: number): DoseCountDay[]` from Task 1 (`../utils/medicationDoseHistory`).
- Produces: `getMedicationDoseHistory(itemId: string, days?: number): Array<{ date: string; count: number }>` — return shape changes from `{ date; taken: boolean }` to `{ date; count: number }`. This is a breaking signature change to an exported function; Task 3 updates the only call site (`HistoryRow` in `MedicationsScreen.tsx`).

- [ ] **Step 1: Confirm the only call site (so the signature change is safe to make in this task)**

Run: `cd apps/mobile && grep -rn "getMedicationDoseHistory" src/`
Expected output: two lines — the export in `src/db/database.ts` and the call in `src/screens/MedicationsScreen.tsx` (`HistoryRow`). If any other call site appears, stop and re-scope this task to update it too.

- [ ] **Step 2: Update the import at the top of `database.ts`**

Find (near the top of the file, alongside the other relative imports):
```typescript
import { nextOccurrenceDate, parseRepeatRule, dayMatchesRepeat } from '../utils/repeat';
```

Add directly below it:
```typescript
import { countDosesByDay } from '../utils/medicationDoseHistory';
```

- [ ] **Step 3: Replace the function body**

Find (`apps/mobile/src/db/database.ts:770-785`):
```typescript
// Two-state (taken / not taken) history per calendar day. There's no per-day dose-schedule
// model yet (medications don't carry an rrule), so a third "not scheduled" state can't be
// derived honestly — this only reports what's known: whether a dose was logged that day.
export function getMedicationDoseHistory(itemId: string, days = 7): Array<{ date: string; taken: boolean }> {
  const logs = getMedicationLogs(itemId, days * 3);
  const takenDates = new Set(logs.map(log => formatDate(new Date(log.timestamp))));

  const history: Array<{ date: string; taken: boolean }> = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const date = formatDate(d);
    history.push({ date, taken: takenDates.has(date) });
  }
  return history;
}
```

Replace with:
```typescript
// Per-day dose count over the trailing window. There's no per-day dose-schedule model yet
// (medications don't carry an rrule), so this can't say whether a count is "enough" — it only
// reports what's known: how many times a dose was logged on each calendar day.
export function getMedicationDoseHistory(itemId: string, days = 7): Array<{ date: string; count: number }> {
  const logs = getMedicationLogs(itemId, days * 3);
  return countDosesByDay(logs.map(log => log.timestamp), days);
}
```

- [ ] **Step 4: Verify no other code in `database.ts` still references the removed `taken` field or the local `takenDates` variable**

Run: `cd apps/mobile && grep -n "takenDates\|\.taken\b" src/db/database.ts`
Expected: no output (the old boolean logic and its only usages are gone).

- [ ] **Step 5: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: errors at `src/screens/MedicationsScreen.tsx` where `HistoryRow` destructures `{ date, taken }` from `history` (now `{ date, count }`) — this is expected and fixed in Task 3. No other errors should appear.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/database.ts
git commit -m "feat(mobile): return per-day dose counts from getMedicationDoseHistory"
```

---

### Task 3: Compact HISTORY row shows counts instead of checkmarks

**Files:**
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx:14` (import), `:203-231` (`HistoryRow`), `:723-733` (styles)

**Interfaces:**
- Consumes: `getMedicationDoseHistory(itemId, 5): Array<{ date: string; count: number }>` from Task 2.
- Consumes theme tokens `palette.fill`, `palette.greenSoft`, `palette.green`, `palette.textSecondary` (all already defined in `src/theme/colors.ts` — confirmed present via `grep -n "greenSoft\|green:" src/theme/colors.ts`).

- [ ] **Step 1: Remove the now-unused `Check` icon import**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:14`):
```typescript
import { X, AlertTriangle, Clock, PlayCircle, Check } from '../icons';
```

Replace with:
```typescript
import { X, AlertTriangle, Clock, PlayCircle } from '../icons';
```

- [ ] **Step 2: Update `HistoryRow` to render counts**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:203-231`):
```typescript
function HistoryRow({ item, isDark, onPress }: { item: Item; isDark: boolean; onPress: () => void }) {
  const palette = getThemeColors(isDark);
  const history = getMedicationDoseHistory(item.id, 5);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        s.historyRow,
        isDark
          ? { backgroundColor: palette.fillStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.separatorStrong }
          : null,
      ]}
    >
      <RNText style={[s.historyLabel, { color: palette.text }]} numberOfLines={1}>{item.title}</RNText>
      <RNView style={s.historyDays}>
        {history.map(({ date, taken }) => (
          <RNView
            key={date}
            style={[s.historyDot, { backgroundColor: taken ? palette.green : palette.fill }]}
          >
            {taken && <Check size={10} color="#ffffff" strokeWidth={3} />}
          </RNView>
        ))}
      </RNView>
    </TouchableOpacity>
  );
}
```

Replace with:
```typescript
function HistoryRow({ item, isDark, onPress }: { item: Item; isDark: boolean; onPress: () => void }) {
  const palette = getThemeColors(isDark);
  const history = getMedicationDoseHistory(item.id, 5);

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={onPress}
      style={[
        s.historyRow,
        isDark
          ? { backgroundColor: palette.fillStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.separatorStrong }
          : null,
      ]}
    >
      <RNText style={[s.historyLabel, { color: palette.text }]} numberOfLines={1}>{item.title}</RNText>
      <RNView style={s.historyDays}>
        {history.map(({ date, count }) => {
          const backgroundColor = count === 0 ? palette.fill : count === 1 ? palette.greenSoft : palette.green;
          const textColor = count === 0 ? palette.textSecondary : count === 1 ? palette.green : '#ffffff';
          return (
            <RNView key={date} style={[s.historyDot, { backgroundColor }]}>
              {count > 0 && <RNText style={[s.historyDotText, { color: textColor }]}>{count}</RNText>}
            </RNView>
          );
        })}
      </RNView>
    </TouchableOpacity>
  );
}
```

- [ ] **Step 3: Add the `historyDotText` style**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:727-733`):
```typescript
  historyDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
```

Replace with:
```typescript
  historyDot: {
    width: 20,
    height: 20,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  historyDotText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
```

- [ ] **Step 4: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors referencing `HistoryRow`, `Check`, or `taken` (the Task 2 errors from its Step 5 are now resolved). Errors, if any, must be pre-existing and unrelated — verify by running `git stash` then the same command to compare, then `git stash pop`.

- [ ] **Step 5: Manually verify in the running app**

Run: `cd apps/mobile && npm start -- --clear` (per project convention, port 8082 — see CLAUDE.md), open the dev client, navigate to Medications, log 2 doses of one medication today and 1 dose of another, then check the HISTORY section: the 2-dose medication's today-cell should show "2" on a solid green background; the 1-dose medication's today-cell should show "1" on a light green background; days with no doses should show an empty gray cell.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/screens/MedicationsScreen.tsx
git commit -m "feat(mobile): show dose counts instead of checkmarks in medication history row"
```

---

### Task 4: Group the full history sheet by day

**Files:**
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx:2` (import), `:5` (import), `:418-446` (`SeeAllHistorySheet`), `:734-738` (styles)

**Interfaces:**
- Consumes: `groupLogsByDay(logs: DoseLogEntry[]): DoseDayGroup[]` from Task 1 (`../utils/medicationDoseHistory`). `getMedicationLogs(itemId, 30): ActivityLog[]` (unchanged, from `../db/database`) — `ActivityLog` (`id: string; timestamp: number; ...`) structurally satisfies `DoseLogEntry`.

- [ ] **Step 1: Swap `FlatList` for `SectionList` in the react-native import**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:2`):
```typescript
import { Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, View as RNView, Text as RNText, StyleSheet, TextInput, FlatList, Switch } from 'react-native';
```

Replace with:
```typescript
import { Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, Alert, View as RNView, Text as RNText, StyleSheet, TextInput, SectionList, Switch } from 'react-native';
```

- [ ] **Step 2: Confirm `FlatList` isn't used anywhere else in this file before removing it**

Run: `cd apps/mobile && grep -n "FlatList" src/screens/MedicationsScreen.tsx`
Expected: no output (the only usage was `SeeAllHistorySheet`, updated in Step 4 below). If other usages appear, keep `FlatList` in the import alongside `SectionList` instead of replacing it.

- [ ] **Step 3: Import `groupLogsByDay`**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:5`):
```typescript
import { createMedication, updateMedication, deleteItem, getLastTakenLog, getMedicationDoseHistory, getMedicationLogs, getTotalStock, getStockBreakdown, restockMedication, startTimerFromLoggedDose, getPersistentMedicationTimers, type MedicationMeta } from '../db/database';
```

Add directly below it:
```typescript
import { groupLogsByDay } from '../utils/medicationDoseHistory';
```

- [ ] **Step 4: Update `SeeAllHistorySheet` to render day-grouped sections**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:418-446`):
```typescript
function SeeAllHistorySheet({ visible, item, onClose, isDark }: { visible: boolean; item: Item | null; onClose: () => void; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const logs = item ? getMedicationLogs(item.id, 30) : [];

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNView style={[s.addMedContainer, { backgroundColor: palette.bg }]}>
        <RNView style={s.dragHandle} />
        <RNView style={s.addMedHeader}>
          <RNText style={[s.addMedTitle, { color: palette.text }]}>{item?.title ?? ''} history</RNText>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={16} color={palette.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </RNView>
        <FlatList
          data={logs}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderItem={({ item: log }) => (
            <RNText style={[s.historyLogRow, { color: palette.text, borderBottomColor: palette.separator }]}>
              {new Date(log.timestamp).toLocaleString()}
            </RNText>
          )}
          ListEmptyComponent={<RNText style={{ color: palette.textSecondary, padding: 16 }}>No doses logged yet.</RNText>}
        />
      </RNView>
    </Modal>
  );
}
```

Replace with:
```typescript
function SeeAllHistorySheet({ visible, item, onClose, isDark }: { visible: boolean; item: Item | null; onClose: () => void; isDark: boolean }) {
  const palette = getThemeColors(isDark);
  const logs = item ? getMedicationLogs(item.id, 30) : [];
  const sections = groupLogsByDay(logs).map(group => ({
    title: group.date,
    label: group.label,
    count: group.count,
    data: group.logs,
  }));

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <RNView style={[s.addMedContainer, { backgroundColor: palette.bg }]}>
        <RNView style={s.dragHandle} />
        <RNView style={s.addMedHeader}>
          <RNText style={[s.addMedTitle, { color: palette.text }]}>{item?.title ?? ''} history</RNText>
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <X size={16} color={palette.text} strokeWidth={2.5} />
          </TouchableOpacity>
        </RNView>
        <SectionList
          sections={sections}
          keyExtractor={l => l.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 40 }}
          renderSectionHeader={({ section }) => (
            <RNText style={[s.historyDayHeader, { color: palette.textSecondary, backgroundColor: palette.bg }]}>
              {section.label} · {section.count} {section.count === 1 ? 'dose' : 'doses'}
            </RNText>
          )}
          renderItem={({ item: log }) => (
            <RNText style={[s.historyLogRow, { color: palette.text, borderBottomColor: palette.separator }]}>
              {new Date(log.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </RNText>
          )}
          ListEmptyComponent={<RNText style={{ color: palette.textSecondary, padding: 16 }}>No doses logged yet.</RNText>}
        />
      </RNView>
    </Modal>
  );
}
```

- [ ] **Step 5: Add the `historyDayHeader` style**

Find (`apps/mobile/src/screens/MedicationsScreen.tsx:734-738`):
```typescript
  historyLogRow: {
    fontSize: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
```

Replace with:
```typescript
  historyLogRow: {
    fontSize: 14,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  historyDayHeader: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    paddingTop: 16,
    paddingBottom: 6,
  },
```

- [ ] **Step 6: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors in `MedicationsScreen.tsx`.

- [ ] **Step 7: Manually verify in the running app**

Run: `cd apps/mobile && npm start -- --clear`, open the dev client, navigate to Medications, tap a medication's HISTORY row to open the full sheet. Confirm: a "Today · N doses" header appears above today's dose times, a "Yesterday · N doses" header appears above yesterday's (if any), older days show as "Jul 24"-style headers, and times within a day are listed most-recent-first.

- [ ] **Step 8: Commit**

```bash
git add apps/mobile/src/screens/MedicationsScreen.tsx
git commit -m "feat(mobile): group full medication history sheet by day"
```
