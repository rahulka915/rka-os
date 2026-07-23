# Things 3 Parity: Deadlines, Repeat, Checklists, Upcoming — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four remaining Things 3 functional gaps in `apps/mobile` — deadlines, repeating tasks, checklists, and an Upcoming view.

**Architecture:** Four independent features, each shippable on its own. All business logic goes in pure, unit-tested utils under `src/utils/` (Node test runner, no Expo imports); `src/db/database.ts` and the composer consume those utils. Two of the four reuse infrastructure that already exists but was never surfaced: `items.dueDate` and `items.rrule` are already columns, and `parseRepeatRule`/`dayMatchesRepeat` already implement recurrence matching — they are currently private to `database.ts`.

**Tech Stack:** React Native + Expo SDK 57, expo-sqlite, TypeScript, `node:test` (not Jest — see Global Constraints).

## Global Constraints

- **Row height must never depend on list position.** Any badge/indicator added to a task row must be derived from that item's own fields only. `react-native-draggable-flatlist` caches per-cell `measureLayout` heights and translates rows by the dragged cell's height; a height that changes with order corrupts rendering (rows vanish/overlap). Deadline badges and checklist counts are item-local, so they are safe — do not gate them on neighbours/index. See `src/hooks/useHapticReorder.ts` header comment.
- **Tests run with Node's test runner, not Jest.** Command: `npm test` (`node --experimental-strip-types --test src/**/*.test.ts`). Every test file starts with `// @ts-nocheck` and imports source with an explicit `.ts` extension. Jest is present but its suites fail to collect — ignore it.
- **Typecheck command:** `npx tsc --noEmit` from `apps/mobile/`. Must be clean before every commit.
- **Dependency installs** (none required by this plan) must use `npm install --legacy-peer-deps`.
- **Dates are `YYYY-MM-DD` strings** produced by `formatDate()` in `database.ts` (`date.toISOString().split('T')[0]`, UTC-based). Never pass `Date` objects across these boundaries.
- **Commit messages:** conventional prefix (`feat:`, `fix:`, `refactor:`, `test:`), focused on WHY, ending with:
  `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`
- Do not run the dev server; Metro is already running on port 8082 and hot-reloads.
- **`updateItem` clears columns with `null`, not `undefined`.** Its `updates` parameter was widened (2026-07-23) so `notes`/`scheduledDate`/`dueDate`/`rrule` accept `string | null`. Every field is gated on `!== undefined`, so passing `undefined` leaves the column untouched while `null` writes SQL NULL. Always pass `?? null` when a field may need clearing — this is already reflected in Tasks A3 and B3.

---

# Feature A — Deadlines

`items.dueDate` already exists as a column and `updateItem()` already accepts it. Only the logic, UI, and wiring are missing.

### Task A1: Deadline status util

**Files:**
- Create: `apps/mobile/src/utils/deadline.ts`
- Test: `apps/mobile/src/utils/deadline.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `deadlineStatus(dueDate: string | null | undefined, today: string): DeadlineStatus | null`, `type DeadlineTone = 'overdue' | 'today' | 'soon' | 'future'`, `interface DeadlineStatus { label: string; tone: DeadlineTone }`, `daysBetween(from: string, to: string): number`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/deadline.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { deadlineStatus, daysBetween } from './deadline.ts';

test('returns null when there is no deadline', () => {
  assert.equal(deadlineStatus(undefined, '2026-07-23'), null);
  assert.equal(deadlineStatus(null, '2026-07-23'), null);
});

test('flags a past deadline as overdue', () => {
  assert.deepEqual(deadlineStatus('2026-07-22', '2026-07-23'), { label: '1 day overdue', tone: 'overdue' });
  assert.deepEqual(deadlineStatus('2026-07-20', '2026-07-23'), { label: '3 days overdue', tone: 'overdue' });
});

test('flags today and tomorrow distinctly', () => {
  assert.deepEqual(deadlineStatus('2026-07-23', '2026-07-23'), { label: 'Due today', tone: 'today' });
  assert.deepEqual(deadlineStatus('2026-07-24', '2026-07-23'), { label: 'Due tomorrow', tone: 'soon' });
});

test('counts down within a week, then shows a date', () => {
  assert.deepEqual(deadlineStatus('2026-07-27', '2026-07-23'), { label: 'Due in 4 days', tone: 'soon' });
  assert.deepEqual(deadlineStatus('2026-08-12', '2026-07-23'), { label: 'Due 12 Aug', tone: 'future' });
});

test('daysBetween spans month boundaries', () => {
  assert.equal(daysBetween('2026-07-30', '2026-08-02'), 3);
  assert.equal(daysBetween('2026-08-02', '2026-07-30'), -3);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — cannot resolve `./deadline.ts`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/deadline.ts`:

```ts
export type DeadlineTone = 'overdue' | 'today' | 'soon' | 'future';

export interface DeadlineStatus {
  label: string;
  tone: DeadlineTone;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

// Whole-day difference between two YYYY-MM-DD strings. Parsed as UTC midnight
// so the result is pure calendar arithmetic, never shifted by the device zone.
export function daysBetween(from: string, to: string): number {
  const ms = Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`);
  return Math.round(ms / 86_400_000);
}

function formatShortDate(date: string): string {
  const [, month, day] = date.split('-').map(Number);
  return `${day} ${MONTHS[month - 1]}`;
}

// How a task's deadline should read on a row. `today` is injected rather than
// read from the clock so this stays pure and testable.
export function deadlineStatus(dueDate: string | null | undefined, today: string): DeadlineStatus | null {
  if (!dueDate) return null;
  const days = daysBetween(today, dueDate);
  if (days < 0) {
    const overdueBy = -days;
    return { label: `${overdueBy} day${overdueBy === 1 ? '' : 's'} overdue`, tone: 'overdue' };
  }
  if (days === 0) return { label: 'Due today', tone: 'today' };
  if (days === 1) return { label: 'Due tomorrow', tone: 'soon' };
  if (days <= 7) return { label: `Due in ${days} days`, tone: 'soon' };
  return { label: `Due ${formatShortDate(dueDate)}`, tone: 'future' };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: all `deadline.test.ts` assertions pass (`fail 0`).

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/utils/deadline.ts src/utils/deadline.test.ts
git commit -m "feat(mobile): add deadline status util

Deadlines were a schema-only field with no way to read them.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A2: Deadline badge on task rows

**Files:**
- Create: `apps/mobile/src/components/DeadlineBadge.tsx`
- Modify: `apps/mobile/src/screens/TasksScreen.tsx`, `apps/mobile/src/screens/ProjectDetailScreen.tsx`

**Interfaces:**
- Consumes: `deadlineStatus` from Task A1; `formatDate` from `../db/database`.
- Produces: `<DeadlineBadge isDark={boolean} dueDate={string} />`.

- [ ] **Step 1: Create the badge component**

Create `apps/mobile/src/components/DeadlineBadge.tsx` (mirrors `BlockedBadge.tsx`):

```tsx
import { View, Text, StyleSheet } from 'react-native';
import { Flag } from '../icons';
import { getThemeColors } from '../theme';
import { formatDate } from '../db/database';
import { deadlineStatus } from '../utils/deadline';

interface DeadlineBadgeProps {
  isDark: boolean;
  dueDate: string;
}

// Deadline indicator for a task row. Derived only from the item's own dueDate,
// so a row's height never depends on its position in the list (required by
// drag-to-reorder — see useHapticReorder).
export function DeadlineBadge({ isDark, dueDate }: DeadlineBadgeProps) {
  const palette = getThemeColors(isDark);
  const status = deadlineStatus(dueDate, formatDate(new Date()));
  if (!status) return null;

  const color = status.tone === 'overdue' || status.tone === 'today' ? palette.red : palette.textTertiary;

  return (
    <View style={styles.row}>
      <Flag size={11} color={color} strokeWidth={2} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>{status.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  text: {
    fontSize: 12,
    fontWeight: '500',
    flexShrink: 1,
  },
});
```

- [ ] **Step 2: Render it on Tasks rows**

In `apps/mobile/src/screens/TasksScreen.tsx`, add the import next to the `BlockedBadge` import:

```ts
import { DeadlineBadge } from '../components/DeadlineBadge';
```

Then inside `makeRenderRow`, immediately after the existing blocked-badge line:

```tsx
              {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
```

add:

```tsx
              {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
```

- [ ] **Step 3: Render it on Project detail rows**

In `apps/mobile/src/screens/ProjectDetailScreen.tsx`, add the same import, then after its existing line:

```tsx
              {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
```

add:

```tsx
              {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/components/DeadlineBadge.tsx src/screens/TasksScreen.tsx src/screens/ProjectDetailScreen.tsx
git commit -m "feat(mobile): show deadline badge on task rows

Makes the dueDate field visible; item-local so drag-reorder heights stay stable.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task A3: Deadline picker in the item editor

**Files:**
- Modify: `apps/mobile/src/components/item-composer/types.ts`, `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`

**Interfaces:**
- Consumes: `ItemDraft` from `types.ts`; `LacquerDatePicker` from `./SchedulePickers`.
- Produces: `ItemDraft.dueDate?: string` — read by Task D1's Upcoming query.

- [ ] **Step 1: Add `dueDate` to the draft type**

In `apps/mobile/src/components/item-composer/types.ts`, inside `ItemDraft`, add after the `scheduledTime?: string;` line:

```ts
  dueDate?: string;
```

- [ ] **Step 2: Load and save it**

In `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`:

In `createDraft`'s returned object, after `scheduledTime: ...`, add:

```ts
    dueDate: undefined,
```

In `createEditDraft`'s returned object, after its `scheduledTime: ...` line, add:

```ts
    dueDate: item.dueDate ?? undefined,
```

In `saveItemDraft`, the edit branch currently reads:

```ts
  } else if (itemId) {
    updateItem(itemId, { type: draft.itemType, title, notes });
```

Change that `updateItem` call to include the deadline:

```ts
  } else if (itemId) {
    updateItem(itemId, { type: draft.itemType, title, notes, dueDate: draft.dueDate ?? null });
```

And in the create branch, after the `itemId = ...` assignment block closes and before `if (!itemId) throw`, add:

```ts
  if (draft.mode === 'create' && itemId && draft.dueDate) {
    updateItem(itemId, { dueDate: draft.dueDate });
  }
```

- [ ] **Step 3: Add the DEADLINE section and picker view**

In `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`:

Extend the view union on line 30:

```ts
type EditorView = 'form' | 'projects' | 'tags' | 'date' | 'time' | 'deadline';
```

Add a picker branch — directly after the existing `view === 'time'` branch closes (`) : view === 'projects' ? (`), insert a new branch before it so the chain reads:

```tsx
          ) : view === 'deadline' && draft.dueDate ? (
            <ScrollView style={styles.flex} showsVerticalScrollIndicator={false}>
              <LacquerDatePicker
                value={draft.dueDate}
                onChange={(dueDate) => onChange({ dueDate })}
              />
            </ScrollView>
          ) : view === 'projects' ? (
```

Then add the form section. Find the `WHEN` section and insert this complete section immediately after that section's closing `</View>`:

```tsx
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>DEADLINE</Text>
                <View style={styles.choiceRow}>
                  <TouchableOpacity
                    style={[
                      styles.choiceChip,
                      { backgroundColor: draft.dueDate ? material.accentSoft : material.fill, borderColor: draft.dueDate ? material.rimStrong : material.rim },
                    ]}
                    onPress={() => {
                      if (draft.dueDate) { showView('deadline'); return; }
                      const today = new Date();
                      onChange({ dueDate: today.toISOString().split('T')[0] });
                      showView('deadline');
                    }}
                  >
                    <Text style={[styles.choiceText, { color: draft.dueDate ? material.accent : palette.textSecondary }]}>
                      {draft.dueDate ? `Due ${draft.dueDate}` : 'Set deadline'}
                    </Text>
                  </TouchableOpacity>
                  {draft.dueDate && (
                    <TouchableOpacity
                      style={[styles.choiceChip, { backgroundColor: material.fill, borderColor: material.rim, flexGrow: 0, paddingHorizontal: 16 }]}
                      onPress={() => onChange({ dueDate: undefined })}
                    >
                      <Text style={[styles.choiceText, { color: palette.textSecondary }]}>Clear</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
```

- [ ] **Step 4: Update the header title for the new view**

In the same file, the `headerTitle` chain (around line 139) ends with a fallback. Add a `deadline` case by changing the `view === 'date'` line so the chain includes:

```tsx
        : view === 'deadline'
          ? 'Deadline'
```

Place it immediately before the existing `: view === 'date'` branch, keeping the ternary chain syntactically valid (verify with the typecheck in Step 5).

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/components/item-composer/
git commit -m "feat(mobile): add deadline picker to item editor

Exposes the dueDate schema field so deadlines can actually be set.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 6: Verify on device**

Open a task → set a deadline → save → confirm the badge appears on the Tasks row and reads "Due today"/"Due in N days". Report the result; do not mark Feature A done without this check.

---

# Feature B — Repeating tasks

`parseRepeatRule` and `dayMatchesRepeat` already exist as **private** functions in `database.ts` (around lines 381–421). Task B1 moves them into a pure, testable util without changing their semantics.

### Task B1: Extract repeat logic into a tested util

**Files:**
- Create: `apps/mobile/src/utils/repeat.ts`, `apps/mobile/src/utils/repeat.test.ts`
- Modify: `apps/mobile/src/db/database.ts` (remove the private copies, import instead)

**Interfaces:**
- Produces: `parseRepeatRule(rrule?: string | null): RepeatRule | null`, `dayMatchesRepeat(rule: RepeatRule, date: string, startDate?: string): boolean`, `nextOccurrenceDate(rrule: string | null | undefined, fromDate: string, startDate?: string): string | null`, `addDays(date: string, n: number): string`, `type RepeatRule`.

- [ ] **Step 1: Check who currently uses the private helpers**

Run: `cd apps/mobile && grep -n "dayMatchesRepeat\|parseRepeatRule\|parseDayCode" src/db/database.ts`
Record every call site — each must still compile after the move.

- [ ] **Step 2: Write the failing test**

Create `apps/mobile/src/utils/repeat.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseRepeatRule, dayMatchesRepeat, nextOccurrenceDate, addDays } from './repeat.ts';

test('parses the supported rule spellings', () => {
  assert.equal(parseRepeatRule('FREQ=DAILY'), 'DAILY');
  assert.equal(parseRepeatRule('daily'), 'DAILY');
  assert.equal(parseRepeatRule('FREQ=WEEKDAYS'), 'WEEKDAYS');
  assert.equal(parseRepeatRule('FREQ=WEEKLY;BYDAY=MO'), 'WEEKLY:1');
  assert.equal(parseRepeatRule(null), null);
  assert.equal(parseRepeatRule('nonsense'), null);
});

test('addDays does pure calendar arithmetic across months', () => {
  assert.equal(addDays('2026-07-31', 1), '2026-08-01');
  assert.equal(addDays('2026-08-01', -1), '2026-07-31');
});

test('weekdays rule matches Mon-Fri only', () => {
  // 2026-07-23 is a Thursday, 2026-07-25 a Saturday.
  assert.equal(dayMatchesRepeat('WEEKDAYS', '2026-07-23'), true);
  assert.equal(dayMatchesRepeat('WEEKDAYS', '2026-07-25'), false);
  assert.equal(dayMatchesRepeat('WEEKEND', '2026-07-25'), true);
});

test('nextOccurrenceDate always returns a date strictly after fromDate', () => {
  assert.equal(nextOccurrenceDate('FREQ=DAILY', '2026-07-23'), '2026-07-24');
  // Thursday + weekdays rule -> Friday; Friday -> Monday.
  assert.equal(nextOccurrenceDate('FREQ=WEEKDAYS', '2026-07-23'), '2026-07-24');
  assert.equal(nextOccurrenceDate('FREQ=WEEKDAYS', '2026-07-24'), '2026-07-27');
});

test('nextOccurrenceDate returns null without a usable rule', () => {
  assert.equal(nextOccurrenceDate(null, '2026-07-23'), null);
  assert.equal(nextOccurrenceDate('nonsense', '2026-07-23'), null);
});
```

- [ ] **Step 3: Run the test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — cannot resolve `./repeat.ts`.

- [ ] **Step 4: Create the util**

Create `apps/mobile/src/utils/repeat.ts`. `parseDayCode`, `parseRepeatRule`, and `dayMatchesRepeat` are moved **verbatim** from `database.ts` — do not change their date parsing (`T00:00:00` with no `Z` is deliberate: it reads the string as local midnight, so `getDay()` returns that calendar date's weekday in any timezone).

```ts
export type RepeatRule = 'DAILY' | 'WEEKDAYS' | 'WEEKEND' | 'WEEKLY' | `WEEKLY:${number}`;

function parseDayCode(code: string): number | null {
  switch (code) {
    case 'SU': return 0;
    case 'MO': return 1;
    case 'TU': return 2;
    case 'WE': return 3;
    case 'TH': return 4;
    case 'FR': return 5;
    case 'SA': return 6;
    default: return null;
  }
}

export function parseRepeatRule(rrule?: string | null): RepeatRule | null {
  if (!rrule) return null;
  const rule = rrule.trim().toUpperCase();
  if (rule === 'FREQ=DAILY' || rule === 'DAILY') return 'DAILY';
  if (rule === 'FREQ=WEEKDAYS' || rule === 'WEEKDAYS') return 'WEEKDAYS';
  if (rule === 'FREQ=WEEKEND' || rule === 'WEEKEND') return 'WEEKEND';
  if (rule === 'FREQ=WEEKLY' || rule === 'WEEKLY') return 'WEEKLY';
  const byDayMatch = rule.match(/BYDAY=([A-Z,]+)/);
  if (byDayMatch) return `WEEKLY:${parseDayCode(byDayMatch[1].split(',')[0]) ?? 0}` as RepeatRule;
  return null;
}

export function dayMatchesRepeat(rule: RepeatRule, date: string, startDate?: string): boolean {
  const day = new Date(`${date}T00:00:00`).getDay();
  if (startDate && date < startDate) return false;

  if (rule === 'DAILY') return true;
  if (rule === 'WEEKDAYS') return day >= 1 && day <= 5;
  if (rule === 'WEEKEND') return day === 0 || day === 6;
  if (rule === 'WEEKLY') {
    const startDay = startDate ? new Date(`${startDate}T00:00:00`).getDay() : day;
    return day === startDay;
  }
  const targetDay = Number(rule.split(':')[1]);
  return day === targetDay;
}

// Pure calendar arithmetic on YYYY-MM-DD strings (UTC parse keeps it zone-proof).
export function addDays(date: string, n: number): string {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * 86_400_000).toISOString().split('T')[0];
}

// First date strictly after `fromDate` that satisfies the rule. Scans a bounded
// year so an unsatisfiable rule terminates instead of looping forever.
export function nextOccurrenceDate(
  rrule: string | null | undefined,
  fromDate: string,
  startDate?: string,
): string | null {
  const rule = parseRepeatRule(rrule);
  if (!rule) return null;
  for (let offset = 1; offset <= 366; offset++) {
    const candidate = addDays(fromDate, offset);
    if (dayMatchesRepeat(rule, candidate, startDate)) return candidate;
  }
  return null;
}
```

- [ ] **Step 5: Run the test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: all `repeat.test.ts` assertions pass (`fail 0`).

- [ ] **Step 6: Point database.ts at the util**

In `apps/mobile/src/db/database.ts`, delete the now-duplicated `type RepeatRule`, `parseDayCode`, `parseRepeatRule`, and `dayMatchesRepeat` definitions, and add this import alongside the other util imports at the top:

```ts
import { parseRepeatRule, dayMatchesRepeat, nextOccurrenceDate, type RepeatRule } from '../utils/repeat';
```

If the Step 1 grep showed no remaining callers of a given name, omit it from the import to avoid an unused symbol.

- [ ] **Step 7: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit && npm test
git add src/utils/repeat.ts src/utils/repeat.test.ts src/db/database.ts
git commit -m "refactor(mobile): extract repeat rules into a tested util

Recurrence matching existed but was private to database.ts and untestable.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B2: Roll a repeating task forward on completion

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (`updateItemStatus`, around line 1214)

**Interfaces:**
- Consumes: `nextOccurrenceDate` from Task B1.
- Produces: no new exports — behaviour change to `updateItemStatus`, which every screen already calls to complete a task.

- [ ] **Step 1: Implement the roll-forward**

Handling this centrally in `updateItemStatus` means every existing completion path (Tasks, Project detail, Home timeline, Inbox, swipe actions) picks it up with no call-site changes.

Replace the whole `updateItemStatus` function in `apps/mobile/src/db/database.ts` with:

```ts
export function updateItemStatus(id: string, status: Item['status']): void {
  const now = Date.now();

  // A repeating task is never "done" — completing one occurrence logs it and
  // rolls the task forward to its next matching date, Things 3 style. Handled
  // here so every completion path in the app inherits it.
  if (status === 'completed') {
    const item = getItemWithMetadata(id);
    const next = item ? nextOccurrenceDate(item.rrule, item.scheduledDate ?? formatDate(new Date())) : null;
    if (item && next) {
      getDb().runSync(
        `UPDATE items SET scheduledDate = ?, status = ?, completedAt = NULL, updatedAt = ? WHERE id = ?`,
        [next, 'active', now, id]
      );
      logActivity(id, 'completed-occurrence', JSON.stringify({ occurrence: item.scheduledDate, next }));
      return;
    }
  }

  getDb().runSync(
    `UPDATE items SET status = ?, completedAt = ?, updatedAt = ? WHERE id = ?`,
    [status, status === 'completed' ? now : null, now, id]
  );
  logActivity(id, 'status-changed', JSON.stringify({ status }));
}
```

- [ ] **Step 2: Confirm the helpers are in scope**

Run: `cd apps/mobile && grep -n "function logActivity\|export function getItemWithMetadata\|export function formatDate" src/db/database.ts`
Expected: all three are defined in this file. `nextOccurrenceDate` comes from the Task B1 import.

- [ ] **Step 3: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/db/database.ts
git commit -m "feat(mobile): roll repeating tasks forward instead of completing them

Centralised in updateItemStatus so every completion path inherits it.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task B3: Repeat picker in the item editor

**Files:**
- Modify: `apps/mobile/src/components/item-composer/types.ts`, `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`

**Interfaces:**
- Consumes: `ItemDraft` from `types.ts`.
- Produces: `ItemDraft.rrule?: string` — consumed by Task B2 via the saved item.

- [ ] **Step 1: Add `rrule` to the draft type**

In `apps/mobile/src/components/item-composer/types.ts`, inside `ItemDraft`, add after the `dueDate?: string;` line added in Task A3:

```ts
  rrule?: string;
```

- [ ] **Step 2: Load and save it**

In `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`:

In `createDraft`'s returned object, after `dueDate: undefined,`:

```ts
    rrule: undefined,
```

In `createEditDraft`'s returned object, after its `dueDate: ...` line:

```ts
    rrule: item.rrule ?? undefined,
```

In `saveItemDraft`, extend the edit-branch `updateItem` call added in Task A3 so it becomes:

```ts
    updateItem(itemId, { type: draft.itemType, title, notes, dueDate: draft.dueDate ?? null, rrule: draft.rrule ?? null });
```

and extend the create-branch block added in Task A3 to:

```ts
  if (draft.mode === 'create' && itemId && (draft.dueDate || draft.rrule)) {
    updateItem(itemId, { dueDate: draft.dueDate, rrule: draft.rrule });
  }
```

- [ ] **Step 3: Add the REPEAT section**

In `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`, add this constant next to `TIME_BUCKETS` (around line 61):

```ts
const REPEAT_OPTIONS: Array<{ value: string | undefined; label: string }> = [
  { value: undefined, label: 'Never' },
  { value: 'FREQ=DAILY', label: 'Daily' },
  { value: 'FREQ=WEEKDAYS', label: 'Weekdays' },
  { value: 'FREQ=WEEKEND', label: 'Weekends' },
  { value: 'FREQ=WEEKLY', label: 'Weekly' },
];
```

Then insert this section immediately after the DEADLINE section added in Task A3:

```tsx
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>REPEAT</Text>
                <View style={styles.choiceRow}>
                  {REPEAT_OPTIONS.map((option) => {
                    const selected = (draft.rrule ?? undefined) === option.value;
                    return (
                      <TouchableOpacity
                        key={option.label}
                        style={[
                          styles.bucketChip,
                          { backgroundColor: selected ? material.accentSoft : material.fill, borderColor: selected ? material.rimStrong : material.rim },
                        ]}
                        onPress={() => onChange({ rrule: option.value })}
                      >
                        <Text style={[styles.choiceText, { color: selected ? material.accent : palette.textSecondary }]}>
                          {option.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/components/item-composer/
git commit -m "feat(mobile): add repeat picker to item editor

Exposes the rrule schema field so repeating tasks can be created.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Verify on device**

Create a task scheduled today with Repeat = Daily → complete it → confirm it does **not** move to the Logbook and instead reappears dated tomorrow. Report the result.

---

# Feature C — Checklists

Stored as `metadata.checklist`: an array of `{ id, text, done }`. Matches Things 3's lightweight checklist (no dates/notes per item), so checklist entries can never leak into task queries.

### Task C1: Checklist util

**Files:**
- Create: `apps/mobile/src/utils/checklist.ts`, `apps/mobile/src/utils/checklist.test.ts`

**Interfaces:**
- Produces: `interface ChecklistItem { id: string; text: string; done: boolean }`, `readChecklist(meta): ChecklistItem[]`, `checklistProgress(items): { done: number; total: number }`, `addChecklistItem(items, text, id): ChecklistItem[]`, `toggleChecklistItem(items, id): ChecklistItem[]`, `removeChecklistItem(items, id): ChecklistItem[]`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/checklist.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  readChecklist,
  checklistProgress,
  addChecklistItem,
  toggleChecklistItem,
  removeChecklistItem,
} from './checklist.ts';

test('reads an empty or malformed checklist safely', () => {
  assert.deepEqual(readChecklist({}), []);
  assert.deepEqual(readChecklist({ checklist: 'nope' }), []);
  assert.deepEqual(readChecklist({ checklist: [{ text: 'no id' }] }), []);
});

test('reads well-formed entries', () => {
  const meta = { checklist: [{ id: 'a', text: 'Buy milk', done: false }] };
  assert.deepEqual(readChecklist(meta), [{ id: 'a', text: 'Buy milk', done: false }]);
});

test('adds, toggles and removes without mutating the input', () => {
  const start = [];
  const added = addChecklistItem(start, 'Pack bag', 'id-1');
  assert.deepEqual(start, []);
  assert.deepEqual(added, [{ id: 'id-1', text: 'Pack bag', done: false }]);

  const toggled = toggleChecklistItem(added, 'id-1');
  assert.equal(toggled[0].done, true);
  assert.equal(added[0].done, false);

  assert.deepEqual(removeChecklistItem(toggled, 'id-1'), []);
});

test('ignores blank additions', () => {
  assert.deepEqual(addChecklistItem([], '   ', 'id-1'), []);
});

test('reports progress', () => {
  const items = [
    { id: 'a', text: 'one', done: true },
    { id: 'b', text: 'two', done: false },
  ];
  assert.deepEqual(checklistProgress(items), { done: 1, total: 2 });
  assert.deepEqual(checklistProgress([]), { done: 0, total: 0 });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — cannot resolve `./checklist.ts`.

- [ ] **Step 3: Write the implementation**

Create `apps/mobile/src/utils/checklist.ts`:

```ts
export interface ChecklistItem {
  id: string;
  text: string;
  done: boolean;
}

// Tolerant reader — metadata is free-form JSON that older rows may not have,
// so anything malformed degrades to an empty checklist rather than throwing.
export function readChecklist(meta: Record<string, unknown>): ChecklistItem[] {
  const raw = meta?.checklist;
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((entry): entry is ChecklistItem =>
      !!entry
      && typeof (entry as ChecklistItem).id === 'string'
      && typeof (entry as ChecklistItem).text === 'string')
    .map((entry) => ({ id: entry.id, text: entry.text, done: !!entry.done }));
}

export function checklistProgress(items: ChecklistItem[]): { done: number; total: number } {
  return { done: items.filter((entry) => entry.done).length, total: items.length };
}

// `id` is injected rather than generated so this stays pure and testable; the
// caller passes uuid().
export function addChecklistItem(items: ChecklistItem[], text: string, id: string): ChecklistItem[] {
  const trimmed = text.trim();
  if (!trimmed) return items;
  return [...items, { id, text: trimmed, done: false }];
}

export function toggleChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.map((entry) => (entry.id === id ? { ...entry, done: !entry.done } : entry));
}

export function removeChecklistItem(items: ChecklistItem[], id: string): ChecklistItem[] {
  return items.filter((entry) => entry.id !== id);
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: all `checklist.test.ts` assertions pass (`fail 0`).

- [ ] **Step 5: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/utils/checklist.ts src/utils/checklist.test.ts
git commit -m "feat(mobile): add checklist util

Lightweight Things 3-style checklist stored in item metadata.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task C2: Checklist editor section

**Files:**
- Modify: `apps/mobile/src/components/item-composer/types.ts`, `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`

**Interfaces:**
- Consumes: Task C1's util; `uuid` from `../../db/database`.
- Produces: `ItemDraft.checklist: ChecklistItem[]`, persisted to `metadata.checklist`.

- [ ] **Step 1: Add `checklist` to the draft type**

In `apps/mobile/src/components/item-composer/types.ts`, add the import at the top:

```ts
import type { ChecklistItem } from '../../utils/checklist';
```

and inside `ItemDraft`, after `tags: string[];`:

```ts
  checklist: ChecklistItem[];
```

- [ ] **Step 2: Load and save it**

In `apps/mobile/src/components/item-composer/itemComposerPersistence.ts`, add the import:

```ts
import { readChecklist } from '../../utils/checklist';
```

In `createDraft`'s returned object, after `tags: [],`:

```ts
    checklist: [],
```

In `createEditDraft`'s returned object, after its `tags: metadataTags(metadata),` line:

```ts
    checklist: readChecklist(metadata),
```

In `mergedMetadata`, immediately after the existing tags handling (`if (draft.tags.length) ... else delete metadata.tags;`), add:

```ts
  if (draft.checklist.length) metadata.checklist = draft.checklist;
  else delete metadata.checklist;
```

- [ ] **Step 3: Add the CHECKLIST section**

In `apps/mobile/src/components/item-composer/ItemEditorSheet.tsx`, add imports:

```ts
import { addChecklistItem, toggleChecklistItem, removeChecklistItem } from '../../utils/checklist';
import { uuid } from '../../db/database';
```

Add a draft-input state next to the existing `tagDraft` state (around line 79):

```ts
  const [checklistDraft, setChecklistDraft] = useState('');
```

Insert this section immediately after the ITEM section's closing `</View>` (the section containing the title/notes card):

```tsx
              <View style={styles.section}>
                <Text style={[styles.sectionTitle, { color: material.platinumMuted }]}>CHECKLIST</Text>
                <View style={[styles.card, { backgroundColor: material.surface, borderColor: material.rim }]}>
                  {draft.checklist.map((entry) => (
                    <View key={entry.id} style={styles.checklistRow}>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => onChange({ checklist: toggleChecklistItem(draft.checklist, entry.id) })}
                        accessibilityLabel={entry.done ? `Mark ${entry.text} not done` : `Mark ${entry.text} done`}
                      >
                        <Check size={18} color={entry.done ? material.accent : palette.textTertiary} strokeWidth={2.5} />
                      </TouchableOpacity>
                      <Text
                        style={[
                          styles.checklistText,
                          { color: entry.done ? palette.textTertiary : palette.text },
                          entry.done && styles.checklistTextDone,
                        ]}
                        numberOfLines={2}
                      >
                        {entry.text}
                      </Text>
                      <TouchableOpacity
                        hitSlop={8}
                        onPress={() => onChange({ checklist: removeChecklistItem(draft.checklist, entry.id) })}
                        accessibilityLabel={`Remove ${entry.text}`}
                      >
                        <X size={16} color={palette.textMuted} strokeWidth={2} />
                      </TouchableOpacity>
                    </View>
                  ))}
                  <TextInput
                    style={[styles.checklistInput, { color: palette.text }]}
                    placeholder="Add a step"
                    placeholderTextColor={palette.textTertiary}
                    value={checklistDraft}
                    onChangeText={setChecklistDraft}
                    onSubmitEditing={() => {
                      onChange({ checklist: addChecklistItem(draft.checklist, checklistDraft, uuid()) });
                      setChecklistDraft('');
                    }}
                    blurOnSubmit={false}
                    returnKeyType="done"
                    keyboardAppearance={isDark ? 'dark' : 'light'}
                  />
                </View>
              </View>
```

- [ ] **Step 4: Add the styles**

In the same file's `StyleSheet.create({...})`, add:

```ts
  checklistRow: { flexDirection: 'row', alignItems: 'center', gap: 10, minHeight: 40 },
  checklistText: { flex: 1, fontSize: 15, fontWeight: '500' },
  checklistTextDone: { textDecorationLine: 'line-through' },
  checklistInput: { minHeight: 40, fontSize: 15, fontWeight: '500' },
```

- [ ] **Step 5: Reset the draft input when the sheet reopens**

In the existing `useEffect` that clears `tagDraft` (around line 82), add:

```ts
    setChecklistDraft('');
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/components/item-composer/ src/utils/checklist.ts
git commit -m "feat(mobile): add checklist section to item editor

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task C3: Checklist progress on task rows

**Files:**
- Modify: `apps/mobile/src/screens/TasksScreen.tsx`, `apps/mobile/src/screens/ProjectDetailScreen.tsx`

**Interfaces:**
- Consumes: `readChecklist`, `checklistProgress` from Task C1.

- [ ] **Step 1: Add a helper to both screens**

Add these imports to each of the two files:

```ts
import { readChecklist, checklistProgress } from '../utils/checklist';
```

Add this module-level helper near the top of each file (below the imports, above the component):

```ts
// Item-local, so it never makes a row's height depend on list position.
function checklistLabel(item: Item): string | null {
  const entries = readChecklist(item.metadata ? JSON.parse(item.metadata) : {});
  if (!entries.length) return null;
  const { done, total } = checklistProgress(entries);
  return `${done}/${total}`;
}
```

- [ ] **Step 2: Render it in TasksScreen**

In `makeRenderRow`, immediately after the `{item.dueDate && <DeadlineBadge .../>}` line added in Task A2, add:

```tsx
              {checklistLabel(item) && (
                <Text style={[styles.rowSub, { color: palette.textTertiary }]}>{checklistLabel(item)}</Text>
              )}
```

- [ ] **Step 3: Render it in ProjectDetailScreen**

In `renderRow`, after that file's `{item.dueDate && <DeadlineBadge .../>}` line, add:

```tsx
              {checklistLabel(item) && (
                <Text style={[styles.rowTitle, { color: palette.textTertiary, fontSize: 12 }]}>{checklistLabel(item)}</Text>
              )}
```

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/screens/TasksScreen.tsx src/screens/ProjectDetailScreen.tsx
git commit -m "feat(mobile): show checklist progress on task rows

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Verify on device**

Add three checklist steps to a task, tick one, save → the row should read `1/3`. Drag-reorder that list and confirm no rows vanish or clip. Report the result.

---

# Feature D — Upcoming view

### Task D1: Upcoming query and grouping util

**Files:**
- Create: `apps/mobile/src/utils/upcomingGrouping.ts`, `apps/mobile/src/utils/upcomingGrouping.test.ts`
- Modify: `apps/mobile/src/db/database.ts`

**Interfaces:**
- Produces: `getUpcomingItems(fromDate: string): Item[]` (database.ts), and `groupByScheduledDate(items, today): UpcomingGroup[]` where `interface UpcomingGroup { date: string; label: string; items: Item[] }`.

- [ ] **Step 1: Write the failing test**

Create `apps/mobile/src/utils/upcomingGrouping.test.ts`:

```ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { groupByScheduledDate } from './upcomingGrouping.ts';

const task = (id: string, scheduledDate: string) => ({ id, title: id, scheduledDate });

test('groups by date in ascending order', () => {
  const items = [task('b', '2026-07-26'), task('a', '2026-07-24'), task('c', '2026-07-26')];
  const groups = groupByScheduledDate(items, '2026-07-23');
  assert.equal(groups.length, 2);
  assert.equal(groups[0].date, '2026-07-24');
  assert.deepEqual(groups[1].items.map((i) => i.id), ['b', 'c']);
});

test('labels tomorrow specially and dates the rest', () => {
  const groups = groupByScheduledDate([task('a', '2026-07-24'), task('b', '2026-08-12')], '2026-07-23');
  assert.equal(groups[0].label, 'TOMORROW');
  assert.equal(groups[1].label, 'WED 12 AUG');
});

test('skips items without a scheduled date', () => {
  assert.deepEqual(groupByScheduledDate([{ id: 'a', title: 'a' }], '2026-07-23'), []);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — cannot resolve `./upcomingGrouping.ts`.

- [ ] **Step 3: Write the grouping util**

Create `apps/mobile/src/utils/upcomingGrouping.ts`:

```ts
import type { Item } from '../db/types';
import { daysBetween } from './deadline';

export interface UpcomingGroup {
  date: string;
  label: string;
  items: Item[];
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

function labelFor(date: string, today: string): string {
  if (daysBetween(today, date) === 1) return 'TOMORROW';
  const parsed = new Date(`${date}T00:00:00`);
  const [, month, day] = date.split('-').map(Number);
  return `${WEEKDAYS[parsed.getDay()]} ${day} ${MONTHS[month - 1]}`;
}

// Buckets scheduled items into ascending day sections for the Upcoming list.
export function groupByScheduledDate(items: Item[], today: string): UpcomingGroup[] {
  const byDate = new Map<string, Item[]>();
  for (const item of items) {
    if (!item.scheduledDate) continue;
    const bucket = byDate.get(item.scheduledDate);
    if (bucket) bucket.push(item);
    else byDate.set(item.scheduledDate, [item]);
  }
  return [...byDate.keys()]
    .sort()
    .map((date) => ({ date, label: labelFor(date, today), items: byDate.get(date)! }));
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: all `upcomingGrouping.test.ts` assertions pass (`fail 0`).

- [ ] **Step 5: Add the query**

In `apps/mobile/src/db/database.ts`, add next to `getTodayItems`:

```ts
// Everything scheduled after today, for the Upcoming list. Completed and
// deleted rows are excluded; ordering is by date so grouping stays cheap.
export function getUpcomingItems(fromDate: string): Item[] {
  return getDb().getAllSync<Item>(
    `SELECT * FROM items WHERE scheduledDate > ? AND status != 'completed' AND deletedAt IS NULL
     ORDER BY scheduledDate ASC, createdAt ASC`,
    [fromDate]
  );
}
```

- [ ] **Step 6: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit && npm test
git add src/utils/upcomingGrouping.ts src/utils/upcomingGrouping.test.ts src/db/database.ts
git commit -m "feat(mobile): add upcoming query and date grouping

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

### Task D2: Upcoming screen

**Files:**
- Create: `apps/mobile/src/screens/UpcomingScreen.tsx`
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`, `apps/mobile/src/screens/MenuScreen.tsx`

**Interfaces:**
- Consumes: `getUpcomingItems` and `groupByScheduledDate` from Task D1; `DeadlineBadge` from Task A2.

- [ ] **Step 1: Create the screen**

Create `apps/mobile/src/screens/UpcomingScreen.tsx`:

```tsx
import { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getUpcomingItems, formatDate } from '../db/database';
import { groupByScheduledDate, type UpcomingGroup } from '../utils/upcomingGrouping';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { DeadlineBadge } from '../components/DeadlineBadge';
import { useItemComposer } from '../components/item-composer';
import type { Item } from '../db/types';

export function UpcomingScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { openEditorForItem, revision } = useItemComposer();
  const [groups, setGroups] = useState<UpcomingGroup[]>([]);

  const refresh = useCallback(() => {
    const today = formatDate(new Date());
    setGroups(groupByScheduledDate(getUpcomingItems(today), today));
  }, [revision]);

  useFocusEffect(refresh);

  const renderRow = (item: Item) => (
    <TouchableOpacity
      key={item.id}
      style={[styles.row, { backgroundColor: palette.surface }]}
      activeOpacity={0.7}
      onPress={() => openEditorForItem({
        item,
        onComplete: ({ action }) => {
          if (action !== 'cancelled') refresh();
        },
      })}
    >
      <View style={styles.rowContent}>
        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
      </View>
    </TouchableOpacity>
  );

  return (
    <LensSurface title="Upcoming">
      {groups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing scheduled</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tasks with a future date land here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groups.map((group) => (
            <View key={group.date} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              {group.items.map(renderRow)}
            </View>
          ))}
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  section: { marginBottom: 20 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  rowContent: { flex: 1, minHeight: 44, justifyContent: 'center', gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontWeight: '400' },
});
```

- [ ] **Step 2: Register the route**

In `apps/mobile/src/navigation/MenuStack.tsx`, add the import:

```ts
import { UpcomingScreen } from '../screens/UpcomingScreen';
```

and the screen, after the `Tasks` entry:

```tsx
      <Stack.Screen name="Upcoming" component={UpcomingScreen} />
```

- [ ] **Step 3: Add the menu tile**

In `apps/mobile/src/screens/MenuScreen.tsx`, add this entry to the `menuItems` array immediately after the `Tasks` entry:

```ts
    {
      route: 'Upcoming',
      label: 'Upcoming',
      sub: 'Everything scheduled ahead',
      icon: TaskNoteIcon,
      accent: CALENDAR_GOLD,
      soft: 'rgba(212,176,120,0.12)',
    },
```

Then update the hardcoded count on the line reading `5 destinations` to `6 destinations`.

- [ ] **Step 4: Typecheck and commit**

```bash
cd apps/mobile && npx tsc --noEmit
git add src/screens/UpcomingScreen.tsx src/navigation/MenuStack.tsx src/screens/MenuScreen.tsx
git commit -m "feat(mobile): add Upcoming screen

Scheduled-ahead tasks grouped by day; the last Things 3 list gap.

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

- [ ] **Step 5: Verify on device**

Schedule a task for a future date → Menu → Upcoming → confirm it appears under the right day heading. Report the result.

---

## Done criteria

- `npx tsc --noEmit` clean and `npm test` shows `fail 0` across `deadline`, `repeat`, `checklist`, and `upcomingGrouping` suites.
- All four "Verify on device" steps confirmed by the user (Task A3 Step 6, Task B3 Step 5, Task C3 Step 5, Task D2 Step 5).
- Drag-reorder still glitch-free on Tasks and Project detail after the new row badges (Global Constraints rule).
