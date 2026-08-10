# Web Exercise Library + Workout Template Builder Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bring the desktop/web app (`apps/mobile/src/webApp/`) to parity with mobile's exercise library and workout-template builder — browsing/filtering exercises, an exercise detail panel, and a drag-reorderable exercise block editor for workout templates — adapted to the web app's existing list + sliding-`DetailPanel` idiom instead of a literal port of mobile's navigation-stack screens.

**Architecture:** `WorkoutsScreen.web.tsx` gains a "Templates / Exercises" tab. The Exercises tab is a new single-screen component (`ExerciseLibraryScreen.web.tsx`) that toggles between a muscle-group card grid and a filtered flat list via local state, opening exercises in the existing `DetailPanel`. The Templates tab's `DetailPanel` now renders a new `WorkoutTemplateDetailPanel.web.tsx` (block list, HTML5 drag-reorder, exercise picker modal) instead of the generic `ItemDetailForm` when the selected item is a workout template.

**Tech Stack:** React Native Web (`react-native` primitives run through Expo's web target), `lucide-react-native` icons, `theme/webTheme.ts` tokens (`webColors`/`webSpacing`/`webRadius`/`webFontSize`), native HTML5 drag-and-drop wired onto DOM refs (no React DnD library), the same SQLite/Firestore-mirror data layer (`db/database.ts`, `hooks/useDb.ts`) already shared with mobile.

## Global Constraints

- No schema or new DB-layer functions — every query/helper this plan uses already exists and is platform-agnostic (`db/database.ts`, `utils/exerciseLibrary.ts`, `utils/workoutBlock.ts`).
- Block order uses the same `listKey` format mobile uses: `` `workout-template:${templateId}` `` via `applyManualOrder`/`setManualOrder`, so order is consistent across platforms.
- No new `Sidebar` entry — Exercises stays nested under the Workouts tab (spec: "Out of Scope").
- No nested/stacked `DetailPanel`s — switching which item's panel is open replaces the panel's subject, never stacks a second panel (spec: "Out of Scope").
- Follow the web app's existing conventions: RN primitives + `StyleSheet.create`, `webColors`/`webSpacing`/`webRadius`/`webFontSize` from `theme/webTheme.ts` (not mobile's `useThemeContext`/`getThemeColors`), icons from `lucide-react-native` (not `../icons`), `useDbRefresh` (not raw `useState`+manual refresh) for any new list-reading hook.
- No automated UI tests for new `.web.tsx` screens — verified via `tsc --noEmit` and manual `npm run web` check (spec: "Out of Scope"; matches how this repo has verified web-app screens so far).

---

## File Structure

- **Create** `apps/mobile/src/webApp/hooks/useDomDragAndDrop.ts` — extracted `useDraggableRef`/`useDropZoneRef` (moved verbatim from `CalendarScreen.web.tsx`) plus a new `useMergeRefs` helper for rows that are simultaneously a drag source and a drop target.
- **Modify** `apps/mobile/src/webApp/CalendarScreen.web.tsx` — import the two hooks from the new shared file instead of defining them locally; no behavior change.
- **Create** `apps/mobile/src/webApp/ExerciseThumbnail.web.tsx` — image/placeholder thumbnail, web port of mobile's `components/ExerciseThumbnail.tsx`.
- **Create** `apps/mobile/src/webApp/MuscleGroupCard.web.tsx` — presentational card (label, count, thumbnail).
- **Create** `apps/mobile/src/webApp/ExerciseEditForm.web.tsx` — inline create/edit form (title, muscle-group chips, equipment chips, notes).
- **Create** `apps/mobile/src/webApp/ExerciseDetailPanel.web.tsx` — `DetailPanel` content for viewing one exercise (hero, badges, tips, used-in, progress placeholder).
- **Create** `apps/mobile/src/webApp/ExerciseLibraryScreen.web.tsx` — the "Exercises" tab: card grid / muscle-group flat list / search results, plus its own `DetailPanel` host swapping between `ExerciseDetailPanel` and `ExerciseEditForm`.
- **Create** `apps/mobile/src/webApp/BlockEditForm.web.tsx` — inline sets/reps/weight/rest/notes form for one workout-template block.
- **Create** `apps/mobile/src/webApp/ExercisePickerModal.web.tsx` — centered overlay to search/pick/create an exercise for a template.
- **Create** `apps/mobile/src/webApp/WorkoutTemplateDetailPanel.web.tsx` — `DetailPanel` content for a workout-template item: block list with drag-reorder, add/edit/delete blocks.
- **Modify** `apps/mobile/src/webApp/WorkoutsScreen.web.tsx` — add the Templates/Exercises tab toggle, switch the Templates `DetailPanel` content between `WorkoutTemplateDetailPanel` and `ItemDetailForm`, thread the "Used In" cross-navigation callback into `ExerciseLibraryScreen`.

---

### Task 1: Extract shared DOM drag-and-drop hooks

**Files:**
- Create: `apps/mobile/src/webApp/hooks/useDomDragAndDrop.ts`
- Modify: `apps/mobile/src/webApp/CalendarScreen.web.tsx:1-98` (remove local hook definitions, import from the new file)

**Interfaces:**
- Produces: `useDraggableRef(itemId: string): React.RefObject<any>`, `useDropZoneRef(onDropItemId: (id: string) => void, onHoverChange: (hovering: boolean) => void): React.RefObject<any>`, `useMergeRefs<T>(...refs: Array<React.Ref<T> | undefined>): (node: T) => void` — consumed by Task 10 (`WorkoutTemplateDetailPanel.web.tsx`'s block rows, which need to be both a drag source and a drop target on the same DOM node).

`useDraggableRef`/`useDropZoneRef` are today defined inline in `CalendarScreen.web.tsx:54-98` (see file for exact current code). This task moves them verbatim into a shared file so a second screen can use them without duplicating ~45 lines, and adds `useMergeRefs` (new) since template block rows need both behaviors on one node — `CalendarScreen.web.tsx`'s existing usages only ever need one or the other per component.

- [ ] **Step 1: Create the shared hooks file**

```typescript
import { useCallback, useEffect, useRef } from 'react';

// RNW's Pressable/View don't forward unrecognized props (draggable,
// onDragStart, ...) to the underlying DOM node — there's no first-class RN
// drag API — so drag source/target behavior is wired directly onto the real
// DOM element via a ref instead, in a plain useEffect.
export function useDraggableRef(itemId: string) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.draggable = true;
    node.style.cursor = 'grab';
    const onDragStart = (event: DragEvent) => {
      event.dataTransfer?.setData('text/plain', itemId);
      if (event.dataTransfer) event.dataTransfer.effectAllowed = 'move';
    };
    node.addEventListener('dragstart', onDragStart);
    return () => node.removeEventListener('dragstart', onDragStart);
  }, [itemId]);
  return ref;
}

export function useDropZoneRef(onDropItemId: (id: string) => void, onHoverChange: (hovering: boolean) => void) {
  const ref = useRef<any>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof node.addEventListener !== 'function') return;
    const onDragOver = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(true);
    };
    const onDragLeave = () => onHoverChange(false);
    const onDrop = (event: DragEvent) => {
      event.preventDefault();
      onHoverChange(false);
      const id = event.dataTransfer?.getData('text/plain');
      if (id) onDropItemId(id);
    };
    node.addEventListener('dragover', onDragOver);
    node.addEventListener('dragleave', onDragLeave);
    node.addEventListener('drop', onDrop);
    return () => {
      node.removeEventListener('dragover', onDragOver);
      node.removeEventListener('dragleave', onDragLeave);
      node.removeEventListener('drop', onDrop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ref;
}

// Combines multiple refs onto one DOM node — used where a single element
// (e.g. a reorderable row) must be both a drag source and a drop target,
// which useDraggableRef/useDropZoneRef each expect their own ref for.
export function useMergeRefs<T>(...refs: Array<React.Ref<T> | undefined>) {
  return useCallback(
    (node: T) => {
      for (const ref of refs) {
        if (typeof ref === 'function') ref(node);
        else if (ref && typeof ref === 'object') (ref as React.MutableRefObject<T | null>).current = node;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    refs,
  );
}
```

- [ ] **Step 2: Update `CalendarScreen.web.tsx` to import instead of defining locally**

Remove lines 50-98 of `apps/mobile/src/webApp/CalendarScreen.web.tsx` (the `useDraggableRef`/`useDropZoneRef` definitions and their preceding comment) and add an import alongside the other local imports at the top of the file:

```typescript
import { useDraggableRef, useDropZoneRef } from './hooks/useDomDragAndDrop';
```

Also remove `useRef` from the `react` import at line 1 if it's no longer used elsewhere in the file after this change (check with a search for `useRef(` in the remaining file — if no other usage exists, change `import { useEffect, useRef, useState } from 'react';` to `import { useEffect, useState } from 'react';`).

- [ ] **Step 3: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -iE "CalendarScreen|useDomDragAndDrop"`
Expected: no output (no errors from either file).

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/webApp/hooks/useDomDragAndDrop.ts apps/mobile/src/webApp/CalendarScreen.web.tsx
git commit -m "refactor(mobile): extract shared DOM drag-and-drop hooks for web app

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 2: `ExerciseThumbnail.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/ExerciseThumbnail.web.tsx`

**Interfaces:**
- Consumes: `EXERCISE_IMAGES` (`apps/mobile/src/utils/exerciseImages.ts` — same static require-registry mobile uses, path from `webApp/` is `'../utils/exerciseImages'`), `webColors` (`../theme/webTheme`), `Dumbbell` icon (`lucide-react-native`).
- Produces: `ExerciseThumbnail` component, props `{ imageKey?: string; size?: number }` (default `size = 40`) — consumed by Tasks 3, 5, 6, 8, 10.

Web port of mobile's `apps/mobile/src/components/ExerciseThumbnail.tsx` — same logic, different theme tokens/icon source (mobile uses `useThemeContext`/`getThemeColors`/`../icons`; web uses `webColors` directly, since the web app has no dark-mode React-state dependency — theme is CSS-variable-driven per `theme/webTheme.ts`'s file comment).

- [ ] **Step 1: Write the component**

```typescript
import { Image, StyleSheet, View } from 'react-native';
import { Dumbbell } from 'lucide-react-native';
import { EXERCISE_IMAGES } from '../utils/exerciseImages';
import { webColors } from '../theme/webTheme';

interface ExerciseThumbnailProps {
  imageKey?: string;
  size?: number;
}

export function ExerciseThumbnail({ imageKey, size = 40 }: ExerciseThumbnailProps) {
  const source = imageKey ? EXERCISE_IMAGES[imageKey] : undefined;
  const dimensions = { width: size, height: size, borderRadius: size / 4 };

  if (source) {
    return <Image source={source} style={[styles.image, dimensions]} resizeMode="cover" />;
  }

  return (
    <View style={[styles.placeholder, dimensions, { backgroundColor: webColors.muted }]}>
      <Dumbbell size={size * 0.5} color={webColors.mutedForeground} strokeWidth={1.75} />
    </View>
  );
}

const styles = StyleSheet.create({
  image: {},
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "ExerciseThumbnail.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ExerciseThumbnail.web.tsx
git commit -m "feat(mobile): add web ExerciseThumbnail

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 3: `MuscleGroupCard.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/MuscleGroupCard.web.tsx`

**Interfaces:**
- Consumes: `ExerciseThumbnail` (Task 2), `webColors`/`webSpacing`/`webRadius`/`webFontSize` (`../theme/webTheme`).
- Produces: `MuscleGroupCard` component, props `{ label: string; count: number; imageKey?: string; onPress: () => void }` — consumed by Task 6 (`ExerciseLibraryScreen.web.tsx`'s grid).

Mobile's equivalent (`apps/mobile/src/components/MuscleGroupCard.tsx`) uses `width: '47%', aspectRatio: 1` (a fixed-percentage width, not `flex: 1`) to reliably get a 2-per-row grid regardless of available width — mirror that sizing approach here rather than `flex: 1`, which risks 3-per-row on wide desktop viewports.

- [ ] **Step 1: Write the component**

```typescript
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface MuscleGroupCardProps {
  label: string;
  count: number;
  imageKey?: string;
  onPress: () => void;
}

export function MuscleGroupCard({ label, count, imageKey, onPress }: MuscleGroupCardProps) {
  return (
    <Pressable style={styles.card} onPress={onPress}>
      <ExerciseThumbnail imageKey={imageKey} size={72} />
      <Text style={styles.label} numberOfLines={1}>{label}</Text>
      <Text style={styles.count}>
        {count} exercise{count === 1 ? '' : 's'}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    width: '31%',
    alignItems: 'center',
    gap: webSpacing[1],
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    backgroundColor: webColors.card,
    paddingVertical: webSpacing[4],
    paddingHorizontal: webSpacing[2],
  },
  label: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  count: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
});
```

Note: `width: '31%'` targets a 3-per-row grid on the desktop web app's wider viewport (unlike mobile's 2-per-row `47%`) — this is a deliberate divergence, not a bug, since the web app has substantially more horizontal space than a phone screen. Adjust in Task 11's manual check if it looks cramped or sparse at typical browser widths.

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "MuscleGroupCard.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/MuscleGroupCard.web.tsx
git commit -m "feat(mobile): add web MuscleGroupCard

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 4: `ExerciseEditForm.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/ExerciseEditForm.web.tsx`

**Interfaces:**
- Consumes: `ExerciseDraft` type (`../components/ExerciseEditSheet` — type-only import), `MUSCLE_GROUPS`, `MUSCLE_GROUP_LABELS`, `EQUIPMENT_OPTIONS`, `EQUIPMENT_LABELS`, `MuscleGroup`, `Equipment` (`../utils/exerciseLibrary`), `webColors`/`webSpacing`/`webRadius`/`webFontSize`.
- Produces: `ExerciseEditForm` component, props `{ initialValue?: ExerciseDraft; onSubmit: (draft: ExerciseDraft) => void; onCancel: () => void }` — consumed by Task 5 (`ExerciseDetailPanel`'s edit mode via `ExerciseLibraryScreen`), Task 6 (`ExerciseLibraryScreen`'s create flow), and Task 8 (`ExercisePickerModal`'s "+ New Exercise").

Mirrors `ItemDetailForm.web.tsx`'s chip-row visual pattern (`label` + `chipRow` + `chip`/`chipActive`) for muscle-group/equipment selection, and mobile's `ExerciseEditSheet.tsx` for field set and validation (title required, equipment optional with an "Any" clearing option).

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type MuscleGroup,
} from '../utils/exerciseLibrary';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface ExerciseEditFormProps {
  initialValue?: ExerciseDraft;
  onSubmit: (draft: ExerciseDraft) => void;
  onCancel: () => void;
}

export function ExerciseEditForm({ initialValue, onSubmit, onCancel }: ExerciseEditFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initialValue?.muscleGroup ?? 'full-body');
  const [equipment, setEquipment] = useState<Equipment | undefined>(initialValue?.equipment);
  const [notes, setNotes] = useState(initialValue?.notes ?? '');

  useEffect(() => {
    setTitle(initialValue?.title ?? '');
    setMuscleGroup(initialValue?.muscleGroup ?? 'full-body');
    setEquipment(initialValue?.equipment);
    setNotes(initialValue?.notes ?? '');
  }, [initialValue]);

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({ title: trimmed, muscleGroup, equipment, notes: notes.trim() || undefined, imageKey: initialValue?.imageKey });
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Exercise name..."
        placeholderTextColor={webColors.mutedForeground}
        style={styles.titleInput}
      />

      <View>
        <Text style={styles.label}>Muscle Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {MUSCLE_GROUPS.map((group) => {
              const active = muscleGroup === group;
              return (
                <Pressable
                  key={group}
                  onPress={() => setMuscleGroup(group)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{MUSCLE_GROUP_LABELS[group]}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View>
        <Text style={styles.label}>Equipment</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setEquipment(undefined)} style={[styles.chip, !equipment && styles.chipActive]}>
              <Text style={[styles.chipText, !equipment && styles.chipTextActive]}>Any</Text>
            </Pressable>
            {EQUIPMENT_OPTIONS.map((option) => {
              const active = equipment === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setEquipment(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{EQUIPMENT_LABELS[option]}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Form cues, optional..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.notesInput}
          multiline
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={!title.trim()} style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: webSpacing[4] },
  titleInput: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
    padding: 0,
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  chipRow: { flexDirection: 'row', gap: webSpacing[2], paddingRight: webSpacing[2] },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  chipActive: { backgroundColor: webColors.accent },
  chipText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.mutedForeground },
  chipTextActive: { color: webColors.card },
  notesInput: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: webSpacing[3] },
  cancelButton: { paddingVertical: webSpacing[2], paddingHorizontal: webSpacing[3] },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  saveButton: {
    paddingVertical: webSpacing[2],
    paddingHorizontal: webSpacing[4],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontSize: webFontSize.sm, color: webColors.card, fontWeight: '700' },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "ExerciseEditForm.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ExerciseEditForm.web.tsx
git commit -m "feat(mobile): add web ExerciseEditForm

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 5: `ExerciseDetailPanel.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/ExerciseDetailPanel.web.tsx`

**Interfaces:**
- Consumes: `getTemplatesForExercise` (`../db/database`), `parseExerciseMeta`, `MUSCLE_GROUP_LABELS`, `EQUIPMENT_LABELS` (`../utils/exerciseLibrary`), `ExerciseThumbnail` (Task 2), `useDbRefresh` (`../hooks/useDb`).
- Produces: `ExerciseDetailPanel` component, props `{ item: Item; onEdit: () => void; onOpenTemplate: (templateId: string, title: string) => void }` — consumed by Task 6 (`ExerciseLibraryScreen`'s `DetailPanel` host).

Mirrors `HabitDetailPanel.web.tsx`'s structure (header row with pencil, `useDbRefresh`-driven local state) applied to an exercise instead of a habit.

- [ ] **Step 1: Write the component**

```typescript
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil } from 'lucide-react-native';
import { getTemplatesForExercise } from '../db/database';
import { parseExerciseMeta, MUSCLE_GROUP_LABELS, EQUIPMENT_LABELS } from '../utils/exerciseLibrary';
import { useDbRefresh } from '../hooks/useDb';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface ExerciseDetailPanelProps {
  item: Item;
  onEdit: () => void;
  onOpenTemplate: (templateId: string, title: string) => void;
}

export function ExerciseDetailPanel({ item, onEdit, onOpenTemplate }: ExerciseDetailPanelProps) {
  const [templates, setTemplates] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setTemplates(getTemplatesForExercise(item.id));
  }, [item.id]);
  useDbRefresh(refresh);

  const meta = parseExerciseMeta(item.metadata);

  return (
    <ScrollView showsVerticalScrollIndicator={false}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEdit} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      <View style={styles.hero}>
        <ExerciseThumbnail imageKey={meta.imageKey} size={160} />
      </View>

      <View style={styles.badgeRow}>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{MUSCLE_GROUP_LABELS[meta.muscleGroup]}</Text>
        </View>
        {meta.equipment ? (
          <View style={styles.badge}>
            <Text style={styles.badgeText}>{EQUIPMENT_LABELS[meta.equipment]}</Text>
          </View>
        ) : null}
      </View>

      {meta.notes ? (
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>Tips</Text>
          <Text style={styles.tipsText}>{meta.notes}</Text>
        </View>
      ) : null}

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Used In</Text>
        {templates.length === 0 ? (
          <Text style={styles.emptyText}>Not used in any template yet</Text>
        ) : (
          templates.map((template) => (
            <Pressable
              key={template.id}
              style={styles.templateRow}
              onPress={() => onOpenTemplate(template.id, template.title)}
            >
              <Text style={styles.templateTitle} numberOfLines={1}>{template.title}</Text>
            </Pressable>
          ))
        )}
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>Progress</Text>
        <View style={styles.progressEmpty}>
          <Text style={styles.progressEmptyText}>Log a workout to see stats and history here</Text>
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.lg,
    fontWeight: '700',
    color: webColors.foreground,
    flex: 1,
    marginRight: webSpacing[3],
  },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  hero: { alignItems: 'center', marginBottom: webSpacing[4] },
  badgeRow: { flexDirection: 'row', gap: webSpacing[2], marginBottom: webSpacing[5] },
  badge: {
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
  },
  badgeText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  section: { marginBottom: webSpacing[5] },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  tipsText: { fontSize: webFontSize.sm, color: webColors.foreground, lineHeight: 20 },
  emptyText: { fontSize: webFontSize.sm, color: webColors.mutedForeground },
  templateRow: { paddingVertical: webSpacing[2], borderBottomWidth: 1, borderBottomColor: webColors.border },
  templateTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  progressEmpty: {
    borderRadius: webRadius.md,
    backgroundColor: webColors.muted,
    paddingVertical: webSpacing[4],
    paddingHorizontal: webSpacing[3],
    alignItems: 'center',
  },
  progressEmptyText: { fontSize: webFontSize.xs, color: webColors.mutedForeground, textAlign: 'center' },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "ExerciseDetailPanel.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ExerciseDetailPanel.web.tsx
git commit -m "feat(mobile): add web ExerciseDetailPanel

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 6: `ExerciseLibraryScreen.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/ExerciseLibraryScreen.web.tsx`

**Interfaces:**
- Consumes: `useExercises` (`../hooks/useDb`), `createItem`, `updateItemMetadata`, `updateItemTitle`, `deleteItem` (`../db/database`), `groupExercisesByMuscle`, `filterExercisesByQuery`, `pickGroupThumbnailImageKey`, `parseExerciseMeta`, `formatExerciseSubtitle`, `type MuscleGroup` (`../utils/exerciseLibrary`), `STARTER_EXERCISES` (`../utils/starterExercises`), `MuscleGroupCard` (Task 3), `ExerciseThumbnail` (Task 2), `ExerciseDetailPanel` (Task 5), `ExerciseEditForm` (Task 4), `ExerciseDraft` type (`../components/ExerciseEditSheet`), `DetailPanel` (`./DetailPanel`).
- Produces: `ExerciseLibraryScreen` component, props `{ onOpenTemplate: (templateId: string, title: string) => void }` — consumed by Task 11 (`WorkoutsScreen.web.tsx`'s Exercises tab).

- [ ] **Step 1: Write the component**

```typescript
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata, updateItemTitle, deleteItem } from '../db/database';
import {
  groupExercisesByMuscle,
  filterExercisesByQuery,
  pickGroupThumbnailImageKey,
  parseExerciseMeta,
  formatExerciseSubtitle,
  type MuscleGroup,
} from '../utils/exerciseLibrary';
import { STARTER_EXERCISES } from '../utils/starterExercises';
import { MuscleGroupCard } from './MuscleGroupCard.web';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { ExerciseDetailPanel } from './ExerciseDetailPanel.web';
import { ExerciseEditForm } from './ExerciseEditForm.web';
import { DetailPanel } from './DetailPanel';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface ExerciseLibraryScreenProps {
  onOpenTemplate: (templateId: string, title: string) => void;
}

export function ExerciseLibraryScreen({ onOpenTemplate }: ExerciseLibraryScreenProps) {
  const { exercises, refresh } = useExercises();
  const [query, setQuery] = useState('');
  const [selectedMuscleGroup, setSelectedMuscleGroup] = useState<MuscleGroup | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'create' | 'edit'>('detail');

  const groups = useMemo(() => groupExercisesByMuscle(exercises), [exercises]);
  const searchResults = useMemo(() => (query.trim() ? filterExercisesByQuery(exercises, query) : null), [exercises, query]);
  const groupExercises = useMemo(
    () => (selectedMuscleGroup ? groups.find((g) => g.muscleGroup === selectedMuscleGroup)?.exercises ?? [] : []),
    [groups, selectedMuscleGroup],
  );
  const selectedItem = exercises.find((e) => e.id === selectedId) ?? null;

  const submitEdit = (draft: ExerciseDraft) => {
    if (mode === 'edit' && selectedItem) {
      updateItemMetadata(selectedItem.id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      if (draft.title !== selectedItem.title) updateItemTitle(selectedItem.id, draft.title);
      setMode('detail');
    } else {
      const id = createItem('exercise', draft.title, 'active');
      updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
      setSelectedId(null);
    }
    refresh();
  };

  const addStarters = () => {
    for (const starter of STARTER_EXERCISES) {
      const id = createItem('exercise', starter.title, 'active');
      updateItemMetadata(id, { muscleGroup: starter.muscleGroup, equipment: starter.equipment, imageKey: starter.imageKey });
    }
    refresh();
  };

  const rows = searchResults ?? groupExercises;
  const showingRows = !!searchResults || !!selectedMuscleGroup;

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Exercises</Text>
        <Pressable onPress={() => { setMode('create'); setSelectedId(null); }} style={styles.addButton}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        </Pressable>
      </View>

      {exercises.length === 0 ? (
        <View style={styles.empty}>
          <Text style={styles.emptyTitle}>No exercises yet</Text>
          <Pressable onPress={addStarters} style={styles.startersButton}>
            <Text style={styles.startersButtonText}>Add starter exercises</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <TextInput
            value={query}
            onChangeText={setQuery}
            placeholder="Search exercises..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.search}
          />

          {showingRows ? (
            <View>
              {!searchResults && selectedMuscleGroup ? (
                <Pressable onPress={() => setSelectedMuscleGroup(null)}>
                  <Text style={styles.backLink}>‹ Back to groups</Text>
                </Pressable>
              ) : null}
              <View style={styles.rowsList}>
                {rows.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.row}
                    onPress={() => { setSelectedId(item.id); setMode('detail'); }}
                  >
                    <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={36} />
                    <View style={styles.rowText}>
                      <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.rowSubtitle} numberOfLines={1}>{formatExerciseSubtitle(parseExerciseMeta(item.metadata))}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </View>
          ) : (
            <View style={styles.grid}>
              {groups.map((group) => (
                <MuscleGroupCard
                  key={group.muscleGroup}
                  label={group.label}
                  count={group.exercises.length}
                  imageKey={pickGroupThumbnailImageKey(group)}
                  onPress={() => setSelectedMuscleGroup(group.muscleGroup)}
                />
              ))}
            </View>
          )}
        </ScrollView>
      )}

      <DetailPanel
        visible={mode === 'create' || (!!selectedItem && (mode === 'detail' || mode === 'edit'))}
        onClose={() => { setSelectedId(null); setMode('detail'); }}
        title={mode === 'create' ? 'New Exercise' : mode === 'edit' ? 'Edit Exercise' : 'Exercise'}
      >
        {mode === 'create' ? (
          <ExerciseEditForm onSubmit={submitEdit} onCancel={() => setMode('detail')} />
        ) : mode === 'edit' && selectedItem ? (
          <ExerciseEditForm
            initialValue={{ title: selectedItem.title, ...parseExerciseMeta(selectedItem.metadata) }}
            onSubmit={submitEdit}
            onCancel={() => setMode('detail')}
          />
        ) : selectedItem ? (
          <ExerciseDetailPanel
            item={selectedItem}
            onEdit={() => setMode('edit')}
            onOpenTemplate={(templateId, title) => {
              setSelectedId(null);
              onOpenTemplate(templateId, title);
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  title: { fontSize: webFontSize.xl, fontWeight: '700', color: webColors.foreground },
  addButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  content: { paddingBottom: webSpacing[6] },
  search: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  backLink: { fontSize: webFontSize.sm, color: webColors.accent, fontWeight: '600', marginBottom: webSpacing[3] },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: webSpacing[3] },
  rowsList: { gap: webSpacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.base, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: webSpacing[3] },
  emptyTitle: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  startersButton: { backgroundColor: webColors.accent, borderRadius: webRadius.sm, paddingHorizontal: webSpacing[4], paddingVertical: webSpacing[3] },
  startersButtonText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.card },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "ExerciseLibraryScreen.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ExerciseLibraryScreen.web.tsx
git commit -m "feat(mobile): add web ExerciseLibraryScreen

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 7: `BlockEditForm.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/BlockEditForm.web.tsx`

**Interfaces:**
- Consumes: `type WorkoutBlockMeta` (`../utils/workoutBlock`).
- Produces: `BlockEditForm` component, props `{ exerciseTitle: string; initialValue?: WorkoutBlockMeta; onSubmit: (meta: WorkoutBlockMeta) => void; onCancel: () => void; onDelete: () => void }` — consumed by Task 10 (`WorkoutTemplateDetailPanel.web.tsx`).

- [ ] **Step 1: Write the component**

```typescript
import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import type { WorkoutBlockMeta } from '../utils/workoutBlock';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface BlockEditFormProps {
  exerciseTitle: string;
  initialValue?: WorkoutBlockMeta;
  onSubmit: (meta: WorkoutBlockMeta) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function toIntOrUndefined(text: string): number | undefined {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function BlockEditForm({ exerciseTitle, initialValue, onSubmit, onCancel, onDelete }: BlockEditFormProps) {
  const [sets, setSets] = useState(initialValue?.sets ? String(initialValue.sets) : '');
  const [reps, setReps] = useState(initialValue?.reps ?? '');
  const [weight, setWeight] = useState(initialValue?.weight ?? '');
  const [restSeconds, setRestSeconds] = useState(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
  const [notes, setNotes] = useState(initialValue?.notes ?? '');

  useEffect(() => {
    setSets(initialValue?.sets ? String(initialValue.sets) : '');
    setReps(initialValue?.reps ?? '');
    setWeight(initialValue?.weight ?? '');
    setRestSeconds(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
    setNotes(initialValue?.notes ?? '');
  }, [initialValue]);

  const handleSave = () => {
    onSubmit({
      sets: toIntOrUndefined(sets),
      reps: reps.trim() || undefined,
      weight: weight.trim() || undefined,
      restSeconds: toIntOrUndefined(restSeconds),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{exerciseTitle}</Text>

      <View>
        <Text style={styles.label}>Sets</Text>
        <TextInput value={sets} onChangeText={setSets} placeholder="4" placeholderTextColor={webColors.mutedForeground} style={styles.input} keyboardType="number-pad" />
      </View>
      <View>
        <Text style={styles.label}>Reps</Text>
        <TextInput value={reps} onChangeText={setReps} placeholder="8-12" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
      </View>
      <View>
        <Text style={styles.label}>Weight</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="60kg or bodyweight" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
      </View>
      <View>
        <Text style={styles.label}>Rest (seconds)</Text>
        <TextInput value={restSeconds} onChangeText={setRestSeconds} placeholder="90" placeholderTextColor={webColors.mutedForeground} style={styles.input} keyboardType="number-pad" />
      </View>
      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={webColors.mutedForeground} style={[styles.input, styles.notesInput]} multiline />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <Pressable onPress={onDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Remove from template</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: webSpacing[4] },
  title: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[1],
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: webSpacing[3] },
  cancelButton: { paddingVertical: webSpacing[2], paddingHorizontal: webSpacing[3] },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  saveButton: {
    paddingVertical: webSpacing[2],
    paddingHorizontal: webSpacing[4],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  saveText: { fontSize: webFontSize.sm, color: webColors.card, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: webSpacing[2], marginTop: webSpacing[2] },
  deleteLabel: { fontSize: webFontSize.sm, color: webColors.destructive, fontWeight: '600' },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "BlockEditForm.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/BlockEditForm.web.tsx
git commit -m "feat(mobile): add web BlockEditForm

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 8: `ExercisePickerModal.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/ExercisePickerModal.web.tsx`

**Interfaces:**
- Consumes: `useExercises` (`../hooks/useDb`), `createItem`, `updateItemMetadata` (`../db/database`), `groupExercisesByMuscle`, `filterExercisesByQuery`, `formatExerciseSubtitle`, `parseExerciseMeta` (`../utils/exerciseLibrary`), `ExerciseThumbnail` (Task 2), `ExerciseEditForm` (Task 4), `ExerciseDraft` type.
- Produces: `ExercisePickerModal` component, props `{ visible: boolean; onClose: () => void; onPick: (exercise: Item) => void }` — consumed by Task 10 (`WorkoutTemplateDetailPanel.web.tsx`'s "+ Add exercise").

Centered overlay (own backdrop, not `DetailPanel`) per spec — avoids a second slide-in panel while a template's `DetailPanel` is already open.

- [ ] **Step 1: Write the component**

```typescript
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useExercises } from '../hooks/useDb';
import { createItem, updateItemMetadata } from '../db/database';
import { groupExercisesByMuscle, filterExercisesByQuery, formatExerciseSubtitle, parseExerciseMeta } from '../utils/exerciseLibrary';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { ExerciseEditForm } from './ExerciseEditForm.web';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface ExercisePickerModalProps {
  visible: boolean;
  onClose: () => void;
  onPick: (exercise: Item) => void;
}

export function ExercisePickerModal({ visible, onClose, onPick }: ExercisePickerModalProps) {
  const { exercises, refresh } = useExercises();
  const [query, setQuery] = useState('');
  const [creating, setCreating] = useState(false);

  const groups = useMemo(() => {
    if (query.trim()) {
      const filtered = filterExercisesByQuery(exercises, query);
      return filtered.length ? [{ muscleGroup: 'full-body' as const, label: 'Results', exercises: filtered }] : [];
    }
    return groupExercisesByMuscle(exercises);
  }, [exercises, query]);

  if (!visible) return null;

  const handlePick = (item: Item) => {
    setQuery('');
    setCreating(false);
    onClose();
    onPick(item);
  };

  const handleCreateSubmit = (draft: ExerciseDraft) => {
    const id = createItem('exercise', draft.title, 'active');
    updateItemMetadata(id, { muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey });
    refresh();
    const created: Item = {
      id,
      type: 'exercise',
      title: draft.title,
      status: 'active',
      metadata: JSON.stringify({ muscleGroup: draft.muscleGroup, equipment: draft.equipment, notes: draft.notes, imageKey: draft.imageKey }),
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    setCreating(false);
    setQuery('');
    onClose();
    onPick(created);
  };

  return (
    <View style={styles.overlay}>
      <Pressable style={styles.backdrop} onPress={onClose} />
      <View style={styles.dialog}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>{creating ? 'New Exercise' : 'Add Exercise'}</Text>
          <Pressable onPress={onClose}>
            <Text style={styles.cancelText}>Cancel</Text>
          </Pressable>
        </View>

        {creating ? (
          <ExerciseEditForm onSubmit={handleCreateSubmit} onCancel={() => setCreating(false)} />
        ) : (
          <>
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Search exercises..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.search}
            />
            <Pressable onPress={() => setCreating(true)} style={styles.newRow}>
              <Text style={styles.newRowText}>+ New Exercise</Text>
            </Pressable>
            <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
              {groups.map((group) => (
                <View key={group.muscleGroup + group.label} style={styles.sectionRows}>
                  <Text style={styles.sectionLabel}>{group.label.toUpperCase()}</Text>
                  {group.exercises.map((item) => (
                    <Pressable key={item.id} style={styles.row} onPress={() => handlePick(item)}>
                      <ExerciseThumbnail imageKey={parseExerciseMeta(item.metadata).imageKey} size={32} />
                      <View style={styles.rowText}>
                        <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                        <Text style={styles.rowSubtitle} numberOfLines={1}>{formatExerciseSubtitle(parseExerciseMeta(item.metadata))}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              ))}
            </ScrollView>
          </>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 30,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(15,23,42,0.25)',
  },
  dialog: {
    width: 420,
    maxHeight: '80%',
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    borderWidth: 1,
    borderColor: webColors.border,
    padding: webSpacing[5],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: webSpacing[4],
  },
  headerTitle: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  search: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[3],
  },
  newRow: {
    borderWidth: 1,
    borderColor: webColors.border,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    marginBottom: webSpacing[3],
  },
  newRowText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.accent },
  list: { maxHeight: 360 },
  sectionRows: { gap: webSpacing[2], marginBottom: webSpacing[4] },
  sectionLabel: { fontSize: webFontSize.xs, fontWeight: '700', color: webColors.mutedForeground, letterSpacing: 0.5, marginBottom: webSpacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: webSpacing[2], paddingVertical: webSpacing[2] },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "ExercisePickerModal.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/ExercisePickerModal.web.tsx
git commit -m "feat(mobile): add web ExercisePickerModal

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 9: `WorkoutTemplateDetailPanel.web.tsx`

**Files:**
- Create: `apps/mobile/src/webApp/WorkoutTemplateDetailPanel.web.tsx`

**Interfaces:**
- Consumes: `getRelatedItems`, `applyManualOrder`, `setManualOrder`, `createItem`, `setRelation`, `getRelation`, `updateItemMetadata`, `deleteItem`, `getItemWithMetadata` (`../db/database`), `parseBlockMeta`, `formatBlockSummary`, `type WorkoutBlockMeta` (`../utils/workoutBlock`), `parseExerciseMeta` (`../utils/exerciseLibrary`), `ExerciseThumbnail` (Task 2), `BlockEditForm` (Task 7), `ExercisePickerModal` (Task 8), `useDraggableRef`, `useDropZoneRef`, `useMergeRefs` (Task 1), `useDbRefresh` (`../hooks/useDb`).
- Produces: `WorkoutTemplateDetailPanel` component, props `{ item: Item; onEditDetails: () => void }` — consumed by Task 11 (`WorkoutsScreen.web.tsx`'s Templates `DetailPanel`).

Query shape and `listKey` format (`` `workout-template:${item.id}` ``) match mobile's `WorkoutTemplateDetailScreen.tsx` exactly, so block order is shared across platforms.

- [ ] **Step 1: Write the component**

```typescript
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Pencil, Plus } from 'lucide-react-native';
import {
  getRelatedItems,
  applyManualOrder,
  setManualOrder,
  createItem,
  setRelation,
  getRelation,
  updateItemMetadata,
  deleteItem,
  getItemWithMetadata,
} from '../db/database';
import { parseBlockMeta, formatBlockSummary, type WorkoutBlockMeta } from '../utils/workoutBlock';
import { parseExerciseMeta } from '../utils/exerciseLibrary';
import { useDbRefresh } from '../hooks/useDb';
import { ExerciseThumbnail } from './ExerciseThumbnail.web';
import { BlockEditForm } from './BlockEditForm.web';
import { ExercisePickerModal } from './ExercisePickerModal.web';
import { useDraggableRef, useDropZoneRef, useMergeRefs } from './hooks/useDomDragAndDrop';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

interface WorkoutTemplateDetailPanelProps {
  item: Item;
  onEditDetails: () => void;
}

interface BlockRow {
  block: Item;
  exerciseTitle: string;
  exerciseImageKey?: string;
}

interface BlockRowItemProps {
  row: BlockRow;
  onPress: () => void;
  onReorderDrop: (draggedId: string) => void;
}

function BlockRowItem({ row, onPress, onReorderDrop }: BlockRowItemProps) {
  const [hovering, setHovering] = useState(false);
  const dragRef = useDraggableRef(row.block.id);
  const dropRef = useDropZoneRef(onReorderDrop, setHovering);
  const mergedRef = useMergeRefs(dragRef, dropRef);

  return (
    <Pressable ref={mergedRef} style={[styles.row, hovering && styles.rowHovering]} onPress={onPress}>
      <ExerciseThumbnail imageKey={row.exerciseImageKey} size={32} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>{row.exerciseTitle}</Text>
        <Text style={styles.rowSubtitle} numberOfLines={1}>{formatBlockSummary(parseBlockMeta(row.block.metadata))}</Text>
      </View>
    </Pressable>
  );
}

export function WorkoutTemplateDetailPanel({ item, onEditDetails }: WorkoutTemplateDetailPanelProps) {
  const [rows, setRows] = useState<BlockRow[]>([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const listKey = `workout-template:${item.id}`;

  const refresh = useCallback(() => {
    const blocks = applyManualOrder(listKey, getRelatedItems(item.id, 'workout-template'));
    const nextRows: BlockRow[] = blocks.map((block) => {
      const exerciseId = getRelation(block.id, 'exercise');
      const exercise = exerciseId ? getItemWithMetadata(exerciseId) : null;
      return {
        block,
        exerciseTitle: exercise?.title ?? block.title,
        exerciseImageKey: exercise ? parseExerciseMeta(exercise.metadata).imageKey : undefined,
      };
    });
    setRows(nextRows);
  }, [item.id, listKey]);

  useDbRefresh(refresh);

  const editingRow = rows.find((r) => r.block.id === editingBlockId) ?? null;

  const handlePickExercise = (exercise: Item) => {
    const blockId = createItem('workout-block', exercise.title, 'active');
    setRelation(blockId, 'exercise', exercise.id);
    setRelation(blockId, 'workout-template', item.id);
    updateItemMetadata(blockId, {});
    refresh();
    setEditingBlockId(blockId);
  };

  const handleBlockSave = (meta: WorkoutBlockMeta) => {
    if (!editingBlockId) return;
    updateItemMetadata(editingBlockId, meta);
    setEditingBlockId(null);
    refresh();
  };

  const handleBlockDelete = () => {
    if (!editingBlockId) return;
    deleteItem(editingBlockId);
    setEditingBlockId(null);
    refresh();
  };

  const handleReorderDrop = (draggedId: string, targetId: string) => {
    if (draggedId === targetId) return;
    const ids = rows.map((r) => r.block.id);
    const from = ids.indexOf(draggedId);
    const to = ids.indexOf(targetId);
    if (from === -1 || to === -1) return;
    const next = [...ids];
    next.splice(from, 1);
    next.splice(to, 0, draggedId);
    setManualOrder(listKey, next);
    refresh();
  };

  if (editingRow) {
    return (
      <BlockEditForm
        exerciseTitle={editingRow.exerciseTitle}
        initialValue={parseBlockMeta(editingRow.block.metadata)}
        onSubmit={handleBlockSave}
        onCancel={() => setEditingBlockId(null)}
        onDelete={handleBlockDelete}
      />
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={styles.title} numberOfLines={1}>{item.title}</Text>
        <Pressable onPress={onEditDetails} style={styles.editButton}>
          <Pencil size={16} color={webColors.mutedForeground} strokeWidth={1.75} />
        </Pressable>
      </View>

      {rows.length === 0 ? (
        <Text style={styles.emptyText}>No exercises yet. Tap + to add one.</Text>
      ) : (
        <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <BlockRowItem
              key={row.block.id}
              row={row}
              onPress={() => setEditingBlockId(row.block.id)}
              onReorderDrop={(draggedId) => handleReorderDrop(draggedId, row.block.id)}
            />
          ))}
        </ScrollView>
      )}

      <Pressable onPress={() => setPickerOpen(true)} style={styles.addButton}>
        <Plus size={16} color={webColors.card} strokeWidth={2} />
        <Text style={styles.addButtonText}>Add exercise</Text>
      </Pressable>

      <ExercisePickerModal visible={pickerOpen} onClose={() => setPickerOpen(false)} onPick={handlePickExercise} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, gap: webSpacing[4] },
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground, flex: 1, marginRight: webSpacing[3] },
  editButton: {
    width: 28,
    height: 28,
    borderRadius: webRadius.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: webColors.muted,
  },
  emptyText: { fontSize: webFontSize.sm, color: webColors.mutedForeground },
  list: { gap: webSpacing[2] },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    marginBottom: webSpacing[2],
  },
  rowHovering: { borderColor: webColors.accent, backgroundColor: `${webColors.accent}1A` },
  rowText: { flex: 1, gap: 2 },
  rowTitle: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.foreground },
  rowSubtitle: { fontSize: webFontSize.xs, color: webColors.mutedForeground },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
  },
  addButtonText: { fontSize: webFontSize.sm, fontWeight: '700', color: webColors.card },
});
```

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "WorkoutTemplateDetailPanel.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/WorkoutTemplateDetailPanel.web.tsx
git commit -m "feat(mobile): add web WorkoutTemplateDetailPanel with drag-reorder

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 10: Wire `WorkoutsScreen.web.tsx`

**Files:**
- Modify: `apps/mobile/src/webApp/WorkoutsScreen.web.tsx` (full current contents shown in the spec's Context section — 132 lines, reproduced below for reference)

**Interfaces:**
- Consumes: `ExerciseLibraryScreen` (Task 6), `WorkoutTemplateDetailPanel` (Task 9).
- Produces: no new exports — this is the final integration point.

Adds `activeTab: 'templates' | 'exercises'` and, within the templates tab, `mode: 'detail' | 'edit'` (mirroring `HabitsScreen.web.tsx`'s existing split) so the `DetailPanel` shows `WorkoutTemplateDetailPanel` by default and `ItemDetailForm` when `onEditDetails`/delete-driven editing is needed.

- [ ] **Step 1: Replace the file contents**

```typescript
import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { useWorkouts } from '../hooks/useDb';
import { createItem } from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { WorkoutTemplateDetailPanel } from './WorkoutTemplateDetailPanel.web';
import { ExerciseLibraryScreen } from './ExerciseLibraryScreen.web';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

type WorkoutsTab = 'templates' | 'exercises';

export function WorkoutsScreen() {
  const { workouts, refresh } = useWorkouts();
  const [activeTab, setActiveTab] = useState<WorkoutsTab>('templates');
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [mode, setMode] = useState<'detail' | 'edit'>('detail');
  const selectedItem = workouts.find((i) => i.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('workout-template', trimmed, 'active');
    setCaptureText('');
    refresh();
  };

  const openTemplate = (templateId: string, _title: string) => {
    setActiveTab('templates');
    setSelectedId(templateId);
    setMode('detail');
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Workouts</Text>
        {activeTab === 'templates' ? <Text style={styles.count}>{workouts.length}</Text> : null}
      </View>

      <View style={styles.tabRow}>
        <Pressable onPress={() => setActiveTab('templates')} style={[styles.tab, activeTab === 'templates' && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === 'templates' && styles.tabTextActive]}>Templates</Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('exercises')} style={[styles.tab, activeTab === 'exercises' && styles.tabActive]}>
          <Text style={[styles.tabText, activeTab === 'exercises' && styles.tabTextActive]}>Exercises</Text>
        </Pressable>
      </View>

      {activeTab === 'templates' ? (
        <>
          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submit}
              placeholder="New workout template..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          <FlatList
            data={workouts}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.empty}>No workout templates yet.</Text>}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => { setSelectedId(item.id); setMode('detail'); }}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
              </Pressable>
            )}
          />

          <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={mode === 'edit' ? 'Edit Details' : 'Workout Template'}>
            {selectedItem ? (
              mode === 'edit' ? (
                <ItemDetailForm
                  item={selectedItem}
                  onChanged={() => { refresh(); setMode('detail'); }}
                  onDeleted={() => {
                    setSelectedId(null);
                    refresh();
                  }}
                />
              ) : (
                <WorkoutTemplateDetailPanel item={selectedItem} onEditDetails={() => setMode('edit')} />
              )
            ) : null}
          </DetailPanel>
        </>
      ) : (
        <ExerciseLibraryScreen onOpenTemplate={openTemplate} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  tabRow: {
    flexDirection: 'row',
    gap: webSpacing[2],
    marginHorizontal: webSpacing[6],
    marginBottom: webSpacing[4],
  },
  tab: {
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  tabActive: {
    backgroundColor: webColors.accent,
  },
  tabText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  tabTextActive: {
    color: webColors.card,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  listContent: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[2],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  row: {
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
});
```

Note: the "Exercises" tab (`ExerciseLibraryScreen`) is rendered outside the `webSpacing[6]`-padded/`webColors.background`-container structure used by the templates tab's list — `ExerciseLibraryScreen` (Task 6) already applies its own `webSpacing[6]`-equivalent padding via its `content`/`header` styles internally, so it's dropped directly into `WorkoutsScreen`'s `container` without double-padding. Verify this visually in Task 11's manual check; if padding looks off, adjust `ExerciseLibraryScreen`'s `container`/`header` styles (Task 6) to add `paddingHorizontal: webSpacing[6], paddingTop: webSpacing[6]` matching the templates tab's header spacing — do not add padding here in `WorkoutsScreen`, to keep `ExerciseLibraryScreen` self-contained.

- [ ] **Step 2: Type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -i "WorkoutsScreen.web"`
Expected: no output.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/webApp/WorkoutsScreen.web.tsx
git commit -m "feat(mobile): wire Templates/Exercises tabs into web WorkoutsScreen

Co-Authored-By: Claude <noreply@anthropic.com>"
```

---

### Task 11: Manual verification pass

**Files:** none (verification only).

- [ ] **Step 1: Full type-check**

Run: `cd apps/mobile && node --stack-size=8000 node_modules/typescript/lib/tsc.js --noEmit 2>&1 | grep -v "^App\.web\|^src/webApp/AppShell\|^src/webApp/.*Screen\.web\|Cannot find module '\./DetailPanel'\|Cannot find module '\./ItemDetailForm'"`

This filters out the pre-existing, unrelated `tsc` false-positives already present before this plan (vanilla `tsc` doesn't resolve React Native's `.web.tsx` platform-extension convention the same way Metro/Expo's bundler does — see the exercise-detail-and-library-cards plan's Task 8 for the same caveat observed on the mobile side). Confirm the remaining output (if any) only mentions files this plan touched, and fix any real errors there.

- [ ] **Step 2: Run the full test suite**

Run: `cd apps/mobile && npm test 2>&1 | tail -20`
Expected: all existing tests still pass (this plan adds no new pure-logic functions requiring new tests — everything reused from mobile's exercise-library work is already covered).

- [ ] **Step 3: Launch the web app and walk the flow**

Run: `cd apps/mobile && npm run web`, open the printed local URL in a browser, sign in, and verify:
- Workouts screen shows "Templates" / "Exercises" tabs; Templates is the default and looks unchanged from before this plan.
- Exercises tab shows a muscle-group card grid (or "Add starter exercises" if there are no exercises yet); tapping a card filters to that group's flat list with a "‹ Back to groups" link; typing in search shows a flat filtered list regardless of the selected group.
- Tapping an exercise opens the right-side panel showing hero image/placeholder, muscle-group + equipment badges, Tips (only if notes exist), Used In (templates referencing this exercise, or "Not used in any template yet"), and the Progress placeholder text.
- Pencil icon opens the inline edit form pre-filled; Cancel returns to the detail view without saving; Save persists changes and returns to the detail view showing the update.
- "+" next to "Exercises" header opens a blank create form; saving adds the exercise and closes the panel.
- Switching to the Templates tab, opening a template shows its exercise blocks (or "No exercises yet" if empty); "+ Add exercise" opens the centered picker modal (search, muscle-group sections, "+ New Exercise" inline create); picking an exercise adds a block and opens its edit form.
- Dragging a block row onto another row reorders them, and the new order persists after closing and reopening the panel (and, if testable, matches order shown on mobile for the same template).
- Tapping a block row opens its sets/reps/weight/rest/notes form; Save updates the row's summary text; "Remove from template" deletes the block and returns to the list.
- Pencil icon in the template panel's header switches to the generic title/notes/date/priority form (`ItemDetailForm`) for editing the template's own details, with a working Delete.
- From an exercise's Used In list, tapping a template switches to the Templates tab and opens that template's panel directly (no nested panels).

Expected: all of the above behave as described. Note and fix any layout/interaction issue found (e.g. the grid's `31%` card width from Task 3, or the padding note in Task 10).

- [ ] **Step 4: Final commit (if Step 3 required fixes)**

```bash
git add -A
git commit -m "fix(mobile): address manual verification findings for web exercise library and template builder

Co-Authored-By: Claude <noreply@anthropic.com>"
```

(Skip this step if Step 3 found nothing to fix.)
