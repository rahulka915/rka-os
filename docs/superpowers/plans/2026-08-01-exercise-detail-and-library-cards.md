# Exercise Detail Page + Muscle-Group Card Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Turn the exercise library's top level into a grid of muscle-group cards, and give each exercise its own read-only detail page (photo, muscle group/equipment, tips, templates it's used in, and a stats/history placeholder), moving editing behind a pencil icon.

**Architecture:** Three screen-level changes composed from existing pieces — no schema changes. `ExerciseLibraryScreen` is reworked to show a card grid by default (search still returns to a flat list). A new `ExerciseMuscleGroupScreen` renders one group's flat list (today's row style, unchanged). A new `ExerciseDetailScreen` mirrors `HabitDetailScreen`'s header pattern (back chevron + pencil → edit sheet) and adds one new rollup query, `getTemplatesForExercise`, built by composing two existing relation lookups.

**Tech Stack:** React Native + Expo (RN primitives, `StyleSheet.create`, no Tamagui), React Navigation native-stack, SQLite via `expo-sqlite` (`src/db/database.ts`), Node's built-in `test` module for unit tests (`*.test.ts`, run via `node --experimental-strip-types` or the project's existing test script — see Task 1).

## Global Constraints

- No schema or metadata changes — compose existing `itemRelations` rows only (spec: "Data Layer").
- Progress section is a static empty-state placeholder; no real stats/history data — that requires a workout-session/logging subsystem that doesn't exist yet (spec: "Explicitly deferred", "Out of Scope").
- Tips are read-only on the detail page; editing notes stays in `ExerciseEditSheet` (spec: "Out of Scope").
- No delete action on the detail page — delete stays reachable only via long-press in list screens (spec: "Out of Scope").
- `ExerciseMuscleGroupScreen`'s "+" creates with a blank form (no muscle-group prefill) — same create flow as today (spec: "Out of Scope").
- `ExercisePickerSheet` and `WorkoutTemplateDetailScreen` block rows are unaffected — they render their own row markup independently and must not be touched (spec: "Out of Scope").
- Follow existing code conventions: RN primitives + `StyleSheet.create`, theme colors via `useThemeContext()` + `getThemeColors(isDark)`, `LensSurface` as the screen chrome, icons from `../icons`.

---

## File Structure

- **Modify** `apps/mobile/src/db/database.ts` — add `getTemplatesForExercise(exerciseId): Item[]`.
- **Create** `apps/mobile/src/db/database.test.ts` — unit test for the new rollup, unless a suitable existing test file for rollups already exists (checked in Task 1).
- **Modify** `apps/mobile/src/utils/exerciseLibrary.ts` — add a small pure helper, `pickGroupThumbnailImageKey`, used by the new `MuscleGroupCard` to pick a representative photo (keeps the selection logic testable without rendering).
- **Modify** `apps/mobile/src/utils/exerciseLibrary.test.ts` — tests for the new helper.
- **Create** `apps/mobile/src/components/MuscleGroupCard.tsx` — presentational card (label, count, representative photo/placeholder).
- **Modify** `apps/mobile/src/screens/ExerciseLibraryScreen.tsx` — swap the default grouped-list body for the card grid; search still shows the flat filtered list; exercise rows (in search results) now navigate to `ExerciseDetail` instead of opening the edit sheet.
- **Create** `apps/mobile/src/screens/ExerciseMuscleGroupScreen.tsx` — one group's flat list, same row style as today's library rows, tap → `ExerciseDetail`, long-press → Edit/Delete action sheet, "+" → create sheet.
- **Create** `apps/mobile/src/screens/ExerciseDetailScreen.tsx` — hero image, muscle group/equipment badges, Tips, Used In, Progress placeholder; pencil in header opens `ExerciseEditSheet`.
- **Modify** `apps/mobile/src/navigation/MenuStack.tsx` — register `ExerciseMuscleGroup` and `ExerciseDetail` routes.

---

### Task 1: `getTemplatesForExercise` rollup query

**Files:**
- Modify: `apps/mobile/src/db/database.ts` (add near `getProjectsForArea`, database.ts:316-318)
- Test: `apps/mobile/src/db/database.test.ts` (create if no existing test file covers rollup queries — check first with `ls apps/mobile/src/db/*.test.ts`)

**Interfaces:**
- Consumes: `getRelatedItems(targetId: string, relationType: string): Item[]` (database.ts:285-294), `getRelation(sourceId: string, relationType: string): string | null` (database.ts:221-227), `getItemWithMetadata(id: string): Item | null` (database.ts:527-530), `Item` type (`src/db/types.ts`).
- Produces: `getTemplatesForExercise(exerciseId: string): Item[]` — used by Task 4 (`ExerciseDetailScreen`)'s "Used In" section.

Relation shape already established by `WorkoutTemplateDetailScreen.handlePickExercise` (WorkoutTemplateDetailScreen.tsx:77-85): a `workout-block` item has two outgoing relations — `setRelation(blockId, 'exercise', exercise.id)` and `setRelation(blockId, 'workout-template', templateId)`. So blocks pointing at an exercise are found via `getRelatedItems(exerciseId, 'exercise')` (sourceId = block, targetId = exercise), and each block's template via `getRelation(block.id, 'workout-template')`.

- [ ] **Step 1: Check for an existing db test file to extend**

Run: `ls "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/src/db/"*.test.ts 2>/dev/null; ls "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile"/*.test.ts 2>/dev/null; cat "/Users/rahulkrishanand/Downloads/Coding Projects/rka-os/apps/mobile/package.json" | grep -A2 '"test"'`

If a `database.test.ts` (or similar) already exists and runs against a real/mock SQLite instance, add the new test there instead of creating a new file — follow whatever DB setup/teardown pattern it uses. If no such file exists, note that `database.ts` functions call `getDb()` which requires SQLite initialization; in that case write the test using the same lightweight pattern as `exerciseLibrary.test.ts` (plain Node `test`/`assert`, `@ts-nocheck` header) but only if `getDb()` can be exercised in that runner — otherwise skip DB-level testing for this task and rely on manual verification in Task 4's screen wiring (record which path you took before continuing).

- [ ] **Step 2: Write the failing test**

Based on Step 1's findings, add a test asserting: given a template T with two blocks both pointing at exercise E (and a third block pointing at a different exercise), `getTemplatesForExercise(E.id)` returns `[T]` exactly once (dedup via the block-count > template-count case), and returns `[]` for an exercise used nowhere. Use the file's existing setup helpers (`createItem`, `setRelation`) if a DB-backed test file exists:

```typescript
test('getTemplatesForExercise returns each matching template once, deduped across blocks', () => {
  const templateId = createItem('workout-template', 'Push Day', 'active');
  const exerciseId = createItem('exercise', 'Bench Press', 'active');
  const otherExerciseId = createItem('exercise', 'Squat', 'active');

  const block1 = createItem('workout-block', 'Bench Press', 'active');
  setRelation(block1, 'exercise', exerciseId);
  setRelation(block1, 'workout-template', templateId);

  const block2 = createItem('workout-block', 'Bench Press (superset)', 'active');
  setRelation(block2, 'exercise', exerciseId);
  setRelation(block2, 'workout-template', templateId);

  const block3 = createItem('workout-block', 'Squat', 'active');
  setRelation(block3, 'exercise', otherExerciseId);
  setRelation(block3, 'workout-template', templateId);

  const templates = getTemplatesForExercise(exerciseId);
  assert.deepEqual(templates.map((t) => t.id), [templateId]);

  assert.deepEqual(getTemplatesForExercise(otherExerciseId).map((t) => t.id), [templateId]);

  const unusedExerciseId = createItem('exercise', 'Deadlift', 'active');
  assert.deepEqual(getTemplatesForExercise(unusedExerciseId), []);
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `node --test src/db/database.test.ts` (adjust to match the project's actual test command found in Step 1) from `apps/mobile/`.
Expected: FAIL with `getTemplatesForExercise is not a function` (or import error).

- [ ] **Step 4: Implement `getTemplatesForExercise`**

In `apps/mobile/src/db/database.ts`, add directly after `getProjectsForArea` (after line 318):

```typescript
// Rollup: templates that include this exercise, deduped across the (possibly
// multiple) workout-blocks referencing it within the same template.
export function getTemplatesForExercise(exerciseId: string): Item[] {
  const blocks = getRelatedItems(exerciseId, 'exercise');
  const seen = new Set<string>();
  const templates: Item[] = [];
  for (const block of blocks) {
    const templateId = getRelation(block.id, 'workout-template');
    if (templateId && !seen.has(templateId)) {
      seen.add(templateId);
      const template = getItemWithMetadata(templateId);
      if (template) templates.push(template);
    }
  }
  return templates;
}
```

- [ ] **Step 5: Run test to verify it passes**

Run: `node --test src/db/database.test.ts` from `apps/mobile/`.
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/database.ts apps/mobile/src/db/database.test.ts
git commit -m "feat(mobile): add getTemplatesForExercise rollup query"
```

---

### Task 2: `pickGroupThumbnailImageKey` helper + tests

**Files:**
- Modify: `apps/mobile/src/utils/exerciseLibrary.ts`
- Test: `apps/mobile/src/utils/exerciseLibrary.test.ts`

**Interfaces:**
- Consumes: `ExerciseGroup` type (exerciseLibrary.ts:62-66), `parseExerciseMeta` (exerciseLibrary.ts:41-54).
- Produces: `pickGroupThumbnailImageKey(group: ExerciseGroup): string | undefined` — used by Task 3's `MuscleGroupCard`.

Per spec §1: "a representative photo — the first exercise (alphabetical, same ordering `groupExercisesByMuscle` already produces) in that group that has an `imageKey`". Since `group.exercises` is already alphabetically sorted by `groupExercisesByMuscle` (exerciseLibrary.ts:78), this is a simple find-first.

- [ ] **Step 1: Write the failing test**

Append to `apps/mobile/src/utils/exerciseLibrary.test.ts`:

```typescript
test('pickGroupThumbnailImageKey returns the first alphabetical exercise with an imageKey', () => {
  const group = {
    muscleGroup: 'chest' as const,
    label: 'Chest',
    exercises: [
      makeExercise('1', 'Bench Press', { muscleGroup: 'chest' }),
      makeExercise('2', 'Cable Fly', { muscleGroup: 'chest', imageKey: 'CableFly' }),
      makeExercise('3', 'Push-Up', { muscleGroup: 'chest', imageKey: 'PushUp' }),
    ],
  };
  assert.equal(pickGroupThumbnailImageKey(group), 'CableFly');
});

test('pickGroupThumbnailImageKey returns undefined when no exercise in the group has an imageKey', () => {
  const group = {
    muscleGroup: 'legs' as const,
    label: 'Legs',
    exercises: [makeExercise('1', 'Squat', { muscleGroup: 'legs' })],
  };
  assert.equal(pickGroupThumbnailImageKey(group), undefined);
});
```

Add `pickGroupThumbnailImageKey` to the import list at the top of the test file (exerciseLibrary.test.ts:4-10).

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test src/utils/exerciseLibrary.test.ts` from `apps/mobile/`.
Expected: FAIL with `pickGroupThumbnailImageKey is not a function`.

- [ ] **Step 3: Implement the helper**

In `apps/mobile/src/utils/exerciseLibrary.ts`, add after `groupExercisesByMuscle` (after line 81):

```typescript
export function pickGroupThumbnailImageKey(group: ExerciseGroup): string | undefined {
  for (const exercise of group.exercises) {
    const imageKey = parseExerciseMeta(exercise.metadata).imageKey;
    if (imageKey) return imageKey;
  }
  return undefined;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node --test src/utils/exerciseLibrary.test.ts` from `apps/mobile/`.
Expected: PASS (all tests in the file, including pre-existing ones).

- [ ] **Step 5: Commit**

```bash
git add apps/mobile/src/utils/exerciseLibrary.ts apps/mobile/src/utils/exerciseLibrary.test.ts
git commit -m "feat(mobile): add pickGroupThumbnailImageKey helper for library card grid"
```

---

### Task 3: `MuscleGroupCard` component

**Files:**
- Create: `apps/mobile/src/components/MuscleGroupCard.tsx`

**Interfaces:**
- Consumes: `ExerciseThumbnail` (`src/components/ExerciseThumbnail.tsx`, props `{ imageKey?: string; size?: number }`), `MUSCLE_GROUP_LABELS`/`ExerciseGroup` types (`src/utils/exerciseLibrary.ts`), `useThemeContext()` + `getThemeColors(isDark)` (`src/hooks/useThemeContext.ts`, `src/theme`).
- Produces: `MuscleGroupCard` component with props `{ label: string; count: number; imageKey?: string; onPress: () => void }` — consumed by Task 5 (`ExerciseLibraryScreen`'s grid).

This is a presentational component with no data fetching — the parent screen computes `label`/`count`/`imageKey` per group and passes them in. Since `ExerciseThumbnail` only exposes a fixed square (`size`/`size`) with `borderRadius: size/4`, reuse it at a larger size (96) as the card's photo, rather than reimplementing image-loading/placeholder logic.

- [ ] **Step 1: Write the component**

```typescript
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ExerciseThumbnail } from './ExerciseThumbnail';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  imageKey?: string;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, imageKey, onPress }: MuscleGroupCardProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}
      activeOpacity={0.75}
      onPress={onPress}
    >
      <ExerciseThumbnail imageKey={imageKey} size={96} />
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>{label}</Text>
      <Text style={[styles.count, { color: palette.textTertiary }]}>
        {count} exercise{count === 1 ? '' : 's'}
      </Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 16,
    paddingHorizontal: 8,
  },
  label: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  count: { fontSize: 12, fontWeight: '500' },
});
```

- [ ] **Step 2: Manual smoke check**

This component has no unit test (pure presentational RN component with no logic branches beyond what `ExerciseThumbnail` already covers) — it will be exercised visually via Task 5's screen. Run `npx tsc --noEmit` from `apps/mobile/` to confirm it type-checks cleanly against `ExerciseThumbnail`'s props.
Expected: no new type errors introduced by this file.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/MuscleGroupCard.tsx
git commit -m "feat(mobile): add MuscleGroupCard component"
```

---

### Task 4: `ExerciseDetailScreen`

**Files:**
- Create: `apps/mobile/src/screens/ExerciseDetailScreen.tsx`

**Interfaces:**
- Consumes: `getItemWithMetadata(id: string): Item | null`, `getTemplatesForExercise(exerciseId: string): Item[]` (Task 1), `updateItemMetadata`, `updateItemTitle` (`src/db/database.ts`); `parseExerciseMeta`, `formatExerciseSubtitle`, `MUSCLE_GROUP_LABELS`, `EQUIPMENT_LABELS` (`src/utils/exerciseLibrary.ts`); `ExerciseThumbnail` (`src/components/ExerciseThumbnail.tsx`); `ExerciseEditSheet`, `type ExerciseDraft` (`src/components/ExerciseEditSheet.tsx`); `LensSurface` (`src/components/LensSurface.tsx`); `Pencil` icon (`src/icons.tsx`); `useThemeContext`/`getThemeColors`; `useFocusEffect`, `useNavigation`, `useRoute` from `@react-navigation/native`.
- Produces: `ExerciseDetailScreen` component, registered as route name `ExerciseDetail` with params `{ exerciseId: string }` in Task 6.

Route params per spec §3: `{ exerciseId: string }` (not `title` — unlike `HabitDetail`/`WorkoutTemplateDetail`, which also pass a redundant `title`; this screen loads the title itself via `getItemWithMetadata`, matching `HabitDetailScreen`'s pattern of loading the full item rather than trusting a passed title). Header/edit flow mirrors `HabitDetailScreen.tsx:66-91`, but uses `ExerciseEditSheet` (visible/initialValue/onClose/onSubmit) instead of `useItemComposer()`, since that's how `ExerciseLibraryScreen` already edits exercises (ExerciseLibraryScreen.tsx:43-55, 137-142).

- [ ] **Step 1: Write the screen**

```typescript
import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemWithMetadata, getTemplatesForExercise, updateItemMetadata, updateItemTitle } from '../db/database';
import { parseExerciseMeta, formatExerciseSubtitle, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../utils/exerciseLibrary';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { Pencil } from '../icons';
import type { Item } from '../db/types';

interface ExerciseDetailRouteParams {
  exerciseId: string;
}

export function ExerciseDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { exerciseId } = route.params as ExerciseDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const [item, setItem] = useState<Item | null>(null);
  const [templates, setTemplates] = useState<Item[]>([]);
  const [sheetOpen, setSheetOpen] = useState(false);

  const load = useCallback(() => {
    setItem(getItemWithMetadata(exerciseId));
    setTemplates(getTemplatesForExercise(exerciseId));
  }, [exerciseId]);

  useFocusEffect(load);

  const handleSubmit = (draft: ExerciseDraft) => {
    updateItemMetadata(exerciseId, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    if (item && draft.title !== item.title) {
      updateItemTitle(exerciseId, draft.title);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setSheetOpen(false);
    load();
  };

  if (!item) {
    return <LensSurface title="Exercise"><View /></LensSurface>;
  }

  const meta = parseExerciseMeta(item.metadata);

  return (
    <LensSurface
      title={item.title}
      headerRight={
        <TouchableOpacity onPress={() => setSheetOpen(true)} hitSlop={12} accessibilityLabel="Edit exercise">
          <Pencil size={19} color={palette.text} strokeWidth={1.75} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <ExerciseThumbnail imageKey={meta.imageKey} size={200} />
        </View>

        <View style={styles.badgeRow}>
          <View style={[styles.badge, { backgroundColor: palette.fill }]}>
            <Text style={[styles.badgeText, { color: palette.text }]}>{MUSCLE_GROUP_LABELS[meta.muscleGroup]}</Text>
          </View>
          {meta.equipment && (
            <View style={[styles.badge, { backgroundColor: palette.fill }]}>
              <Text style={[styles.badgeText, { color: palette.text }]}>{EQUIPMENT_LABELS[meta.equipment]}</Text>
            </View>
          )}
        </View>

        {meta.notes && (
          <View style={styles.section}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TIPS</Text>
            <Text style={[styles.tipsText, { color: palette.text }]}>{meta.notes}</Text>
          </View>
        )}

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>USED IN</Text>
          {templates.length === 0 ? (
            <Text style={[styles.emptyText, { color: palette.textTertiary }]}>Not used in any template yet</Text>
          ) : (
            templates.map((template) => (
              <TouchableOpacity
                key={template.id}
                style={[styles.templateRow, { borderBottomColor: palette.separator }]}
                onPress={() => (navigation as any).navigate('WorkoutTemplateDetail', { templateId: template.id, title: template.title })}
              >
                <Text style={[styles.templateTitle, { color: palette.text }]} numberOfLines={1}>{template.title}</Text>
              </TouchableOpacity>
            ))
          )}
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PROGRESS</Text>
          <View style={[styles.progressEmpty, { backgroundColor: palette.fill }]}>
            <Text style={[styles.progressEmptyText, { color: palette.textTertiary }]}>
              Log a workout to see stats and history here
            </Text>
          </View>
        </View>
      </ScrollView>

      <ExerciseEditSheet
        visible={sheetOpen}
        initialValue={{ title: item.title, ...meta }}
        onClose={() => setSheetOpen(false)}
        onSubmit={handleSubmit}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 4 },
  hero: { alignItems: 'center', marginBottom: 16 },
  badgeRow: { flexDirection: 'row', gap: 8, marginBottom: 20 },
  badge: { borderRadius: 16, paddingHorizontal: 14, paddingVertical: 8 },
  badgeText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  tipsText: { fontSize: 15, fontWeight: '400', lineHeight: 21 },
  emptyText: { fontSize: 14, fontWeight: '400' },
  templateRow: { paddingVertical: 10, borderBottomWidth: StyleSheet.hairlineWidth },
  templateTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  progressEmpty: { borderRadius: 14, paddingVertical: 20, paddingHorizontal: 16, alignItems: 'center' },
  progressEmptyText: { fontSize: 13, fontWeight: '500', textAlign: 'center' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` from `apps/mobile/`.
Expected: no new errors from `ExerciseDetailScreen.tsx` (route params, `ExerciseEditSheet`/`ExerciseThumbnail` prop shapes should all match — `ExerciseDraft`'s shape is `{ title: string } & ExerciseMeta`, matching `{ title: item.title, ...meta }`).

Note: this screen isn't reachable yet (not registered in Task 6, no callers until Task 5) — full behavioral verification happens after Task 6 registers the route and Task 5 wires navigation into it. No standalone unit test for this task; it's a container component whose only non-trivial logic (`getTemplatesForExercise`, edit submit reusing `ExerciseLibraryScreen`'s exact update pattern) is already covered by Task 1's test and by the existing, unmodified `ExerciseEditSheet`.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/ExerciseDetailScreen.tsx
git commit -m "feat(mobile): add ExerciseDetailScreen"
```

---

### Task 5: `ExerciseMuscleGroupScreen`

**Files:**
- Create: `apps/mobile/src/screens/ExerciseMuscleGroupScreen.tsx`

**Interfaces:**
- Consumes: `useExercises()` (`src/hooks/useDb.ts:200-207`), `groupExercisesByMuscle` (`src/utils/exerciseLibrary.ts`), `createItem`, `updateItemMetadata`, `updateItemTitle`, `deleteItem` (`src/db/database.ts`), `ExerciseEditSheet`/`ExerciseThumbnail`/`LensSurface`, `showActionSheet` (`src/utils/actionSheet.ts`), `Plus` icon.
- Produces: `ExerciseMuscleGroupScreen`, registered as route name `ExerciseMuscleGroup` with params `{ muscleGroup: MuscleGroup; label: string }` in Task 6. Navigates rows to `ExerciseDetail` with `{ exerciseId: item.id }` (Task 4's param shape).

This screen is `ExerciseLibraryScreen`'s row/edit/create/delete logic (ExerciseLibraryScreen.tsx:17-70, 111-142) narrowed to one group, with the row's `onPress` changed to navigate to `ExerciseDetail` instead of opening the edit sheet (spec §2: "Tap a row → navigate to `ExerciseDetailScreen`. Long-press → the same Edit/Delete action sheet").

- [ ] **Step 1: Write the screen**

```typescript
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { groupExercisesByMuscle, formatExerciseSubtitle, parseExerciseMeta, type MuscleGroup } from '../utils/exerciseLibrary';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

interface ExerciseMuscleGroupRouteParams {
  muscleGroup: MuscleGroup;
  label: string;
}

export function ExerciseMuscleGroupScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { muscleGroup, label } = route.params as ExerciseMuscleGroupRouteParams;
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const groupExercises = useMemo(() => {
    const group = groupExercisesByMuscle(exercises).find((g) => g.muscleGroup === muscleGroup);
    return group?.exercises ?? [];
  }, [exercises, muscleGroup]);

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
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
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

  return (
    <LensSurface
      title={label}
      headerRight={
        <TouchableOpacity onPress={openCreate} hitSlop={12} accessibilityLabel="Add exercise">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {groupExercises.map((item) => (
          <TouchableOpacity
            key={item.id}
            style={[styles.row, { backgroundColor: palette.surface }]}
            activeOpacity={0.7}
            onPress={() => (navigation as any).navigate('ExerciseDetail', { exerciseId: item.id })}
            onLongPress={() => handleLongPress(item)}
            delayLongPress={400}
          >
            <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} />
            <View style={styles.rowText}>
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
              <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
              </Text>
            </View>
          </TouchableOpacity>
        ))}
      </ScrollView>

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
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  rowSubtitle: { fontSize: 12, fontWeight: '500' },
});
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` from `apps/mobile/`.
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/screens/ExerciseMuscleGroupScreen.tsx
git commit -m "feat(mobile): add ExerciseMuscleGroupScreen"
```

---

### Task 6: Register `ExerciseMuscleGroup` and `ExerciseDetail` routes

**Files:**
- Modify: `apps/mobile/src/navigation/MenuStack.tsx`

**Interfaces:**
- Consumes: `ExerciseMuscleGroupScreen` (Task 5), `ExerciseDetailScreen` (Task 4).
- Produces: route names `ExerciseMuscleGroup`, `ExerciseDetail` navigable via `navigation.navigate(...)` from within `MenuStack` — used by Task 5 (row press) and Task 7 (`ExerciseLibraryScreen` card press + search-result row press).

- [ ] **Step 1: Add imports and screen registrations**

In `apps/mobile/src/navigation/MenuStack.tsx`, add imports after line 9 (`ExerciseLibraryScreen` import):

```typescript
import { ExerciseMuscleGroupScreen } from '../screens/ExerciseMuscleGroupScreen';
import { ExerciseDetailScreen } from '../screens/ExerciseDetailScreen';
```

Add screen registrations after `<Stack.Screen name="ExerciseLibrary" component={ExerciseLibraryScreen} />` (line 32):

```typescript
<Stack.Screen name="ExerciseMuscleGroup" component={ExerciseMuscleGroupScreen} />
<Stack.Screen name="ExerciseDetail" component={ExerciseDetailScreen} />
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` from `apps/mobile/`.
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/navigation/MenuStack.tsx
git commit -m "feat(mobile): register ExerciseMuscleGroup and ExerciseDetail routes"
```

---

### Task 7: Rework `ExerciseLibraryScreen` to the card grid + detail navigation

**Files:**
- Modify: `apps/mobile/src/screens/ExerciseLibraryScreen.tsx`

**Interfaces:**
- Consumes: `MuscleGroupCard` (Task 3), `pickGroupThumbnailImageKey` (Task 2), route names `ExerciseMuscleGroup`/`ExerciseDetail` (Task 6).
- Produces: reworked `ExerciseLibraryScreen` — no new exports consumed elsewhere.

Per spec §1: default view (no query) = 2-column grid of `MuscleGroupCard`s built from `groupExercisesByMuscle(exercises)` (unchanged grouping/filtering, only the *rendering* of the no-query case changes); typing a query switches to today's flat filtered list (`filterExercisesByQuery`, unchanged); tapping a card navigates to `ExerciseMuscleGroup` with `{ muscleGroup, label }`; tapping a search-result row now navigates to `ExerciseDetail` (`{ exerciseId: item.id }`) instead of opening the edit sheet. The "+" header button and empty-state (no exercises at all) stay as-is — `openEdit`/`handleLongPress`/`ExerciseEditSheet` are now only reachable when there's an active search query (long-press still works on search-result rows, mirroring `ExerciseMuscleGroupScreen`).

- [ ] **Step 1: Replace the file contents**

```typescript
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ExerciseEditSheet, type ExerciseDraft } from '../components/ExerciseEditSheet';
import { ExerciseThumbnail } from '../components/ExerciseThumbnail';
import { MuscleGroupCard } from '../components/MuscleGroupCard';
import {
  groupExercisesByMuscle,
  filterExercisesByQuery,
  formatExerciseSubtitle,
  parseExerciseMeta,
  pickGroupThumbnailImageKey,
} from '../utils/exerciseLibrary';
import { STARTER_EXERCISES } from '../utils/starterExercises';
import { showActionSheet } from '../utils/actionSheet';
import { Plus } from '../icons';
import type { Item } from '../db/types';

export function ExerciseLibraryScreen() {
  const navigation = useNavigation();
  const { exercises, refresh } = useExercises();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [query, setQuery] = useState('');
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const groups = useMemo(() => groupExercisesByMuscle(exercises), [exercises]);
  const searchResults = useMemo(() => (query.trim() ? filterExercisesByQuery(exercises, query) : null), [exercises, query]);

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
      updateItemMetadata(editTarget.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== editTarget.title) {
        updateItemTitle(editTarget.id, draft.title);
      }
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
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
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment, imageKey: starter.imageKey });
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

          {searchResults ? (
            <View style={styles.sectionRows}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>RESULTS</Text>
              {searchResults.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('ExerciseDetail', { exerciseId: item.id })}
                  onLongPress={() => handleLongPress(item)}
                  delayLongPress={400}
                >
                  <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} />
                  <View style={styles.rowText}>
                    <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                    <Text style={[styles.rowSubtitle, { color: palette.textTertiary }]} numberOfLines={1}>
                      {formatExerciseSubtitle(parseExerciseMeta(item.metadata))}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          ) : (
            <View style={styles.grid}>
              {groups.map((group) => (
                <MuscleGroupCard
                  key={group.muscleGroup}
                  label={group.label}
                  count={group.exercises.length}
                  imageKey={pickGroupThumbnailImageKey(group)}
                  onPress={() => (navigation as any).navigate('ExerciseMuscleGroup', { muscleGroup: group.muscleGroup, label: group.label })}
                />
              ))}
            </View>
          )}
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12 },
  sectionRows: { gap: 8, marginBottom: 16 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 12 },
  rowText: { flex: 1, gap: 2 },
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

Note: `styles.grid` uses `flexDirection: 'row'` + `flexWrap: 'wrap'` with each `MuscleGroupCard` set to `flex: 1` (Task 3) — this produces a fluid 2-per-row layout as long as no more than 2 cards fit per row at typical phone widths given the card's `paddingHorizontal: 8` and 96pt thumbnail; if 3 cards end up fitting per row on wider devices, revisit `MuscleGroupCard`'s width to a fixed `%`-based basis instead of `flex: 1` (defer this refinement to Task 8's device check).

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit` from `apps/mobile/`.
Expected: no new errors. `groupExercisesByMuscle` no longer needs the query-time single-group hack (previously synthesized a `{ muscleGroup: 'full-body', label: 'Results', exercises: filtered }` group) — confirm no other file imported that shape from this screen (it didn't; it was local to the removed `groups` memo).

- [ ] **Step 3: Run existing unit tests**

Run: `node --test src/utils/exerciseLibrary.test.ts src/db/database.test.ts` from `apps/mobile/` (adjust paths per Task 1's findings).
Expected: PASS — this task doesn't change `exerciseLibrary.ts` or `database.ts` logic, only screen wiring.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/screens/ExerciseLibraryScreen.tsx
git commit -m "feat(mobile): show muscle-group card grid in exercise library, route to detail page"
```

---

### Task 8: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Type-check the whole app**

Run: `npx tsc --noEmit` from `apps/mobile/`.
Expected: zero errors.

- [ ] **Step 2: Run the full test suite touched by this plan**

Run: `node --test src/utils/exerciseLibrary.test.ts src/db/database.test.ts` from `apps/mobile/` (adjust per Task 1).
Expected: PASS.

- [ ] **Step 3: Launch the dev client and walk the flow**

Start Metro per `apps/mobile/CLAUDE.md`'s Quick Reference (port 8082 per project memory: `npx expo start --dev-client --port 8082`), open on device/simulator, navigate Menu → Workouts → Exercise Library, and verify:
- Default view shows a 2-column card grid (photo/placeholder + label + count) instead of the old flat sectioned list.
- Groups with zero exercises (e.g. `cardio`, if empty) produce no card.
- Typing in search switches to a flat "RESULTS" list; clearing the query returns to the grid.
- Tapping a card opens `ExerciseMuscleGroupScreen` showing only that group's exercises, same row style as before.
- Tapping an exercise row (from the group screen or from search results) opens `ExerciseDetailScreen`, not the edit sheet.
- `ExerciseDetailScreen` shows: hero image (or placeholder), muscle group + equipment badges, Tips (only if notes exist), Used In (templates that reference this exercise, each tappable into `WorkoutTemplateDetailScreen`; "Not used in any template yet" when empty), Progress placeholder text.
- Pencil icon in `ExerciseDetailScreen`'s header opens `ExerciseEditSheet` pre-filled; saving updates the title/badges/tips on return.
- Long-press on a row in `ExerciseMuscleGroupScreen` or in library search results still offers Edit/Delete.
- "+" in `ExerciseMuscleGroupScreen` and the library screen both open a blank create sheet (no muscle-group prefill).
- `ExercisePickerSheet` (from `WorkoutTemplateDetailScreen`'s "+") and `WorkoutTemplateDetailScreen`'s own block rows are unchanged — tapping there still means select/edit-block, not "view exercise detail."

Expected: all of the above behave as described; note and fix any layout issue found in the card grid (e.g. 3-per-row on a wider device, per Task 7's note).

- [ ] **Step 4: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address manual verification findings for exercise detail/library cards"
```

(Skip this step if Step 3 found nothing to fix.)
