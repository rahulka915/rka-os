# RepCount CSV Import + Workout Trends — Design

**Status:** Approved, ready for implementation planning
**Author:** Brainstormed with user, 2026-08-07

## Problem

The user has ~3,500 rows of historical workout data exported from a third-party app ("RepCount") as a CSV, sitting on their Mac at a path like `~/Downloads/repcount_export_5 Aug 2026.csv`. They want that history inside RKA OS, and they want to see trends from it (and from future in-app-logged workouts): per-exercise strength progression, training volume over time, workout consistency, and muscle-group balance.

Two independent pieces:

1. **One-time import** — get the CSV data into the app's data model.
2. **Ongoing trends screen** — visualize workout history (imported + future) inside the Workouts section.

## Source data

CSV columns: `Workout Start, Workout End, Exercise, Weight, Reps, Notes, Kcal, Distance, Duration, Category, Name, Bodyweight`.

Example rows:
```
Workout Start,Workout End,Exercise,Weight,Reps,Notes,Kcal,Distance,Duration,Category,Name,Bodyweight
2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",10,12,"easy",,,,Chest,"Energym Push",
2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",14,12,"easy but not SUPER easy",,,,Chest,"Energym Push",
2025-10-17 03:34,2025-10-17 04:10,"Dumbbell Press",,,"",,,,Chest,"Energym Push",
```

Observations used below:
- All rows belonging to one workout share an identical `Workout Start` / `Workout End` / `Name` triple — that's the natural session grouping key.
- `Category` is RepCount's own muscle-group label per exercise (e.g. `Chest`, `Triceps`, `Biceps`, `Shoulders`) — more reliable than inferring from the exercise title.
- Rows with both `Weight` and `Reps` blank are placeholder/incomplete sets with no real data and must be dropped.
- `Kcal`, `Distance`, `Duration`, `Bodyweight` are present in the schema but are empty in the sample data and out of scope for this import (not mapped to anything).
- Weight's unit is not present in the export; it must be confirmed at import time, not assumed.

## Existing data model (relevant parts)

- `workout-session`: an `Item` (`type: 'workout-session'`), status `'active' | 'completed'`.
- `exercise`: an `Item` (`type: 'exercise'`), freely created by title, `metadata` holds `{ muscleGroup, equipment?, movementFamily? }` (`src/utils/exerciseLibrary.ts`).
- Sets are not a table — they're `activityLogs` rows: `entityId = exerciseId`, `actionType = 'workout-set-logged'`, `details = JSON.stringify({ sessionId, setNumber, reps, weight, weightUnit })`. `entityId` is deliberately the exercise (not the session) so "last time I did X" is a single-column lookup.
- `logActivity`/`createItem` always stamp `Date.now()` — there is no existing path to write a historically-timestamped item or log.
- Firestore mirrors this model 1:1 under `users/{uid}/items/{id}` and `users/{uid}/activityLogs/{id}` (`src/services/firestoreSync.ts`), full field parity with the SQLite columns. The app's `onSnapshot` listeners apply remote docs directly into SQLite whenever the app is open with sync running — no app code needs to change for remote-written data to become fully functional local data, as long as every column the SQLite `INSERT` expects is present on the Firestore doc.
- Firebase config: `apps/mobile/.env.local` (gitignored) holds `EXPO_PUBLIC_FIREBASE_*` values; auth is Firebase email/password only (`signInWithEmailAndPassword`); the `firebase` npm package (v12, modular SDK) works identically in Node.

## Decisions from brainstorming

| Question | Decision |
|---|---|
| Where does the import run? | **Mac-side Node script only** — no on-device file-picker UI. CSV already lives on the Mac; Firestore sync carries the result to the phone automatically whenever the app is next open. |
| Auth for the script | **Client SDK, real account** (`signInWithEmailAndPassword`), same as the app — not an Admin SDK service account. Password is prompted interactively at runtime, never passed as a CLI arg or stored in a file. |
| Unmatched exercise names | **Auto-create, no review step.** Exact case-insensitive title match against existing `exercise` items; no match creates a new one. Muscle group comes from the CSV's own `Category` column mapped to the app's 8 muscle groups, not inferred from the title. |
| Re-running the import / overlap protection | **Tag + skip duplicates.** Every imported session gets `metadata.importSource: 'repcount'` and `metadata.sourceStartAt: <original Workout Start ms>`. Re-running the script skips any session whose `sourceStartAt` was already imported. |
| Per-exercise progression metric | **Top set weight per session** (the heaviest weight logged for that exercise in that session) — not an estimated 1RM formula. |
| Trend visualizations wanted | All four: per-exercise progression, weekly/monthly volume, workout frequency, muscle-group balance. Built in one pass (not phased). |
| Where do trends live in-app? | A new **"Trends" entry point inside the existing Workouts section**, not a new top-level nav item. |
| Weight unit | Confirmed via a **CLI flag** (`--unit=kg` or `--unit=lb`, default `kg`) rather than assumed or asked per-row. |

## Part 1: Mac-side import script

### Location & shared logic

- `scripts/repcount-import/parse.mjs` — pure, dependency-free (beyond Node builtins) CSV parsing and record-building logic. No Firebase/Firestore code here, so it's independently testable and reusable if an on-device import path is ever added later.
- `scripts/repcount-import/musclegroups.mjs` — the `Category` → `MuscleGroup` mapping table (see below), mirroring `src/utils/exerciseLibrary.ts`'s `MuscleGroup` union (`'chest' | 'back' | 'shoulders' | 'arms' | 'legs' | 'core' | 'full-body' | 'cardio'`) so imported exercises are classified the same way the app already classifies its own.
- `scripts/import-repcount.mjs` — the CLI entry point: reads config, authenticates, calls the shared parser, fetches existing Firestore state for matching/dedup, prints the dry-run summary, and (with `--commit`) writes.

### CSV parsing rules

1. Quote-aware line parsing (handles embedded commas inside quoted fields like `Notes`; no external CSV library needed for this format).
2. Group rows into sessions by exact `(Workout Start, Workout End, Name)` triple, in file order.
3. Within a session, drop any row where both `Weight` and `Reps` are blank.
4. Parse `Workout Start`/`Workout End` as local time (`YYYY-MM-DD HH:mm`, no timezone in the export — treated as the machine's local timezone when the script runs, since that's the best available assumption and matches how the phone would have logged it live).
5. Rows are grouped by `Exercise` within a session, in file order, to assign `setNumber` (1-based, per exercise per session).

### Record mapping

**Session → `workout-session` item:**
- `title`: the CSV's `Name` column (e.g. `"Village Push"`) — used as-is, no relation to a `workout-template` item (RepCount's `Name` is a free-text label, not a structured template in this app's model; this is a freeform import).
- `status`: `'completed'`.
- `createdAt` / `updatedAt`: the session's `Workout Start`, parsed to epoch ms (this is the "real" performed-at timestamp — historical, not `Date.now()`).
- `scheduledDate`: the date portion of `Workout Start` (`YYYY-MM-DD`), so any existing calendar/date-based queries see it correctly.
- `metadata`: `{ importSource: 'repcount', sourceStartAt: <Workout Start epoch ms> }` — the dedupe key.

**Exercise name → `exercise` item (match or create):**
- Match: case-insensitive exact title match against existing `exercise` items already read from Firestore.
- Create (no match): new `exercise` item, `title` = CSV's exact `Exercise` value, `status: 'active'`, `metadata: { muscleGroup, movementFamily }` where:
  - `muscleGroup` = CSV `Category` mapped via the table below; unmapped/blank `Category` falls back to `'full-body'` (same fallback the app already uses elsewhere for unrecognized muscle groups).
  - `movementFamily` = inferred via a ported copy of `inferMovementFamily(title)`'s regex rules from `src/utils/exerciseLibrary.ts` (same logic the app already applies to any new exercise, kept in sync manually since the script has no RN dependency and can't `import` from `apps/mobile/src` directly across the module boundary).
- Existing exercises are never modified (no overwriting muscle group/metadata on a match).

**`Category` → `MuscleGroup` mapping table:**
| CSV `Category` (case-insensitive) | App `MuscleGroup` |
|---|---|
| Chest | chest |
| Back | back |
| Shoulders | shoulders |
| Biceps, Triceps, Arms, Forearms | arms |
| Legs, Quads, Quadriceps, Hamstrings, Glutes, Calves | legs |
| Abs, Core | core |
| Cardio | cardio |
| Full Body, Full-Body, (anything else, or blank) | full-body |

**Set → `activityLogs` row:**
- `entityId`: the matched/created exercise's item id.
- `actionType`: `'workout-set-logged'`.
- `timestamp` / `createdAt`: the session's `Workout Start` epoch ms (the CSV has no per-set time, only a session-level start; using the session start for every set in that session is accurate enough for day-level trend charts, which is all the trend views need).
- `details`: `JSON.stringify({ sessionId, setNumber, reps: <Reps>, weight: <Weight>, weightUnit: <--unit flag value>, imported: true })`.

### Firestore document IDs

New items/logs get a fresh `uuid()` (via the `uuid` npm package, same one `apps/mobile` already depends on) as their Firestore document id, matching the app's own id scheme.

### CLI

```
node scripts/import-repcount.mjs <path-to-csv> --email=you@example.com [--unit=kg|lb] [--commit]
```

- `--email` (required): the account to sign in as. Password is prompted interactively (not echoed).
- `--unit` (optional, default `kg`): applied to every imported set's `weightUnit`.
- `--commit` (optional, default off): without it, the script is a **dry run** — it parses, matches, and prints the summary, but writes nothing. Must be passed explicitly to actually write to Firestore.
- Firebase config is read from `apps/mobile/.env.local`'s `EXPO_PUBLIC_FIREBASE_*` values (already present, gitignored) — no separate config step for the script.

### Dry-run summary output

Before any write (and always, even with `--commit`, before the write happens), print:
- Total sessions found in the CSV, total sets (after dropping blank rows).
- Date range covered (earliest → latest `Workout Start`).
- Number of sessions that would be **skipped** (already imported, matched by `sourceStartAt`).
- Number of net-new sessions/sets that would be created.
- Number of exercise names matched to existing exercises vs. number that would be newly created (list the new ones by name).
- The `--unit` value being applied.

Without `--commit`, the script exits after printing this. With `--commit`, it proceeds to write (still printing the same summary first), using a `BulkWriter` (Firestore's automatic-batching/retrying writer, so the ~3,500-row import isn't manually chunked against the 500-ops-per-batch limit).

### Sync-down

No app changes required for this half. The next time the app is open with the existing real-time Firestore listeners active, the new `items`/`activityLogs` docs are pulled down and written into local SQLite by the existing `onSnapshot` handlers in `src/services/firestoreSync.ts`, exactly as any other remote change would be.

## Part 2: Workout Trends screen (in-app)

### Entry point

A new row in `WorkoutsScreen.tsx` (alongside the existing "Build from a Template" / "Templates" sections), navigating to a new `WorkoutTrendsScreen.tsx` registered in `MenuStack.tsx` (same stack `WorkoutsScreen`/`WorkoutTemplateDetailScreen` already live in).

### Data aggregation layer

New `src/utils/workoutTrends.ts` — pure functions (no hooks), each backed by a small new raw-SQL query function in `database.ts` (not JS loops over the entire `activityLogs` table, since it can grow into the thousands of rows):

- `getWorkoutSessionDates(sinceMs: number): number[]` — `createdAt` of every `workout-session` item with `status = 'completed'` since a given time, for the frequency heatmap.
- `getExerciseSetLogHistory(exerciseId: string): WorkoutSetLogEntry[]` — **all** `workout-set-logged` activityLogs for one exercise, oldest first (the existing `getLastSessionSetsForExercise` caps at `LIMIT 200` and is ordered for "most recent session" use cases — this needs its own uncapped, chronological query for a full progression chart).
- `getWorkoutSetLogsInRange(startMs: number, endMs: number): ActivityLog[]` — all `workout-set-logged` rows in a time window, for volume and muscle-balance aggregation.

Aggregation (pure JS over the rows returned above):
- `computeExerciseProgression(logs): { sessionDate: number; topWeight: number }[]` — group by `sessionId` (from each log's `details`), take the max `weight` per session, sorted by date.
- `computeVolumeByPeriod(logs, period: 'week' | 'month'): { periodLabel: string; totalVolume: number }[]` — `totalVolume += reps * weight` per set, bucketed by ISO week or calendar month.
- `computeMuscleGroupBalance(logs, exerciseMuscleGroupById): { muscleGroup: MuscleGroup; volume: number; percent: number }[]` — same volume sum, bucketed by each set's exercise's `muscleGroup`, sorted descending by volume.
- `computeFrequencyHeatmap(sessionDates): { date: string; count: number }[]` — one entry per day in the displayed range, count of sessions that day (0 for rest days).

### Visualizations

1. **Frequency heatmap** — new `WorkoutFrequencyHeatmap.tsx`, a GitHub-contributions-style grid (SVG rects) covering the last ~16 weeks, cell shade by session count that day. Uses the app's existing vermilion/antiqueBrass palette (not a foreign green scale).
2. **Per-exercise progression** — new `ExerciseProgressionChart.tsx`: an exercise picker (search over exercises that have at least one set log) plus an SVG line chart of top-set-weight-per-session over time, following the same `react-native-svg` + Reanimated conventions as `FocusTimelineCard.tsx`/`RiverStoneProgress.tsx` (viewBox-scaled path, animated draw-in, Reduce Motion fallback).
3. **Weekly/monthly volume** — new `VolumeBarChart.tsx`: a simple SVG bar chart, with a week/month toggle, of `computeVolumeByPeriod`'s output over a trailing window (e.g. last 12 weeks / 6 months).
4. **Muscle-group balance** — **no new chart widget.** Reuses the existing `RiverStoneProgress` bar per muscle group, rendered as a sorted list (highest-volume muscle group first) showing each group's `percent` of total volume over a selectable period (e.g. last 30 days) — deliberately not a new radial/donut component, since the existing linear-bar component already does this job and the app's design system explicitly favors reusing `RiverStoneProgress`/`EnsoMeter`/`SteppingStones` over inventing new indicator shapes.

### Out of scope for this spec

- Editing or deleting individual imported sets from the Trends screen (use the existing per-exercise/session UI elsewhere in Workouts if a correction is ever needed).
- Any on-device CSV import path (explicitly deferred; Mac-only for now, per the decision above).
- Kcal/Distance/Duration/Bodyweight columns from the CSV — not mapped to anything in this pass.
- Estimated 1RM or any progression metric beyond top-set-weight.

## Open implementation risks to flag in the plan

- **Timezone assumption**: `Workout Start`/`Workout End` have no timezone in the export; the script assumes the machine's local timezone at run time. If the user ran RepCount across timezones (travel), some session dates could be off by a day at the boundary — acceptable given this is a one-time historical import, but worth a one-line callout in the script's own summary output.
- **`inferMovementFamily` duplication**: the script needs its own copy of this regex logic since it can't import from `apps/mobile/src` (different module boundary/runtime). Any future change to the app's classifier won't automatically propagate to the script — acceptable since the script is a one-time-use tool, not a long-lived shared surface.
- **Firestore security rules**: not inspected in this design pass. If the deployed rules don't allow a signed-in user to write `users/{uid}/items` and `users/{uid}/activityLogs` for their own uid, the script's writes will fail with a permissions error — this should surface clearly in the script's error output rather than fail silently.
