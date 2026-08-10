# Exercise Library + Workout Template Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an exercise library (browse/create/edit exercises with muscle group + equipment metadata) and let users attach exercises to workout templates as ordered, configurable blocks (sets/reps/weight/rest).

**Architecture:** Two new item types (`exercise`, `workout-block`) riding on the existing generic `items`/`itemRelations`/`itemOrder` tables — no schema migration. Two new screens (`ExerciseLibraryScreen`, `WorkoutTemplateDetailScreen`) and three new lightweight bottom sheets (`ExerciseEditSheet`, `BlockEditSheet`, `ExercisePickerSheet`), following the existing Things-3-style `QuickCreateSheet`/`BottomSheet` pattern rather than the large generic `ItemEditorSheet`. Ordering of blocks within a template reuses the existing `setManualOrder`/`applyManualOrder` + `useHapticReorder` primitive already used by `ProjectDetailScreen`.

**Tech Stack:** React Native + Expo SDK 54, TypeScript, SQLite (`expo-sqlite`), React Navigation native-stack, `react-native-reorderable-list`, `react-native-heroicons`.

## Global Constraints

- Follow `apps/mobile/CLAUDE.md`'s Things-3 flat-row / bottom-sheet visual patterns — no cards/shadows in list rows, hairline separators, Cancel/Save toolbar sheets.
- User-facing copy: this feature has no `area`/`project` entities involved, so the Domain/Mission renaming rule doesn't apply — use plain English ("Exercise Library", "muscle group", etc.).
- `metadata` on `items` is a JSON string column — always `JSON.parse`/`JSON.stringify` through it, never assume it's already an object.
- Pure logic (metadata parsing/formatting, grouping, filtering) goes in `src/utils/*.ts` and is unit-tested with `node --test` (project convention — see `src/utils/checklist.test.ts` for the exact style: `// @ts-nocheck` header comment, `import { test } from 'node:test'`, `import assert from 'node:assert/strict'`, importing the module with an explicit `.ts` extension). Run via `npm test` from `apps/mobile/`.
- RN screens/components in this codebase have no automated test coverage (confirmed: no `*.test.tsx` files exist for `WorkoutsScreen`, `ProjectDetailScreen`, or any other screen). Verify those via `npx tsc --noEmit` (from `apps/mobile/`) plus manual code review — do not invent component tests that don't match the codebase's existing testing strategy. This is a physical-device Expo app; there is no browser preview to exercise it in, so on-device verification is left to the user.
- After this feature is implemented, update `apps/mobile/SCHEMA.md` and `apps/mobile/CLAUDE.md` per the repo's Multi-Agent Rule (any schema/component changes must be documented immediately).

---

### Task 1: Exercise metadata utilities

**Files:**
- Create: `apps/mobile/src/utils/exerciseLibrary.ts`
- Test: `apps/mobile/src/utils/exerciseLibrary.test.ts`

**Interfaces:**
- Produces: `MuscleGroup` type, `Equipment` type, `ExerciseMeta` interface (`{ muscleGroup: MuscleGroup; equipment?: Equipment; notes?: string }`), `MUSCLE_GROUPS: MuscleGroup[]`, `MUSCLE_GROUP_LABELS: Record<MuscleGroup, string>`, `EQUIPMENT_OPTIONS: Equipment[]`, `EQUIPMENT_LABELS: Record<Equipment, string>`, `parseExerciseMeta(metadata?: string): ExerciseMeta`, `formatExerciseSubtitle(meta: ExerciseMeta): string`, `ExerciseGroup` interface (`{ muscleGroup: MuscleGroup; label: string; exercises: Item[] }`), `groupExercisesByMuscle(exercises: Item[]): ExerciseGroup[]`, `filterExercisesByQuery(exercises: Item[], query: string): Item[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/utils/exerciseLibrary.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseExerciseMeta,
  formatExerciseSubtitle,
  groupExercisesByMuscle,
  filterExercisesByQuery,
  MUSCLE_GROUPS,
} from './exerciseLibrary.ts';

function makeExercise(id, title, meta) {
  return {
    id,
    type: 'exercise',
    title,
    status: 'active',
    metadata: JSON.stringify(meta),
    createdAt: 0,
    updatedAt: 0,
  };
}

test('parseExerciseMeta falls back to full-body on missing/malformed metadata', () => {
  assert.deepEqual(parseExerciseMeta(undefined), { muscleGroup: 'full-body' });
  assert.deepEqual(parseExerciseMeta('not json'), { muscleGroup: 'full-body' });
  assert.deepEqual(parseExerciseMeta('{}'), { muscleGroup: 'full-body' });
});

test('parseExerciseMeta reads valid fields and drops invalid ones', () => {
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue' })),
    { muscleGroup: 'chest', equipment: 'barbell', notes: 'form cue' },
  );
  assert.deepEqual(
    parseExerciseMeta(JSON.stringify({ muscleGroup: 'not-a-group', equipment: 'not-equipment' })),
    { muscleGroup: 'full-body' },
  );
});

test('formatExerciseSubtitle joins muscle group and equipment', () => {
  assert.equal(formatExerciseSubtitle({ muscleGroup: 'chest', equipment: 'barbell' }), 'Chest · Barbell');
  assert.equal(formatExerciseSubtitle({ muscleGroup: 'core' }), 'Core');
});

test('groupExercisesByMuscle buckets, sorts alphabetically, and drops empty groups', () => {
  const exercises = [
    makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
    makeExercise('2', 'Push-Up', { muscleGroup: 'chest' }),
    makeExercise('3', 'Squat', { muscleGroup: 'legs' }),
  ];
  const groups = groupExercisesByMuscle(exercises);
  assert.deepEqual(groups.map((g) => g.muscleGroup), ['chest', 'legs']);
  assert.deepEqual(groups[0].exercises.map((e) => e.title), ['Bench Press', 'Push-Up']);
  assert.equal(groups.every((g) => MUSCLE_GROUPS.includes(g.muscleGroup)), true);
});

test('filterExercisesByQuery is case-insensitive and substring-based', () => {
  const exercises = [
    makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
    makeExercise('2', 'Squat', { muscleGroup: 'legs' }),
  ];
  assert.deepEqual(filterExercisesByQuery(exercises, 'bench').map((e) => e.id), ['1']);
  assert.deepEqual(filterExercisesByQuery(exercises, '').map((e) => e.id), ['1', '2']);
  assert.deepEqual(filterExercisesByQuery(exercises, 'zzz'), []);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `Cannot find module './exerciseLibrary.ts'` (file doesn't exist yet).

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/src/utils/exerciseLibrary.ts
import type { Item } from '../db/types';

export type MuscleGroup = 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full-body' | 'cardio';
export type Equipment = 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other';

export interface ExerciseMeta {
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
}

export const MUSCLE_GROUPS: MuscleGroup[] = ['chest', 'back', 'shoulders', 'arms', 'legs', 'core', 'full-body', 'cardio'];

export const MUSCLE_GROUP_LABELS: Record<MuscleGroup, string> = {
  chest: 'Chest',
  back: 'Back',
  shoulders: 'Shoulders',
  arms: 'Arms',
  legs: 'Legs',
  core: 'Core',
  'full-body': 'Full Body',
  cardio: 'Cardio',
};

export const EQUIPMENT_OPTIONS: Equipment[] = ['barbell', 'dumbbell', 'machine', 'cable', 'bodyweight', 'kettlebell', 'band', 'other'];

export const EQUIPMENT_LABELS: Record<Equipment, string> = {
  barbell: 'Barbell',
  dumbbell: 'Dumbbell',
  machine: 'Machine',
  cable: 'Cable',
  bodyweight: 'Bodyweight',
  kettlebell: 'Kettlebell',
  band: 'Band',
  other: 'Other',
};

const DEFAULT_META: ExerciseMeta = { muscleGroup: 'full-body' };

export function parseExerciseMeta(metadata?: string): ExerciseMeta {
  if (!metadata) return DEFAULT_META;
  try {
    const parsed = JSON.parse(metadata);
    const muscleGroup: MuscleGroup = MUSCLE_GROUPS.includes(parsed.muscleGroup) ? parsed.muscleGroup : 'full-body';
    const equipment: Equipment | undefined = EQUIPMENT_OPTIONS.includes(parsed.equipment) ? parsed.equipment : undefined;
    const notes = typeof parsed.notes === 'string' && parsed.notes.trim() ? parsed.notes : undefined;
    return { muscleGroup, equipment, notes };
  } catch {
    return DEFAULT_META;
  }
}

export function formatExerciseSubtitle(meta: ExerciseMeta): string {
  const parts = [MUSCLE_GROUP_LABELS[meta.muscleGroup]];
  if (meta.equipment) parts.push(EQUIPMENT_LABELS[meta.equipment]);
  return parts.join(' · ');
}

export interface ExerciseGroup {
  muscleGroup: MuscleGroup;
  label: string;
  exercises: Item[];
}

export function groupExercisesByMuscle(exercises: Item[]): ExerciseGroup[] {
  const buckets = new Map<MuscleGroup, Item[]>(MUSCLE_GROUPS.map((mg) => [mg, []]));
  for (const exercise of exercises) {
    const meta = parseExerciseMeta(exercise.metadata);
    buckets.get(meta.muscleGroup)!.push(exercise);
  }
  return MUSCLE_GROUPS
    .map((muscleGroup) => ({
      muscleGroup,
      label: MUSCLE_GROUP_LABELS[muscleGroup],
      exercises: [...buckets.get(muscleGroup)!].sort((a, b) => a.title.localeCompare(b.title)),
    }))
    .filter((group) => group.exercises.length > 0);
}

export function filterExercisesByQuery(exercises: Item[], query: string): Item[] {
  const q = query.trim().toLowerCase();
  if (!q) return exercises;
  return exercises.filter((exercise) => exercise.title.toLowerCase().includes(q));
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS — all `exerciseLibrary.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/exerciseLibrary.ts apps/mobile/src/utils/exerciseLibrary.test.ts
git commit -m "feat(mobile): add exercise metadata parsing/grouping utilities"
```

---

### Task 2: Workout block metadata utilities

**Files:**
- Create: `apps/mobile/src/utils/workoutBlock.ts`
- Test: `apps/mobile/src/utils/workoutBlock.test.ts`

**Interfaces:**
- Produces: `WorkoutBlockMeta` interface (`{ sets?: number; reps?: string; weight?: string; restSeconds?: number; notes?: string }`), `parseBlockMeta(metadata?: string): WorkoutBlockMeta`, `formatBlockSummary(meta: WorkoutBlockMeta): string`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/utils/workoutBlock.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseBlockMeta, formatBlockSummary } from './workoutBlock.ts';

test('parseBlockMeta returns empty object for missing/malformed metadata', () => {
  assert.deepEqual(parseBlockMeta(undefined), {});
  assert.deepEqual(parseBlockMeta('not json'), {});
});

test('parseBlockMeta reads valid fields and drops invalid/blank ones', () => {
  assert.deepEqual(
    parseBlockMeta(JSON.stringify({ sets: 4, reps: '8-12', weight: '60kg', restSeconds: 90, notes: 'go slow' })),
    { sets: 4, reps: '8-12', weight: '60kg', restSeconds: 90, notes: 'go slow' },
  );
  assert.deepEqual(parseBlockMeta(JSON.stringify({ sets: '4', reps: '  ' })), {});
});

test('formatBlockSummary combines sets/reps/weight', () => {
  assert.equal(formatBlockSummary({ sets: 4, reps: '8-12', weight: '60kg' }), '4 × 8-12 · 60kg');
  assert.equal(formatBlockSummary({ sets: 3 }), '3 sets');
  assert.equal(formatBlockSummary({ reps: '20 min' }), '20 min');
  assert.equal(formatBlockSummary({ restSeconds: 60 }), 'Rest 60s');
  assert.equal(formatBlockSummary({}), 'Tap to configure');
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `Cannot find module './workoutBlock.ts'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/src/utils/workoutBlock.ts
export interface WorkoutBlockMeta {
  sets?: number;
  reps?: string;
  weight?: string;
  restSeconds?: number;
  notes?: string;
}

export function parseBlockMeta(metadata?: string): WorkoutBlockMeta {
  if (!metadata) return {};
  try {
    const parsed = JSON.parse(metadata);
    const meta: WorkoutBlockMeta = {};
    if (typeof parsed.sets === 'number') meta.sets = parsed.sets;
    if (typeof parsed.reps === 'string' && parsed.reps.trim()) meta.reps = parsed.reps.trim();
    if (typeof parsed.weight === 'string' && parsed.weight.trim()) meta.weight = parsed.weight.trim();
    if (typeof parsed.restSeconds === 'number') meta.restSeconds = parsed.restSeconds;
    if (typeof parsed.notes === 'string' && parsed.notes.trim()) meta.notes = parsed.notes.trim();
    return meta;
  } catch {
    return {};
  }
}

export function formatBlockSummary(meta: WorkoutBlockMeta): string {
  const parts: string[] = [];
  if (meta.sets && meta.reps) parts.push(`${meta.sets} × ${meta.reps}`);
  else if (meta.sets) parts.push(`${meta.sets} sets`);
  else if (meta.reps) parts.push(meta.reps);
  if (meta.weight) parts.push(meta.weight);
  if (parts.length > 0) return parts.join(' · ');
  if (meta.restSeconds) return `Rest ${meta.restSeconds}s`;
  return 'Tap to configure';
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS — all `workoutBlock.test.ts` cases green.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/workoutBlock.ts apps/mobile/src/utils/workoutBlock.test.ts
git commit -m "feat(mobile): add workout block metadata parsing/summary utilities"
```

---

### Task 3: Starter exercise data

**Files:**
- Create: `apps/mobile/src/utils/starterExercises.ts`
- Test: `apps/mobile/src/utils/starterExercises.test.ts`

**Interfaces:**
- Consumes: `MuscleGroup`, `Equipment`, `MUSCLE_GROUPS` from `./exerciseLibrary.ts` (Task 1).
- Produces: `StarterExercise` interface (`{ title: string; muscleGroup: MuscleGroup; equipment?: Equipment }`), `STARTER_EXERCISES: StarterExercise[]`.

- [ ] **Step 1: Write the failing test**

```typescript
// apps/mobile/src/utils/starterExercises.test.ts
// @ts-nocheck -- executed directly by Node's TypeScript test runner; the Expo app intentionally omits Node ambient types.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { STARTER_EXERCISES } from './starterExercises.ts';
import { MUSCLE_GROUPS } from './exerciseLibrary.ts';

test('starter exercises are non-empty, unique, and cover every muscle group with valid groups', () => {
  assert.ok(STARTER_EXERCISES.length >= 15);
  const titles = STARTER_EXERCISES.map((e) => e.title);
  assert.equal(new Set(titles).size, titles.length);
  for (const exercise of STARTER_EXERCISES) {
    assert.ok(MUSCLE_GROUPS.includes(exercise.muscleGroup), `${exercise.title} has invalid muscle group`);
  }
  const coveredGroups = new Set(STARTER_EXERCISES.map((e) => e.muscleGroup));
  for (const group of MUSCLE_GROUPS) {
    assert.ok(coveredGroups.has(group), `no starter exercise for muscle group ${group}`);
  }
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd apps/mobile && npm test`
Expected: FAIL — `Cannot find module './starterExercises.ts'`.

- [ ] **Step 3: Write minimal implementation**

```typescript
// apps/mobile/src/utils/starterExercises.ts
import type { MuscleGroup, Equipment } from './exerciseLibrary';

export interface StarterExercise {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
}

export const STARTER_EXERCISES: StarterExercise[] = [
  { title: 'Barbell Bench Press', muscleGroup: 'chest', equipment: 'barbell' },
  { title: 'Push-Up', muscleGroup: 'chest', equipment: 'bodyweight' },
  { title: 'Incline Dumbbell Press', muscleGroup: 'chest', equipment: 'dumbbell' },
  { title: 'Pull-Up', muscleGroup: 'back', equipment: 'bodyweight' },
  { title: 'Barbell Row', muscleGroup: 'back', equipment: 'barbell' },
  { title: 'Lat Pulldown', muscleGroup: 'back', equipment: 'cable' },
  { title: 'Overhead Press', muscleGroup: 'shoulders', equipment: 'barbell' },
  { title: 'Lateral Raise', muscleGroup: 'shoulders', equipment: 'dumbbell' },
  { title: 'Bicep Curl', muscleGroup: 'arms', equipment: 'dumbbell' },
  { title: 'Tricep Pushdown', muscleGroup: 'arms', equipment: 'cable' },
  { title: 'Barbell Squat', muscleGroup: 'legs', equipment: 'barbell' },
  { title: 'Romanian Deadlift', muscleGroup: 'legs', equipment: 'barbell' },
  { title: 'Walking Lunge', muscleGroup: 'legs', equipment: 'dumbbell' },
  { title: 'Leg Press', muscleGroup: 'legs', equipment: 'machine' },
  { title: 'Plank', muscleGroup: 'core', equipment: 'bodyweight' },
  { title: 'Hanging Leg Raise', muscleGroup: 'core', equipment: 'bodyweight' },
  { title: 'Kettlebell Swing', muscleGroup: 'full-body', equipment: 'kettlebell' },
  { title: 'Burpee', muscleGroup: 'full-body', equipment: 'bodyweight' },
  { title: 'Running', muscleGroup: 'cardio', equipment: 'other' },
  { title: 'Rowing Machine', muscleGroup: 'cardio', equipment: 'machine' },
];
```

- [ ] **Step 4: Run test to verify it passes**

Run: `cd apps/mobile && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/starterExercises.ts apps/mobile/src/utils/starterExercises.test.ts
git commit -m "feat(mobile): add starter exercise catalog data"
```

---

### Task 4: `useExercises` hook

**Files:**
- Modify: `apps/mobile/src/hooks/useDb.ts` (add after `useWorkouts`, currently lines 191-198)

**Interfaces:**
- Consumes: `getItemsByType('exercise')` (existing, `src/db/database.ts:171`), `useDbRefresh` (existing, same file).
- Produces: `useExercises(): { exercises: Item[]; refresh: () => void }`.

- [ ] **Step 1: Add the hook**

In `apps/mobile/src/hooks/useDb.ts`, immediately after the existing `useWorkouts` function:

```typescript
export function useExercises() {
  const [exercises, setExercises] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setExercises(getItemsByType('exercise'));
  }, []);
  useDbRefresh(refresh);
  return { exercises, refresh };
}
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/hooks/useDb.ts
git commit -m "feat(mobile): add useExercises hook"
```

---

### Task 5: `ExerciseEditSheet` component

**Files:**
- Create: `apps/mobile/src/components/ExerciseEditSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet` (`src/components/ui/BottomSheet.tsx`), `useThemeContext`/`getThemeColors` (`src/hooks/useThemeContext.ts`, `src/theme`), `getItemComposerMaterial` (`src/theme/itemComposer.ts`), `MuscleGroup`/`Equipment`/`MUSCLE_GROUPS`/`MUSCLE_GROUP_LABELS`/`EQUIPMENT_OPTIONS`/`EQUIPMENT_LABELS` (Task 1).
- Produces: `ExerciseEditSheet` component, `ExerciseDraft` type (`{ title: string; muscleGroup: MuscleGroup; equipment?: Equipment; notes?: string }`), consumed by Task 6 (`ExerciseLibraryScreen`) and Task 9 (`ExercisePickerSheet`).

This is a UI component with no automated test (see Global Constraints) — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/ExerciseEditSheet.tsx
import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type MuscleGroup,
} from '../utils/exerciseLibrary';

export interface ExerciseDraft {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
  notes?: string;
}

interface ExerciseEditSheetProps {
  visible: boolean;
  initialValue?: ExerciseDraft;
  onClose: () => void;
  onSubmit: (draft: ExerciseDraft) => void;
}

const EMPTY_DRAFT: ExerciseDraft = { title: '', muscleGroup: 'full-body', equipment: undefined, notes: '' };

export function ExerciseEditSheet({ visible, initialValue, onClose, onSubmit }: ExerciseEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [title, setTitle] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('full-body');
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    const draft = initialValue ?? EMPTY_DRAFT;
    setTitle(draft.title);
    setMuscleGroup(draft.muscleGroup);
    setEquipment(draft.equipment);
    setNotes(draft.notes ?? '');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ title: trimmedTitle, muscleGroup, equipment, notes: notes.trim() || undefined });
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={initialValue ? 'Edit Exercise' : 'New Exercise'}
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!title.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent, opacity: title.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={[styles.inputRow, { borderBottomColor: material.rim }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: palette.text }]}
          placeholder="Exercise name..."
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>MUSCLE GROUP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {MUSCLE_GROUPS.map((group) => {
          const selected = muscleGroup === group;
          return (
            <TouchableOpacity
              key={group}
              style={[
                styles.chip,
                { borderColor: material.rim },
                selected && { backgroundColor: material.accent, borderColor: material.accent },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setMuscleGroup(group);
              }}
            >
              <Text style={[styles.chipText, { color: selected ? material.onAccent : palette.text }]}>
                {MUSCLE_GROUP_LABELS[group]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>EQUIPMENT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: material.rim },
            !equipment && { backgroundColor: material.accent, borderColor: material.accent },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setEquipment(undefined);
          }}
        >
          <Text style={[styles.chipText, { color: !equipment ? material.onAccent : palette.text }]}>Any</Text>
        </TouchableOpacity>
        {EQUIPMENT_OPTIONS.map((option) => {
          const selected = equipment === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.chip,
                { borderColor: material.rim },
                selected && { backgroundColor: material.accent, borderColor: material.accent },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setEquipment(option);
              }}
            >
              <Text style={[styles.chipText, { color: selected ? material.onAccent : palette.text }]}>
                {EQUIPMENT_LABELS[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>NOTES</Text>
      <TextInput
        style={[styles.notesInput, { color: palette.text, borderColor: material.rim }]}
        placeholder="Form cues, optional..."
        placeholderTextColor={palette.textTertiary}
        value={notes}
        onChangeText={setNotes}
        multiline
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16 },
  content: { paddingBottom: spacing[5], gap: 4 },
  actionText: { fontSize: 16, fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  inputRow: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.3,
    minHeight: 56,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: { flexGrow: 0 },
  chipRowContent: { gap: 8, paddingRight: 8 },
  chip: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    fontSize: 15,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ExerciseEditSheet.tsx
git commit -m "feat(mobile): add ExerciseEditSheet for creating/editing exercises"
```

---

### Task 6: `ExerciseLibraryScreen`

**Files:**
- Create: `apps/mobile/src/screens/ExerciseLibraryScreen.tsx`

**Interfaces:**
- Consumes: `useExercises` (Task 4), `groupExercisesByMuscle`/`filterExercisesByQuery`/`formatExerciseSubtitle`/`parseExerciseMeta` (Task 1), `STARTER_EXERCISES` (Task 3), `ExerciseEditSheet`/`ExerciseDraft` (Task 5), `createItem`/`updateItemMetadata`/`deleteItem` (existing, `src/db/database.ts`), `showActionSheet` (existing, `src/utils/actionSheet.ts`), `LensSurface` (existing), `Plus` icon (existing, `src/icons.tsx`).
- Produces: `ExerciseLibraryScreen` component, registered as route name `'ExerciseLibrary'` in Task 7.

UI component, no automated test — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the screen**

```typescript
// apps/mobile/src/screens/ExerciseLibraryScreen.tsx
import { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { groupExercisesByMuscle, filterExercisesByQuery, formatExerciseSubtitle, parseExerciseMeta } from '../utils/exerciseLibrary';
import { STARTER_EXERCISES } from '../utils/starterExercises';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

export function ExerciseLibraryScreen() {
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ muscleGroup: 'full-body' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMuscle(exercises);
  }, [exercises, query]);

  const openCreate = () => {
    setEditTarget(null);
    setSheetOpen(true);
  };

  const openEdit = (item: Item) => {
    setEditTarget(item);
    setSheetOpen(true);
  };

  const handleSubmit = (draft: ExerciseDraft) => {
    if (editTarget) {
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(item.title, [
      { label: 'Edit', onPress: () => openEdit(item) },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  const addStarters = () => {
    for (const starter of STARTER_EXERCISES) {
      const id = createItem('exercise', starter.title, 'active');
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment });
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  return (
    <LensSurface
      title="Exercise Library"
      headerRight={
        <TouchableOpacity onPress={openCreate} hitSlop={12} accessibilityLabel="Add exercise">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      {exercises.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No exercises yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Add your own, or start from a common set.</Text>
          <TouchableOpacity style={[styles.primaryCard, { backgroundColor: palette.text }]} onPress={addStarters} activeOpacity={0.85}>
            <Text style={[styles.primaryCardText, { color: palette.bg }]}>Add starter exercises</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={openCreate} hitSlop={8}>
            <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Add one manually →</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <TextInput
            style={[styles.search, { color: palette.text, backgroundColor: palette.surface, borderColor: palette.separator }]}
            placeholder="Search exercises..."
            placeholderTextColor={palette.textTertiary}
            value={query}
            onChangeText={setQuery}
            keyboardAppearance={isDark ? 'dark' : 'light'}
          />
          {groups.map((group) => (
            <View key={group.muscleGroup + group.label} style={styles.sectionRows}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label.toUpperCase()}</Text>
              {group.exercises.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => openEdit(item)}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={400}
                >
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                    {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      )}

      <ExerciseEditSheet
        visible={sheetOpen}
        initialValue={editTarget ? { title: editTarget.title, ...parseExerciseMeta(editTarget.metadata) } : undefined}
        onClose={() => { setSheetOpen(false); setEditTarget(null); }}
        onSubmit={handleSubmit}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  search: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    marginBottom: 12,
  },
  sectionRows: { gap: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8, paddingHorizontal: 24 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontWeight: '400', textAlign: 'center', marginBottom: 8 },
  primaryCard: { borderRadius: 14, paddingVertical: 14, paddingHorizontal: 24, alignItems: 'center', marginTop: 8 },
  primaryCardText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  linkText: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', marginTop: 8 },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/ExerciseLibraryScreen.tsx
git commit -m "feat(mobile): add ExerciseLibraryScreen"
```

---

### Task 7: Wire Exercise Library into navigation and Workouts screen

**Files:**
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/WorkoutsScreen.tsx`

**Interfaces:**
- Consumes: `ExerciseLibraryScreen` (Task 6), `useNavigation` from `@react-navigation/native` (existing dependency, already used elsewhere e.g. `LensSurface.tsx`).

- [ ] **Step 1: Register the route**

In `apps/mobile/src/navigation/MenuStack.tsx`, add the import and screen registration:

```typescript
import { ExerciseLibraryScreen } from '../screens/ExerciseLibraryScreen';
```

```typescript
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
```

- [ ] **Step 2: Add the link on `WorkoutsScreen`**

In `apps/mobile/src/screens/WorkoutsScreen.tsx`, add `useNavigation` to the imports:

```typescript
import { useNavigation } from '@react-navigation/native';
```

Inside `WorkoutsScreen()`, add:

```typescript
  const navigation = useNavigation();
```

Add a link to the exercise library, visible in both the empty and populated states — place it right after the closing `</ScrollView>` tag's sibling content, i.e. add this `TouchableOpacity` as a persistent row above `</ScrollView>`'s content by inserting it as the first child inside `<ScrollView contentContainerStyle={styles.content} ...>`, before the `{workouts.length === 0 ? ... : ...}` block:

```typescript
        <TouchableOpacity onPress={() => navigation.navigate('ExerciseLibrary' as never)} hitSlop={8} style={styles.libraryLink}>
          <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Exercise Library →</Text>
        </TouchableOpacity>
```

Add the `libraryLink` style to the `StyleSheet.create` call at the bottom of the file:

```typescript
  libraryLink: {
    marginBottom: 4,
  },
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/WorkoutsScreen.tsx
git commit -m "feat(mobile): wire Exercise Library screen into navigation"
```

---

### Task 8: `BlockEditSheet` component

**Files:**
- Create: `apps/mobile/src/components/BlockEditSheet.tsx`

**Interfaces:**
- Consumes: `BottomSheet`, `useThemeContext`/`getThemeColors`, `getItemComposerMaterial`, `WorkoutBlockMeta` (Task 2).
- Produces: `BlockEditSheet` component, consumed by Task 10 (`WorkoutTemplateDetailScreen`).

UI component, no automated test — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/BlockEditSheet.tsx
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import type { WorkoutBlockMeta } from '../utils/workoutBlock';

interface BlockEditSheetProps {
  visible: boolean;
  exerciseTitle: string;
  initialValue?: WorkoutBlockMeta;
  onClose: () => void;
  onSubmit: (meta: WorkoutBlockMeta) => void;
}

function toIntOrUndefined(text: string): number | undefined {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function BlockEditSheet({ visible, exerciseTitle, initialValue, onClose, onSubmit }: BlockEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const setsRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setSets(initialValue?.sets ? String(initialValue.sets) : '');
    setReps(initialValue?.reps ?? '');
    setWeight(initialValue?.weight ?? '');
    setRestSeconds(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
    setNotes(initialValue?.notes ?? '');
    const t = setTimeout(() => setsRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({
      sets: toIntOrUndefined(sets),
      reps: reps.trim() || undefined,
      weight: weight.trim() || undefined,
      restSeconds: toIntOrUndefined(restSeconds),
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={exerciseTitle}
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>SETS</Text>
        <TextInput
          ref={setsRef}
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="4"
          placeholderTextColor={palette.textTertiary}
          value={sets}
          onChangeText={setSets}
          keyboardType="number-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>REPS</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="8-12"
          placeholderTextColor={palette.textTertiary}
          value={reps}
          onChangeText={setReps}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>WEIGHT</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="60kg or bodyweight"
          placeholderTextColor={palette.textTertiary}
          value={weight}
          onChangeText={setWeight}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>REST (SECONDS)</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="90"
          placeholderTextColor={palette.textTertiary}
          value={restSeconds}
          onChangeText={setRestSeconds}
          keyboardType="number-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>NOTES</Text>
        <TextInput
          style={[styles.fieldInput, styles.notesInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16 },
  content: { paddingBottom: spacing[5], gap: 12 },
  actionText: { fontSize: 16, fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, fontSize: 15, padding: 10 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/BlockEditSheet.tsx
git commit -m "feat(mobile): add BlockEditSheet for configuring template exercise blocks"
```

---

### Task 9: `ExercisePickerSheet` component

**Files:**
- Create: `apps/mobile/src/components/ExercisePickerSheet.tsx`

**Interfaces:**
- Consumes: `useExercises` (Task 4), `groupExercisesByMuscle`/`filterExercisesByQuery` (Task 1), `ExerciseEditSheet`/`ExerciseDraft` (Task 5), `createItem`/`updateItemMetadata` (existing), `BottomSheet` (existing).
- Produces: `ExercisePickerSheet` component, consumed by Task 10 (`WorkoutTemplateDetailScreen`). `onPick: (exercise: Item) => void` fires once, after which the parent is expected to open `BlockEditSheet`.

UI component, no automated test — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the component**

```typescript
// apps/mobile/src/components/ExercisePickerSheet.tsx
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { ExerciseEditSheet, type ExerciseDraft } from './ExerciseEditSheet';
import { groupExercisesByMuscle, filterExercisesByQuery, formatExerciseSubtitle, parseExerciseMeta } from '../utils/exerciseLibrary';
import type { Item } from '../db/types';

interface ExercisePickerSheetProps {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Item) => void;
}

export function ExercisePickerSheet({ visible, onClose, onPick }: ExercisePickerSheetProps) {
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [query, setQuery] = useState('');
  const [createOpen, setCreateOpen] = useState(false);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ muscleGroup: 'full-body' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMuscle(exercises);
  }, [exercises, query]);

  const handlePick = (item: Item) => {
    Haptics.selectionAsync();
    setQuery('');
    onClose();
    onPick(item);
  };

  const handleCreateSubmit = (draft: ExerciseDraft) => {
    const id = createItem('exercise', draft.title, 'active');
    updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes });
    refresh();
    const created: Item = {
      id,
      type: 'exercise',
      title: draft.title,
      status: 'active',
      metadata: JSON.stringify({ muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCreateOpen(false);
    setQuery('');
    onClose();
    onPick(created);
  };

  return (
    <>
      <BottomSheet
        visible={visible}
        onClose={onClose}
        isDark={isDark}
        title="Add Exercise"
        topAnchored
        scrollable
        sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
        contentContainerStyle={styles.content}
        headerLeft={
          <TouchableOpacity onPress={onClose} hitSlop={12}>
            <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
          </TouchableOpacity>
        }
      >
        <TextInput
          style={[styles.search, { color: palette.text, borderColor: material.rim }]}
          placeholder="Search exercises..."
          placeholderTextColor={palette.textTertiary}
          value={query}
          onChangeText={setQuery}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
        <TouchableOpacity style={[styles.newRow, { borderColor: material.rim }]} onPress={() => setCreateOpen(true)}>
          <Text style={[styles.newRowText, { color: material.accent }]}>+ New Exercise</Text>
        </TouchableOpacity>
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          {groups.map((group) => (
            <View key={group.muscleGroup + group.label} style={styles.sectionRows}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label.toUpperCase()}</Text>
              {group.exercises.map((item) => (
                <TouchableOpacity key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                    {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </ScrollView>
      </BottomSheet>

      <ExerciseEditSheet
        visible={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateSubmit}
      />
    </>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16, maxHeight: '80%' },
  content: { paddingBottom: spacing[5], flexGrow: 1 },
  actionText: { fontSize: 16, fontWeight: '400' },
  search: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, marginBottom: 8 },
  newRow: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingVertical: 12, alignItems: 'center', marginBottom: 12 },
  newRowText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  list: { maxHeight: 360 },
  sectionRows: { gap: 6, marginBottom: 14 },
  sectionLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6, marginBottom: 2 },
  row: { paddingVertical: 8, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontSize: 12, fontWeight: '500' },
});
```

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/ExercisePickerSheet.tsx
git commit -m "feat(mobile): add ExercisePickerSheet for selecting/creating exercises"
```

---

### Task 10: `WorkoutTemplateDetailScreen`

**Files:**
- Create: `apps/mobile/src/screens/WorkoutTemplateDetailScreen.tsx`

**Interfaces:**
- Consumes: `getRelatedItems`, `applyManualOrder`, `createItem`, `setRelation`, `getRelation`, `updateItemMetadata`, `deleteItem`, `getItemWithMetadata` (all existing, `src/db/database.ts`), `useHapticReorder` (existing, `src/hooks/useHapticReorder.ts`), `ReorderableList` from `react-native-reorderable-list` (existing dependency), `parseBlockMeta`/`formatBlockSummary` (Task 2), `BlockEditSheet` (Task 8), `ExercisePickerSheet` (Task 9), `showActionSheet` (existing), `LensSurface` (existing), `Plus` icon (existing).
- Produces: `WorkoutTemplateDetailScreen` component, registered as route name `'WorkoutTemplateDetail'` in Task 11, expecting route params `{ templateId: string; title: string }`.

UI component, no automated test — verify via `npx tsc --noEmit` and code review.

- [ ] **Step 1: Write the screen**

```typescript
// apps/mobile/src/screens/WorkoutTemplateDetailScreen.tsx
import { useCallback, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import ReorderableList from 'react-native-reorderable-list';
import {
  getRelatedItems,
  applyManualOrder,
  createItem,
  setRelation,
  getRelation,
  updateItemMetadata,
  deleteItem,
  getItemWithMetadata,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { DragHandleButton } from '../components/ui/DragHandleButton';
import { BlockEditSheet } from '../components/BlockEditSheet';
import { ExercisePickerSheet } from '../components/ExercisePickerSheet';
import { useHapticReorder } from '../hooks/useHapticReorder';
import { parseBlockMeta, formatBlockSummary } from '../utils/workoutBlock';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

interface WorkoutTemplateDetailRouteParams {
  templateId: string;
  title: string;
}

interface BlockRow {
  block: Item;
  exerciseTitle: string;
}

export function WorkoutTemplateDetailScreen() {
  const route = useRoute();
  const { templateId, title } = route.params as WorkoutTemplateDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBlock, setEditingBlock] = useState<BlockRow | null>(null);

  const listKey = `workout-template:${templateId}`;

  const refresh = useCallback(() => {
    const blocks = applyManualOrder(listKey, getRelatedItems(templateId, 'workout-template'));
    const nextRows: BlockRow[] = blocks.map((block) => {
      const exerciseId = getRelation(block.id, 'exercise');
      const exercise = exerciseId ? getItemWithMetadata(exerciseId) : null;
      return { block, exerciseTitle: exercise?.title ?? block.title };
    });
    setRows(nextRows);
  }, [templateId, listKey]);

  useFocusEffect(refresh);

  const { onDragStart, onIndexChange, onReorder } = useHapticReorder(
    listKey,
    rows.map((r) => r.block),
    (nextBlocks) => {
      const byId = new Map(rows.map((r) => [r.block.id, r]));
      setRows(nextBlocks.map((b) => byId.get(b.id)!));
    },
  );

  const handlePickExercise = (exercise: Item) => {
    const blockId = createItem('workout-block', exercise.title, 'active');
    setRelation(blockId, 'exercise', exercise.id);
    setRelation(blockId, 'workout-template', templateId);
    updateItemMetadata(blockId, {});
    refresh();
    const block = getItemWithMetadata(blockId);
    if (block) setEditingBlock({ block, exerciseTitle: exercise.title });
  };

  const handleBlockSave = (meta: ReturnType<typeof parseBlockMeta>) => {
    if (!editingBlock) return;
    updateItemMetadata(editingBlock.block.id, meta);
    setEditingBlock(null);
    refresh();
  };

  const handleLongPress = (row: BlockRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(row.exerciseTitle, [
      { label: 'Edit', onPress: () => setEditingBlock(row) },
      {
        label: 'Remove from template',
        destructive: true,
        onPress: () => {
          deleteItem(row.block.id);
          refresh();
        },
      },
    ]);
  };

  const renderRow = ({ item }: { item: Item }) => {
    const row = rows.find((r) => r.block.id === item.id);
    if (!row) return null;
    return (
      <View style={styles.cell}>
        <TouchableOpacity
          style={[styles.row, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: isDark ? palette.separatorStrong : palette.separator }]}
          activeOpacity={0.75}
          onPress={() => setEditingBlock(row)}
          onLongPress={() => handleLongPress(row)}
          delayLongPress={400}
        >
          <View style={styles.rowContent}>
            <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.exerciseTitle}</Text>
            <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
              {formatBlockSummary(parseBlockMeta(row.block.metadata))}
            </Text>
          </View>
          <DragHandleButton color={palette.textMuted} />
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <LensSurface
      title={title}
      headerRight={
        <TouchableOpacity onPress={() => setPickerOpen(true)} hitSlop={12} accessibilityLabel="Add exercise to template">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No exercises yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap + to add one.</Text>
        </View>
      ) : (
        <ReorderableList
          data={rows.map((r) => r.block)}
          keyExtractor={(item, index) => item?.id ?? String(index)}
          renderItem={renderRow}
          onDragStart={onDragStart}
          onIndexChange={onIndexChange}
          onReorder={onReorder}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
        />
      )}

      <ExercisePickerSheet visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickExercise} />

      <BlockEditSheet
        visible={!!editingBlock}
        exerciseTitle={editingBlock?.exerciseTitle ?? ''}
        initialValue={editingBlock ? parseBlockMeta(editingBlock.block.metadata) : undefined}
        onClose={() => setEditingBlock(null)}
        onSubmit={handleBlockSave}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  cell: { marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontSize: 12, fontWeight: '500' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 8 },
  emptyTitle: { fontSize: 18, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  emptySub: { fontSize: 14, fontWeight: '400' },
});
```

Note: `handlePickExercise` calls `updateItemMetadata(blockId, {})` immediately after creating the block so the block has valid (empty) JSON metadata from the start — `parseBlockMeta` already tolerates `undefined`/missing metadata, but this keeps the row consistent with blocks that have been edited at least once. This screen only destructures `onDragStart`/`onIndexChange`/`onReorder` from `useHapticReorder` (not `isReordering`) since, unlike `ProjectDetailScreen`, there's no connector overlay here that needs hiding mid-drag.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/WorkoutTemplateDetailScreen.tsx
git commit -m "feat(mobile): add WorkoutTemplateDetailScreen for building templates"
```

---

### Task 11: Wire template detail into navigation and update `WorkoutsScreen` tap behavior

**Files:**
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`
- Modify: `apps/mobile/src/screens/WorkoutsScreen.tsx`

**Interfaces:**
- Consumes: `WorkoutTemplateDetailScreen` (Task 10).

- [ ] **Step 1: Register the route**

In `apps/mobile/src/navigation/MenuStack.tsx`:

```typescript
import { WorkoutTemplateDetailScreen } from '../screens/WorkoutTemplateDetailScreen';
```

```typescript
      <Stack.Screen name="Workouts" component={WorkoutsScreen} />
      <Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />
      <Stack.Screen name="WorkoutTemplateDetail" component={WorkoutTemplateDetailScreen} />
```

- [ ] **Step 2: Change template row tap to navigate, move rename into long-press**

In `apps/mobile/src/screens/WorkoutsScreen.tsx`, the template row currently does:

```typescript
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: palette.surface }]}
                activeOpacity={0.7}
                onPress={() => openEdit(item)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
```

Change `onPress` to navigate to the detail screen instead of opening the rename sheet:

```typescript
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: palette.surface }]}
                activeOpacity={0.7}
                onPress={() => navigation.navigate('WorkoutTemplateDetail' as never, { templateId: item.id, title: item.title } as never)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
```

The existing `handleLongPress` action sheet already offers `Edit` (which calls `openEdit(item)`, opening the rename `QuickCreateSheet`) and `Delete` — relabel `'Edit'` to `'Rename'` so it reads correctly now that tapping the row does something else:

```typescript
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEdit(item) },
```

becomes:

```typescript
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Rename', onPress: () => openEdit(item) },
```

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/navigation/MenuStack.tsx apps/mobile/src/screens/WorkoutsScreen.tsx
git commit -m "feat(mobile): open template detail on tap, move rename to long-press"
```

---

### Task 12: Update schema and platform docs

**Files:**
- Modify: `apps/mobile/SCHEMA.md`
- Modify: `apps/mobile/CLAUDE.md`

Per the repo's Multi-Agent Rule, schema/component additions must be documented immediately.

- [ ] **Step 1: Update `SCHEMA.md`**

In the entity type reference table, change:

```
| `workout-block` | declared, not built | — |
| `exercise` | declared, not built | — |
```

to:

```
| `workout-block` | built | `sets`, `reps`, `weight`, `restSeconds`, `notes` |
| `exercise` | built | `muscleGroup`, `equipment`, `notes` |
```

In the "Relation graph" mermaid diagram, change the disconnected `WorkoutBlock`/`Exercise` nodes into wired edges:

```
    WorkoutTemplate["Workout template"]
    WorkoutBlock["Workout block (declared, not built)"]
    Exercise["Exercise (declared, not built)"]
```

to:

```
    WorkoutBlock -- workout-template --> WorkoutTemplate["Workout template"]
    WorkoutBlock["Workout block"] -- exercise --> Exercise["Exercise"]
```

And update the prose line below the diagram (currently listing all unconnected nodes) to drop `Workout template, Workout block, Exercise` from the "no relations wired up yet" list, since they now have `workout-block -> workout-template` and `workout-block -> exercise` relations — leave `Habit`, `Medication`, `Meal` as still-unconnected.

Add to "Currently used relations":

```
- `workout-block -> workout-template` (relationType `'workout-template'`)
- `workout-block -> exercise` (relationType `'exercise'`)
```

Update the last line of "Known gaps" (currently: `No workout-session model (so "start workout" / "continue workout" have no data to attach to yet).`) — leave as-is, it's still accurate (this feature is planning-only, no session model).

- [ ] **Step 2: Update `CLAUDE.md`**

In the "Screens" table, add two rows:

```
| `ExerciseLibraryScreen.tsx` | RN primitives (StyleSheet) | Exercise catalog, grouped by muscle group |
| `WorkoutTemplateDetailScreen.tsx` | RN primitives + ReorderableList | Drag-reorder exercises within a template |
```

In the "Components" table, add three rows:

```
| `ExerciseEditSheet.tsx` | RN primitives + BottomSheet | Create/edit exercise (muscle group + equipment chips) |
| `BlockEditSheet.tsx` | RN primitives + BottomSheet | Sets/reps/weight/rest for a template's exercise block |
| `ExercisePickerSheet.tsx` | RN primitives + BottomSheet | Search/pick/create an exercise to add to a template |
```

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/SCHEMA.md apps/mobile/CLAUDE.md
git commit -m "docs(mobile): document exercise library and workout block schema/components"
```

---

### Task 13: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Full unit test suite**

Run: `cd apps/mobile && npm test`
Expected: all tests pass, including the three new files from Tasks 1-3.

- [ ] **Step 3: Report manual verification steps to the user**

This is a native Expo app with no browser preview — actual UI behavior needs to be checked on-device/in-simulator by the user. State clearly which of the following were verified by code review only vs. actually run, and hand the user this checklist:

1. Menu → Workouts → "Exercise Library →" link opens the library.
2. Empty library shows "Add starter exercises" — tapping it populates ~20 exercises grouped by muscle group.
3. "+" in Exercise Library opens `ExerciseEditSheet`; creating one with a muscle group + equipment shows up in the correct group with the right subtitle.
4. Tapping an exercise row opens it pre-filled for editing; long-press offers Rename... actually Edit/Delete.
5. Workouts screen: tapping a template now opens `WorkoutTemplateDetailScreen` (not the old rename sheet); long-press on a template still offers Rename/Delete.
6. In template detail, "+" opens the exercise picker; searching filters; picking an exercise (or creating a new one inline) opens `BlockEditSheet` to set sets/reps/weight/rest.
7. Saving a block shows it in the list with the right summary text (e.g. "4 × 8-12 · 60kg"); drag-reordering blocks works with haptics, same feel as reordering tasks in a Mission.
8. Long-press a block row → Edit reopens `BlockEditSheet` with saved values; Remove from template deletes just the block, not the exercise.

- [ ] **Step 4: Commit (only if Step 3 surfaced fixes)**

If manual verification finds issues, fix them and commit with a description of what was wrong — otherwise no commit needed for this task.
