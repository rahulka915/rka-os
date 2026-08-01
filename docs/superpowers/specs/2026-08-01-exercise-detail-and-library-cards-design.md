# Exercise Detail Page + Muscle-Group Card Library — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

The exercise library ([2026-08-01-workout-exercise-library-design.md](2026-08-01-workout-exercise-library-design.md), extended with images in [2026-08-01-exercise-images-design.md](2026-08-01-exercise-images-design.md)) currently shows a flat, searchable list grouped by muscle-group section headers, and tapping a row opens the edit sheet directly. This spec adds two connected changes:

1. The library's top level becomes a grid of muscle-group cards (photo + label + count) instead of one long scrolling list; tapping a card drills into that group's flat list.
2. Each exercise gets its own detail page (photo, muscle group/equipment, tips, which templates use it, and a placeholder for stats/history) — tapping an exercise row now opens this page instead of the edit sheet directly; editing moves to a pencil icon in the detail page's header.

**Explicitly deferred:** there is no workout-session/logging model in the app yet (`SCHEMA.md`'s "Known gaps"). The detail page's stats/history section is a static empty-state placeholder for now — filling it with real data is future work, out of scope here.

## Screens & Components

### 1. `ExerciseLibraryScreen` (modified)

- Default view (no search query): a 2-column grid of `MuscleGroupCard`s, one per muscle group that has at least one exercise (empty groups, e.g. `cardio` today, produce no card — same filtering `groupExercisesByMuscle` already does). Each card shows the group label, exercise count, and a representative photo — the first exercise (alphabetical, same ordering `groupExercisesByMuscle` already produces) in that group that has an `imageKey`; falls back to `ExerciseThumbnail`'s placeholder styling if none do.
- The search bar at the top is unchanged. Typing a query switches the body to today's flat filtered list (`filterExercisesByQuery`, no section headers) instead of the card grid; clearing the query returns to the grid.
- Tapping a card navigates to `ExerciseMuscleGroupScreen` with `{ muscleGroup, label }`.
- Tapping an exercise row in the search-results list now navigates to `ExerciseDetailScreen` (previously opened the edit sheet) — see below.
- The empty-state (no exercises at all) and "+" header button are unchanged.

### 2. `ExerciseMuscleGroupScreen` (new)

- Route params: `{ muscleGroup: MuscleGroup; label: string }`.
- Flat list of that group's exercises only — same row layout as the current library screen (`ExerciseThumbnail` + title + subtitle), no section header needed since it's already single-group.
- Tap a row → navigate to `ExerciseDetailScreen`. Long-press → the same Edit/Delete action sheet the library screen uses today (quick access without leaving the list).
- Header "+" → opens `ExerciseEditSheet` in create mode, identical to the library screen's today (blank form, no muscle-group prefill — see Out of Scope for why).

### 3. `ExerciseDetailScreen` (new)

- Route params: `{ exerciseId: string }`.
- Header: back chevron (via `LensSurface`'s built-in back button), exercise title, pencil icon (`headerRight`) that opens `ExerciseEditSheet` pre-filled for this exercise — same edit flow as today, just relocated from "tap the row" to "tap the pencil."
- Body:
  - Large hero image (`ExerciseThumbnail`-style but bigger, e.g. full-width ~200pt tall) or the placeholder box if no `imageKey`.
  - Muscle group + equipment shown as small pills/badges (reusing `formatExerciseSubtitle`'s data, styled more prominently than the current subtitle text).
  - **Tips** section: the exercise's `notes` field, read-only. Omitted entirely if there are no notes (not shown as an empty section).
  - **Used In** section: templates containing this exercise, as a simple tappable list (each row navigates to `WorkoutTemplateDetailScreen`). Built from existing relation data — no new relations. Shows a muted "Not used in any template yet" line when empty.
  - **Progress** section: a single static empty-state block ("Log a workout to see stats and history here") — no real data source yet, intentionally not split into separate "Stats" and "History" sub-sections until logging exists.

## Data Layer

One new function in `src/db/database.ts`, following the existing rollup-query pattern (e.g. `getProjectsForArea`):

```typescript
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

No schema or metadata changes — this composes two existing relation lookups (`workout-block -> exercise`, `workout-block -> workout-template`) that already exist from the original workout-template-builder feature.

## Navigation

Two new routes registered in `MenuStack.tsx`: `ExerciseMuscleGroup` (component `ExerciseMuscleGroupScreen`) and `ExerciseDetail` (component `ExerciseDetailScreen`).

## Out of Scope

- Real stats/history data — requires a workout-session/logging subsystem that doesn't exist yet. The Progress section is a placeholder to be filled in by a future spec once logging is built.
- Inline tip editing on the detail page (confirmed: read-only display, editing stays in the existing edit sheet via the pencil icon).
- Deleting an exercise from the detail page — delete stays reachable only via long-press in the list screens (`ExerciseMuscleGroupScreen`, library search results), keeping the detail page's header simple (back + edit only).
- Muscle-group prefill when creating from within `ExerciseMuscleGroupScreen`'s "+" — the create flow stays identical everywhere (blank form, user picks the muscle-group chip themselves) rather than adding a "pre-filled but still create-mode" concept to `ExerciseEditSheet`, which currently infers its "New" vs "Edit" header purely from whether `initialValue` is passed.
- `ExercisePickerSheet` and `WorkoutTemplateDetailScreen` block rows are unaffected — tapping an exercise there still means "select it" / "edit its sets-reps-weight," not "view its detail page."
