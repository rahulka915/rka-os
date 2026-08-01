# Exercise Library + Workout Template Builder — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

`apps/mobile` already has a working `workout-template` item type (create/rename/delete via `WorkoutsScreen.tsx` + `QuickCreateSheet`), but templates are title-only — no way to attach exercises. `exercise` and `workout-block` are declared in `ItemType` (`src/db/types.ts`) but have no schema, UI, or relations (see `apps/mobile/SCHEMA.md`, "Known gaps"). This spec builds both:

1. An **exercise library** — a personal catalog of exercises with muscle group / equipment metadata.
2. **Workout template building** — attaching exercises (as "blocks" with sets/reps/weight/rest) to a template, in a user-defined order.

No workout-session / live-tracking model is in scope — this is planning-only, matching the existing template feature's scope.

## Data Model

All additions are metadata shapes on existing tables (`items`, `itemRelations`) — no schema migration.

### `exercise` item

```
metadata: {
  muscleGroup: 'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full-body' | 'cardio',
  equipment?: 'barbell' | 'dumbbell' | 'machine' | 'cable' | 'bodyweight' | 'kettlebell' | 'band' | 'other',
  notes?: string,
}
```

`title` = exercise name. `status` always `'active'` (exercises aren't scheduled or completed). No relation to anything on their own — they're referenced *from* blocks.

### `workout-block` item

One row per exercise-within-a-template instance (so the same exercise can appear in multiple templates, or twice in one template, each with its own sets/reps).

```
metadata: {
  sets?: number,
  reps?: string,       // free text: "8-12", "AMRAP", "30s"
  weight?: string,      // free text: "60kg", "bodyweight", "+20lb"
  restSeconds?: number,
  notes?: string,
}
```

`title` is set to the linked exercise's title at creation time (denormalized convenience/fallback; display always joins through the relation, so staleness after a later exercise rename is cosmetic and acceptable).

Reps/weight are deliberately free text rather than typed numeric fields — this is a personal-use app, not a fitness platform; forcing a rigid strength-only schema would make cardio/isometric entries awkward. No separate "category" field on `exercise` — the block's fields already flex to whatever the exercise needs.

### Relations (`itemRelations`, existing generic table)

- `workout-block --'exercise'--> exercise` (`setRelation(blockId, 'exercise', exerciseId)`)
- `workout-block --'workout-template'--> workout-template` (`setRelation(blockId, 'workout-template', templateId)`)

Both single-select, which is correct here (a block belongs to exactly one template and points at exactly one exercise).

### Ordering

Reuses the existing generic `itemOrder` primitive (`setManualOrder` / `applyManualOrder` in `src/db/database.ts`) — the same mechanism `ProjectDetailScreen` uses for task ordering within a project. List key: `` `workout-template:${templateId}` ``. No new ordering field or mechanism.

## Screens & Components

### 1. Exercise Library (`ExerciseLibraryScreen.tsx`, new)

- Reached via a link/button on `WorkoutsScreen` (e.g. "Exercise Library →", styled like the existing "Create your own template →" link). `MenuScreen`'s Workouts tile subtitle already reads "Templates and exercise library", so this stays a sub-screen of Workouts rather than a new top-level Menu entry.
- Search input at top (filters by title substring).
- When not searching: flat list grouped into sections by `muscleGroup` (Things-3 flat rows, hairline separators, no cards — matching `InboxScreen`/`WorkoutsScreen` row style).
- When searching: flat filtered list, no section headers.
- Tap row → `ExerciseEditSheet` in edit mode.
- Long-press row → action sheet (`showActionSheet`): Edit / Delete.
- Empty state: "No exercises yet" + a manual "Add exercise" action + a one-tap "Add starter exercises" action that bulk-creates ~20 common exercises spanning all muscle groups (mirrors `WorkoutsScreen`'s `STARTERS` template pattern) — a one-time bootstrap convenience, not shown once the library is non-empty.

### 2. Workout Template Detail (`WorkoutTemplateDetailScreen.tsx`, new)

- Route params: `{ templateId, title }`.
- Registered in `MenuStack.tsx`. `WorkoutsScreen` row tap now navigates here instead of opening the rename sheet directly (rename/delete move to the row's long-press action sheet, replacing the current tap-to-rename behavior).
- Body: blocks for this template, drag-reorderable (`ReorderableList` + `useHapticReorder`, same pattern as `ProjectDetailScreen`'s task list). Each row: exercise title + a compact summary (e.g. "4 × 8-12 · 60kg"), drag handle.
- Tap row → `BlockEditSheet` (edit sets/reps/weight/rest/notes for that block).
- Long-press row → action sheet: Edit / Remove from template (deletes the block item + its relations, not the underlying exercise).
- "+" (top-right, header) → `ExercisePickerSheet`.
- Empty state: "No exercises yet. Tap + to add one."

### 3. New sheets (follow the existing `QuickCreateSheet`/`BottomSheet` Things-3 pattern — compact bottom sheet, Cancel/Save toolbar, autofocus. NOT the large generic `ItemEditorSheet`, which is task/project-oriented with scheduling/project/checklist fields that don't apply here and would bloat an already-717-line file.)

- **`ExerciseEditSheet`** — title input, muscle group chip row (single-select), equipment chip row (single-select, optional/"Any"), notes input. Used for both create and edit (same `initialValue`-driven dual-mode pattern as `QuickCreateSheet`).
- **`BlockEditSheet`** — header shows the exercise name (read-only context, not editable here); fields: sets (numeric), reps (text), weight (text), rest seconds (numeric, optional), notes (text, optional).
- **`ExercisePickerSheet`** — search input + the same grouped/flat list logic as `ExerciseLibraryScreen` (in "picker" mode: tapping a row selects instead of editing), plus an inline "+ New exercise" affordance that opens `ExerciseEditSheet` and, on save, selects the newly created exercise. Selecting an exercise (existing or new) immediately opens `BlockEditSheet` to configure sets/reps before the block is created.

## Data Layer Additions

- `src/db/types.ts` — no changes needed (`ItemType` already includes `'exercise'` and `'workout-block'`).
- `src/hooks/useDb.ts` — add `useExercises()` (mirrors `useWorkouts()`: `getItemsByType('exercise')` + refresh).
- Block-for-template reads are inlined in the screen via existing primitives (`applyManualOrder(listKey, getRelatedItems(templateId, 'workout-template'))`), matching how `ProjectDetailScreen` reads its tasks — no new dedicated DB function needed for that.
- No new generic DB functions required beyond what already exists (`createItem`, `updateItem`, `deleteItem`, `setRelation`, `getRelation`, `getRelatedItems`, `applyManualOrder`, `setManualOrder`, `updateItemMetadata`, `getItemWithMetadata`).

## Out of Scope

- Live workout tracking / session logging (no `workout-session` model — matches the existing template feature's placeholder "Coming soon" for "Start empty workout").
- Exercise images/videos, 1RM tracking, progress charts.
- Multi-relation blocks (e.g. supersets) — each block is one exercise.
- Syncing exercise/block data to Firestore beyond whatever the generic `items`/`itemRelations` dual-write already covers automatically (no special-casing needed since these are just new `type` values on existing tables).
- The desktop web shell (`src/webApp/WorkoutsScreen.web.tsx` and friends) — out of scope for this pass. It keeps working unchanged (title-only templates); it simply won't surface exercises/blocks yet.
