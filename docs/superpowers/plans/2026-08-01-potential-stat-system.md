# Potential Stat System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add four character stats (Physique, Skin, Oral Hygiene, Vitality), each driven by whichever habits the user assigns to it, computed from those habits' existing streaks — plus a habit-config UI to assign a habit to a stat and a read-only screen showing all four as progress bars.

**Architecture:** A single new pure-logic file (`src/utils/potential.ts`) owns the stat definitions, per-habit metadata parsing, and the streak→percentage math, unit-tested in isolation. `HabitDetailScreen` gets a new section for assigning a habit to a stat (writes to the habit's existing `metadata` JSON blob — no schema change). A new `PotentialScreen` reads all habits, calls the pure compute function, and renders four `KatanaProgress` bars, reached from a new Menu grid entry.

**Tech Stack:** React Native + Expo, RN primitives + `StyleSheet.create`, existing `KatanaProgress` SVG progress bar component, `computeStreak`/`getCompletedOccurrenceDates` (unchanged), Node's built-in `test` module for unit tests (`*.test.ts`, run via `npm test` from `apps/mobile/`).

## Global Constraints

- No schema or new DB tables — everything is stored in the habit item's existing `metadata` JSON column (spec: "Data Model").
- `computeStreak()` and `getCompletedOccurrenceDates()` are reused completely unchanged — no new streak logic, no decay logic beyond what they already do (spec: "Out of Scope").
- Four fixed stats only, in this exact order everywhere they're listed: Physique, Skin, Oral Hygiene, Vitality (spec: "Data Model", "Potential Screen").
- Multiple habits may feed one stat; a stat's percentage is the average of its assigned habits' percentages, or 0 if none are assigned (spec: "Data Model").
- A single habit's contribution is `min(streak / targetDays, 1) * 100`; `targetDays` defaults to 100 if a stat is assigned but no target is set (spec: "Data Model").
- No Ronin character visual changes, no radar/spider chart, no generic-item-editor changes, no non-habit items contributing — all explicitly out of scope (spec: "Out of Scope").
- Follow existing conventions: RN primitives + `StyleSheet.create`, `useThemeContext()`/`getThemeColors(isDark)`, `LensSurface` screen chrome, icons from `../icons`.

---

## File Structure

- **Create** `apps/mobile/src/utils/potential.ts` — `PotentialStat` type, `POTENTIAL_STATS`, `POTENTIAL_STAT_LABELS`, `parseHabitPotentialMeta`, `computePotentialStats`.
- **Create** `apps/mobile/src/utils/potential.test.ts` — unit tests for the above.
- **Modify** `apps/mobile/src/screens/HabitDetailScreen.tsx` — add a "Potential" section (stat chips + target-days input) below the existing History section.
- **Create** `apps/mobile/src/screens/PotentialScreen.tsx` — the four-stat read-only bar screen.
- **Modify** `apps/mobile/src/navigation/MenuStack.tsx` — register the `Potential` route.
- **Modify** `apps/mobile/src/screens/MenuScreen.tsx` — add a "Potential" grid entry.

---

### Task 1: `potential.ts` — types, metadata parsing, and the compute function

**Files:**
- Create: `apps/mobile/src/utils/potential.ts`
- Test: `apps/mobile/src/utils/potential.test.ts`

**Interfaces:**
- Consumes: `computeStreak(rrule, completedDates, today): number` (`src/utils/streak.ts`), `Item` type (`src/db/types.ts`, has `id`, `title`, `rrule`, `metadata` fields).
- Produces: `PotentialStat` type, `POTENTIAL_STATS: PotentialStat[]`, `POTENTIAL_STAT_LABELS: Record<PotentialStat, string>`, `HabitPotentialMeta` interface, `parseHabitPotentialMeta(metadata?: string): HabitPotentialMeta`, `StatContribution` interface, `PotentialStatResult` interface, `computePotentialStats(habits: Item[], completedDatesByHabitId: Record<string, Set<string>>, today: string): Record<PotentialStat, PotentialStatResult>` — consumed by Task 2 (habit config UI reads/writes `HabitPotentialMeta`) and Task 3 (`PotentialScreen` calls `computePotentialStats`).

Note the compute function takes `completedDatesByHabitId` as a parameter rather than calling `getCompletedOccurrenceDates` itself — this keeps the function pure and DB-free, matching `computeStreak`'s own pattern (it takes `completedDates: Set<string>`, not an item id) and making it testable with plain fixtures, same as `streak.test.ts`. `PotentialScreen` (Task 3) is responsible for building that map from the DB before calling this function.

- [ ] **Step 1: Write the failing tests**

Create `apps/mobile/src/utils/potential.test.ts`:

```typescript
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseHabitPotentialMeta, computePotentialStats, POTENTIAL_STATS, POTENTIAL_STAT_LABELS } from './potential.ts';

function habit(id, rrule, metadata) {
  return { id, type: 'habit', title: id, status: 'active', rrule, metadata: metadata ? JSON.stringify(metadata) : undefined, createdAt: 0, updatedAt: 0 };
}

test('POTENTIAL_STATS lists the four fixed stats in order', () => {
  assert.deepEqual(POTENTIAL_STATS, ['physique', 'skin', 'oralHygiene', 'vitality']);
  assert.equal(POTENTIAL_STAT_LABELS.physique, 'Physique');
  assert.equal(POTENTIAL_STAT_LABELS.skin, 'Skin');
  assert.equal(POTENTIAL_STAT_LABELS.oralHygiene, 'Oral Hygiene');
  assert.equal(POTENTIAL_STAT_LABELS.vitality, 'Vitality');
});

test('parseHabitPotentialMeta falls back to no assignment on missing/malformed metadata', () => {
  assert.deepEqual(parseHabitPotentialMeta(undefined), {});
  assert.deepEqual(parseHabitPotentialMeta('not json'), {});
  assert.deepEqual(parseHabitPotentialMeta('{}'), {});
});

test('parseHabitPotentialMeta reads a valid assignment and defaults target days', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'physique' })),
    { potentialStat: 'physique', potentialTargetDays: 100 },
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'skin', potentialTargetDays: 60 })),
    { potentialStat: 'skin', potentialTargetDays: 60 },
  );
});

test('parseHabitPotentialMeta drops an invalid stat name and preserves gtdContext-style unrelated fields being ignored', () => {
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'not-a-stat', gtdContext: 'habit' })),
    {},
  );
  assert.deepEqual(
    parseHabitPotentialMeta(JSON.stringify({ potentialStat: 'vitality', potentialTargetDays: 'not-a-number' })),
    { potentialStat: 'vitality', potentialTargetDays: 100 },
  );
});

test('computePotentialStats: single habit, linear scaling, capped at 100%', () => {
  const habits = [habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 })];
  const dates = { h1: new Set(['2026-08-01']) }; // 1-day streak ending today (rrule DAILY matches every day)
  const result = computePotentialStats(habits, dates, '2026-08-01');
  assert.equal(result.physique.percent, 1); // 1/100 * 100 = 1
  assert.deepEqual(result.physique.contributions.map((c) => c.habitId), ['h1']);
  assert.equal(result.skin.percent, 0);
  assert.deepEqual(result.skin.contributions, []);
});

test('computePotentialStats: streak beyond target caps contribution at 100%', () => {
  const today = '2026-08-01';
  const dates = new Set();
  for (let i = 0; i < 150; i++) {
    const d = new Date(`${today}T00:00:00`);
    d.setDate(d.getDate() - i);
    dates.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  }
  const habits = [habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 })];
  const result = computePotentialStats(habits, { h1: dates }, today);
  assert.equal(result.physique.percent, 100);
});

test('computePotentialStats: two habits feeding one stat average their contributions', () => {
  const habits = [
    habit('h1', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 100 }),
    habit('h2', 'DAILY', { potentialStat: 'physique', potentialTargetDays: 50 }),
  ];
  // h1: 50-day streak -> 50%. h2: 50-day streak -> 100% (capped). Average = 75%.
  const today = '2026-08-01';
  function streakDates(days) {
    const s = new Set();
    for (let i = 0; i < days; i++) {
      const d = new Date(`${today}T00:00:00`);
      d.setDate(d.getDate() - i);
      s.add(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
    }
    return s;
  }
  const dates = { h1: streakDates(50), h2: streakDates(50) };
  const result = computePotentialStats(habits, dates, today);
  assert.equal(result.physique.percent, 75);
  assert.equal(result.physique.contributions.length, 2);
});

test('computePotentialStats: habit with no potentialStat assigned contributes to nothing', () => {
  const habits = [habit('h1', 'DAILY', { gtdContext: 'habit' })];
  const result = computePotentialStats(habits, { h1: new Set(['2026-08-01']) }, '2026-08-01');
  for (const stat of POTENTIAL_STATS) {
    assert.equal(result[stat].percent, 0);
    assert.deepEqual(result[stat].contributions, []);
  }
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/potential.test.ts`
Expected: FAIL — `Cannot find module './potential.ts'` (file doesn't exist yet).

- [ ] **Step 3: Implement `potential.ts`**

```typescript
import { computeStreak } from './streak';
import type { Item } from '../db/types';

export type PotentialStat = 'physique' | 'skin' | 'oralHygiene' | 'vitality';

export const POTENTIAL_STATS: PotentialStat[] = ['physique', 'skin', 'oralHygiene', 'vitality'];

export const POTENTIAL_STAT_LABELS: Record<PotentialStat, string> = {
  physique: 'Physique',
  skin: 'Skin',
  oralHygiene: 'Oral Hygiene',
  vitality: 'Vitality',
};

const DEFAULT_TARGET_DAYS = 100;

export interface HabitPotentialMeta {
  potentialStat?: PotentialStat;
  potentialTargetDays?: number;
}

export function parseHabitPotentialMeta(metadata?: string): HabitPotentialMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    if (!POTENTIAL_STATS.includes(parsed.potentialStat)) return {};
    const meta: HabitPotentialMeta = { potentialStat: parsed.potentialStat };
    meta.potentialTargetDays =
      typeof parsed.potentialTargetDays === 'number' && parsed.potentialTargetDays > 0
        ? parsed.potentialTargetDays
        : DEFAULT_TARGET_DAYS;
    return meta;
  } catch {
    return {};
  }
}

export interface StatContribution {
  habitId: string;
  habitTitle: string;
  percent: number;
}

export interface PotentialStatResult {
  stat: PotentialStat;
  percent: number;
  contributions: StatContribution[];
}

export function computePotentialStats(
  habits: Item[],
  completedDatesByHabitId: Record<string, Set<string>>,
  today: string,
): Record<PotentialStat, PotentialStatResult> {
  const contributionsByStat: Record<PotentialStat, StatContribution[]> = {
    physique: [],
    skin: [],
    oralHygiene: [],
    vitality: [],
  };

  for (const habit of habits) {
    const meta = parseHabitPotentialMeta(habit.metadata);
    if (!meta.potentialStat) continue;
    const completedDates = completedDatesByHabitId[habit.id] ?? new Set<string>();
    const streak = computeStreak(habit.rrule, completedDates, today);
    const targetDays = meta.potentialTargetDays ?? DEFAULT_TARGET_DAYS;
    const percent = Math.min(streak / targetDays, 1) * 100;
    contributionsByStat[meta.potentialStat].push({ habitId: habit.id, habitTitle: habit.title, percent });
  }

  const result = {} as Record<PotentialStat, PotentialStatResult>;
  for (const stat of POTENTIAL_STATS) {
    const contributions = contributionsByStat[stat];
    const percent = contributions.length === 0
      ? 0
      : contributions.reduce((sum, c) => sum + c.percent, 0) / contributions.length;
    result[stat] = { stat, percent, contributions };
  }
  return result;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd apps/mobile && node --disable-warning=MODULE_TYPELESS_PACKAGE_JSON --experimental-strip-types --test src/utils/potential.test.ts`
Expected: PASS, all 8 tests.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/potential.ts apps/mobile/src/utils/potential.test.ts
git commit -m "feat(mobile): add Potential stat computation (physique/skin/oral hygiene/vitality)"
```

---

### Task 2: Habit config UI in `HabitDetailScreen`

**Files:**
- Modify: `apps/mobile/src/screens/HabitDetailScreen.tsx` (full current contents shown below for reference — 243 lines)

**Interfaces:**
- Consumes: `POTENTIAL_STATS`, `POTENTIAL_STAT_LABELS`, `parseHabitPotentialMeta`, `type PotentialStat` (Task 1, `src/utils/potential.ts`), `updateItemMetadata(id: string, metadata: Record<string, any>): void` (`src/db/database.ts`, already imported by many screens — same pattern as `ExerciseLibraryScreen.tsx`'s `handleSubmit`).
- Produces: no new exports — this is UI wiring only. The `metadata` shape it writes (`{ ...existingParsedMetadata, potentialStat, potentialTargetDays }`) is what Task 1's `parseHabitPotentialMeta` and Task 3's `computePotentialStats` read back.

Per spec: a 5-way chip row (Physique / Skin / Oral Hygiene / Vitality / None), same visual chip pattern as `ExerciseEditSheet.tsx`'s muscle-group chips (`borderRadius: 16`, `borderWidth: hairline`, selected = accent background). When a stat other than "None" is selected, a target-days numeric input appears (default 100, shown as placeholder). Selecting "None" clears both fields. Saving must preserve any other existing metadata fields (e.g. `gtdContext`) by spreading the full parsed metadata object before writing, not just the two new fields — `updateItemMetadata` fully replaces the `metadata` column, it does not merge.

- [ ] **Step 1: Add imports and local state**

In `apps/mobile/src/screens/HabitDetailScreen.tsx`, add to the top imports (after the existing `import { computeStreak } from '../utils/streak';` line):

```typescript
import { POTENTIAL_STATS, POTENTIAL_STAT_LABELS, parseHabitPotentialMeta, type PotentialStat } from '../utils/potential';
import { updateItemMetadata } from '../db/database';
```

Note: `updateItemMetadata` needs to be added to the existing `import { getItemWithMetadata, getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence } from '../db/database';` line instead of a separate import — change that line to:

```typescript
import { getItemWithMetadata, getCompletedOccurrenceDates, formatDate, toggleHabitOccurrence, updateItemMetadata } from '../db/database';
```

Inside the `HabitDetailScreen` function, after the existing `const [monthAnchor, setMonthAnchor] = useState(new Date());` line, add:

```typescript
const [targetDaysText, setTargetDaysText] = useState('');
```

- [ ] **Step 2: Derive the current potential assignment and wire the save handlers**

After the existing `const sortedLog = useMemo(...)` block, add:

```typescript
const potentialMeta = useMemo(() => parseHabitPotentialMeta(item?.metadata), [item]);

const savePotentialStat = (stat: PotentialStat | null) => {
  if (!item) return;
  const existing = item.metadata ? JSON.parse(item.metadata) : {};
  if (stat === null) {
    delete existing.potentialStat;
    delete existing.potentialTargetDays;
  } else {
    existing.potentialStat = stat;
    existing.potentialTargetDays = potentialMeta.potentialTargetDays ?? 100;
  }
  updateItemMetadata(item.id, existing);
  Haptics.selectionAsync();
  load();
};

const saveTargetDays = () => {
  if (!item || !potentialMeta.potentialStat) return;
  const parsed = parseInt(targetDaysText, 10);
  const targetDays = Number.isFinite(parsed) && parsed > 0 ? parsed : 100;
  const existing = item.metadata ? JSON.parse(item.metadata) : {};
  existing.potentialTargetDays = targetDays;
  updateItemMetadata(item.id, existing);
  load();
};
```

`Haptics` is already imported at the top of this file (`import * as Haptics from 'expo-haptics';`), so no new import needed for that call.

- [ ] **Step 3: Keep the target-days input in sync when the screen loads**

Add a `useEffect` after the `useFocusEffect(load);` line (add `useEffect` to the existing `import { useCallback, useMemo, useState } from 'react';` line, changing it to `import { useCallback, useEffect, useMemo, useState } from 'react';`):

```typescript
useEffect(() => {
  setTargetDaysText(potentialMeta.potentialTargetDays ? String(potentialMeta.potentialTargetDays) : '');
}, [potentialMeta.potentialTargetDays]);
```

- [ ] **Step 4: Render the Potential section**

In the JSX, add a new section right after the closing `</View>` of the `streakRow` block (i.e., right before the `<View style={styles.monthHeader}>` block):

```tsx
<View style={styles.potentialSection}>
  <Text style={[styles.potentialLabel, { color: palette.textTertiary }]}>POTENTIAL</Text>
  <View style={styles.chipRow}>
    <TouchableOpacity
      style={[
        styles.chip,
        { borderColor: palette.separator },
        !potentialMeta.potentialStat && { backgroundColor: palette.red, borderColor: palette.red },
      ]}
      onPress={() => savePotentialStat(null)}
    >
      <Text style={[styles.chipText, { color: !potentialMeta.potentialStat ? palette.surface : palette.text }]}>None</Text>
    </TouchableOpacity>
    {POTENTIAL_STATS.map((stat) => {
      const selected = potentialMeta.potentialStat === stat;
      return (
        <TouchableOpacity
          key={stat}
          style={[styles.chip, { borderColor: palette.separator }, selected && { backgroundColor: palette.red, borderColor: palette.red }]}
          onPress={() => savePotentialStat(stat)}
        >
          <Text style={[styles.chipText, { color: selected ? palette.surface : palette.text }]}>{POTENTIAL_STAT_LABELS[stat]}</Text>
        </TouchableOpacity>
      );
    })}
  </View>
  {potentialMeta.potentialStat && (
    <View style={styles.targetDaysRow}>
      <Text style={[styles.targetDaysLabel, { color: palette.textTertiary }]}>TARGET DAYS (100% AT)</Text>
      <TextInput
        style={[styles.targetDaysInput, { color: palette.text, borderColor: palette.separator }]}
        value={targetDaysText}
        onChangeText={setTargetDaysText}
        onBlur={saveTargetDays}
        placeholder="100"
        placeholderTextColor={palette.textTertiary}
        keyboardType="number-pad"
      />
    </View>
  )}
</View>
```

This needs `TextInput` added to the existing `import { StyleSheet, Text, TouchableOpacity, View, ScrollView } from 'react-native';` line:

```typescript
import { StyleSheet, Text, TextInput, TouchableOpacity, View, ScrollView } from 'react-native';
```

- [ ] **Step 5: Add the new styles**

Add to the `styles` `StyleSheet.create` object, after the existing `streakText: { ... },` entry:

```typescript
potentialSection: {
  marginBottom: 20,
},
potentialLabel: {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.6,
  textTransform: 'uppercase',
  marginBottom: 8,
},
chipRow: {
  flexDirection: 'row',
  flexWrap: 'wrap',
  gap: 8,
},
chip: {
  borderRadius: 16,
  borderWidth: StyleSheet.hairlineWidth,
  paddingHorizontal: 14,
  paddingVertical: 8,
},
chipText: {
  fontSize: 13,
  fontWeight: '600',
},
targetDaysRow: {
  marginTop: 12,
  gap: 4,
},
targetDaysLabel: {
  fontSize: 11,
  fontWeight: '700',
  letterSpacing: 0.6,
},
targetDaysInput: {
  borderWidth: StyleSheet.hairlineWidth,
  borderRadius: 10,
  fontSize: 15,
  padding: 10,
  width: 100,
},
```

- [ ] **Step 6: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "HabitDetailScreen"`
Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add apps/mobile/src/screens/HabitDetailScreen.tsx
git commit -m "feat(mobile): add Potential stat assignment to habit detail screen"
```

---

### Task 3: `PotentialScreen`

**Files:**
- Create: `apps/mobile/src/screens/PotentialScreen.tsx`

**Interfaces:**
- Consumes: `POTENTIAL_STATS`, `POTENTIAL_STAT_LABELS`, `computePotentialStats` (Task 1), `getItemsByType(type: string): Item[]`, `getCompletedOccurrenceDates(itemId: string): Set<string>`, `formatDate(date: Date): string` (`src/db/database.ts`, same functions `HabitDetailScreen` already uses), `KatanaProgress` (`src/components/ui/KatanaProgress.tsx`, props `{ progress: number (0-1), size?, accessibilityLabel? }`), `LensSurface` (`src/components/LensSurface.tsx`).
- Produces: `PotentialScreen` component, registered as route name `Potential` in Task 4.

- [ ] **Step 1: Write the screen**

```typescript
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { getItemsByType, getCompletedOccurrenceDates, formatDate } from '../db/database';
import { POTENTIAL_STATS, POTENTIAL_STAT_LABELS, computePotentialStats, type PotentialStatResult } from '../utils/potential';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { KatanaProgress } from '../components/ui/KatanaProgress';

export function PotentialScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [results, setResults] = useState<Record<string, PotentialStatResult> | null>(null);

  const load = useCallback(() => {
    const habits = getItemsByType('habit');
    const completedDatesByHabitId: Record<string, Set<string>> = {};
    for (const habit of habits) {
      completedDatesByHabitId[habit.id] = getCompletedOccurrenceDates(habit.id);
    }
    const today = formatDate(new Date());
    setResults(computePotentialStats(habits, completedDatesByHabitId, today));
  }, []);

  useFocusEffect(load);

  return (
    <LensSurface title="Potential">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {POTENTIAL_STATS.map((stat) => {
          const result = results?.[stat];
          const percent = result ? Math.round(result.percent) : 0;
          const contributionNames = result?.contributions.map((c) => c.habitTitle).join(', ') ?? '';
          return (
            <View key={stat} style={styles.statRow}>
              <View style={styles.statHeaderRow}>
                <Text style={[styles.statLabel, { color: palette.text }]}>{POTENTIAL_STAT_LABELS[stat]}</Text>
                <Text style={[styles.statPercent, { color: palette.textTertiary }]}>{percent}%</Text>
              </View>
              <KatanaProgress progress={(result?.percent ?? 0) / 100} size={16} accessibilityLabel={`${POTENTIAL_STAT_LABELS[stat]} potential`} />
              <Text style={[styles.statSubtext, { color: palette.textTertiary }]}>
                {contributionNames || 'No habits linked yet — assign one from a habit’s detail page.'}
              </Text>
            </View>
          );
        })}
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 24 },
  statRow: { gap: 8 },
  statHeaderRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  statLabel: { fontSize: 16, fontWeight: '700' },
  statPercent: { fontSize: 14, fontWeight: '600' },
  statSubtext: { fontSize: 13, fontWeight: '400' },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "PotentialScreen"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/PotentialScreen.tsx
git commit -m "feat(mobile): add PotentialScreen showing the four stat bars"
```

---

### Task 4: Register the route and add the Menu grid entry

**Files:**
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/MenuScreen.tsx`

**Interfaces:**
- Consumes: `PotentialScreen` (Task 3), `Sparkles` icon (`../icons`, already exported at `apps/mobile/src/icons.tsx:42` from `react-native-heroicons/outline/SparklesIcon`).
- Produces: route name `Potential`, navigable from the Menu grid and via `navigation.navigate('Potential')` from anywhere in `MenuStack`.

- [ ] **Step 1: Register the route**

In `apps/mobile/src/navigation/MenuStack.tsx`, add the import after `import { HabitsScreen } from '../screens/HabitsScreen';`:

```typescript
import { PotentialScreen } from '../screens/PotentialScreen';
```

Add the screen registration after `<Stack.Screen name="Habits" component={HabitsScreen} />`:

```typescript
<Stack.Screen name="Potential" component={PotentialScreen} />
```

- [ ] **Step 2: Add the Menu grid entry**

In `apps/mobile/src/screens/MenuScreen.tsx`, add `Sparkles` to the icon imports — change:

```typescript
import {
  ArchiveScrollChestIcon,
  HabitRitualIcon,
  ToGetParcelIcon,
  WorkoutTrainingIcon,
} from '../components/icons/CollectionIcons';
```

to also import the heroicon:

```typescript
import {
  ArchiveScrollChestIcon,
  HabitRitualIcon,
  ToGetParcelIcon,
  WorkoutTrainingIcon,
} from '../components/icons/CollectionIcons';
import { Sparkles } from '../icons';
```

Add a new entry to the `menuItems` array, after the `Habits` entry:

```typescript
{
  route: 'Potential',
  label: 'Potential',
  sub: 'Character stats from your habits',
  icon: Sparkles,
  iconSize: 34,
  accent: palette.purple,
},
```

Note: `iconSize: 34` (smaller than the 42 used by the custom PNG-style icon components) because `Sparkles` is a vector heroicon, not the same hand-illustrated style as `HabitRitualIcon`/`WorkoutTrainingIcon` — 42pt would look oversized for a simple line icon. `strokeWidth={1.8}` is already applied uniformly to every grid icon in the existing `<Icon size={iconSize} color={accent} strokeWidth={1.8} />` render call, so no per-item change needed there.

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -iE "MenuStack|MenuScreen"`
Expected: no output.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/MenuScreen.tsx
git commit -m "feat(mobile): register Potential route and add its Menu grid entry"
```

---

### Task 5: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -v "^App\.web\|^src/webApp"`
Expected: zero errors (the `webApp/` filter excludes this repo's known-unrelated, pre-existing `.web.tsx`-resolution false positives).

- [ ] **Step 2: Run the full test suite**

Run: `cd apps/mobile && npm test 2>&1 | tail -20`
Expected: all tests pass, including the 8 new `potential.test.ts` tests from Task 1.

- [ ] **Step 3: Launch the dev client and walk the flow**

Start Metro per `apps/mobile/CLAUDE.md`'s Quick Reference, open the app, and verify:
- Menu grid shows a new "Potential" card (Sparkles icon, purple accent) alongside Habits/Workouts/etc.
- Tapping it opens a screen titled "Potential" with four rows (Physique, Skin, Oral Hygiene, Vitality), each showing 0% and "No habits linked yet — assign one from a habit's detail page." if no habits are assigned yet.
- Open an existing (or newly created) habit's detail screen — a new "POTENTIAL" section appears below the streak row, with None/Physique/Skin/Oral Hygiene/Vitality chips.
- Selecting a stat (e.g. Physique) shows a "TARGET DAYS (100% AT)" input defaulting to blank (placeholder "100"); selecting "None" hides it again and clears the assignment.
- Set a target days value (e.g. 10), back out to the Potential screen — the Physique row should reflect `min(that habit's current streak / 10, 1) * 100`% and list the habit's title in the subtext.
- Assign a second habit to the same stat with a different target — confirm the Potential screen shows the average of the two habits' percentages, and both titles in the subtext (comma-separated).
- Miss a day on one of the assigned habits (or manually toggle off today's check-in via the habit's calendar) — confirm that habit's streak resets per existing `computeStreak` behavior and the stat's percentage drops accordingly on next visit to the Potential screen.

Expected: all of the above behave as described. Note and fix anything found before considering this done.

- [ ] **Step 4: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address manual verification findings for Potential stat system"
```

(Skip this step if Step 3 found nothing to fix.)
