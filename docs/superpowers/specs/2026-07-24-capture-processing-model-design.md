# Capture & Processing Model

## Context

RKA OS currently treats every capture as an implicit task — Things-3-style, "capture
becomes an action." In practice, a meaningful share of real captures aren't actions at
all: "Sony WH-1000XM6," "nice café someone recommended," "new guitar pedals" are things
you're interested in, not things to do. Forcing them into task shape (fake "Buy X" tasks)
loses information (price, links, purchase status) and clutters actionable lists with
non-actionable noise.

This is meant to be a **foundational architecture document**: the first explicit statement
of RKA OS's domain model for what a capture can become, how it gets there, and how the
pieces relate — not just a spec for one feature.

## Goal

Define the full four-type capture model (Task, Object, Note, Project) as the app's
standing domain model, and implement the first genuinely new piece of it: **Object** — a
capture type for things you're interested in owning, with its own status lifecycle
(Want → Need → Saving → Ready to Buy → Ordered → Owned), price, links, category, photos,
and links to related tasks/projects. A new "To Get" collection surfaces them grouped by
category.

## Non-goals

- **Note** is defined conceptually in this document (see Domain Model) but **not
  implemented** in this pass — it's simple enough (title + body, no lifecycle) to be its
  own small follow-up once Object is proven out, and bundling it now would dilute focus on
  the type that actually needs design work.
- Price *history* (tracking price drops over time), barcode/URL scraping to auto-fill
  Object details, and purchase-link affiliate handling are all out of scope — Price and
  Links are plain manually-entered fields, nothing automated.
- No change to Task, Project, or Area's existing behavior, fields, or screens.
- No change to the existing "Classify as..." destinations (Mission/Domain/Habit/
  Medication/Reference) beyond adding one new option.

## Domain Model

```
Capture (fast, type-less — title only, exactly as today)
  ↓
  Inbox (unchanged — triage happens here, not at capture time)
  ↓
  Classify as...
    → Task       (existing type — actionable, has schedule/duration/repeat/deadline)
    → Object     (NEW — a thing you're interested in owning; this document + this pass)
    → Note       (defined here, NOT built this pass — pure information, no lifecycle)
    → Project    (existing type — collection of work)
    → Domain / Habit / Medication / Reference  (existing "Classify as..." options, unchanged)
```

**Object's lifecycle** (independent of the generic `ItemStatus` used by Task/Project/etc.,
which has no vocabulary for "I want this"):

```
Want → Need → Saving → Ready to Buy → Ordered → Owned
```

Not a strict forward-only pipeline — a user can jump straight to "Owned" (already have it,
just cataloguing) or move backward (reconsidered a purchase). No enforced transitions.

**Relationships:** an Object can link to one Task ("Measure desk space") and one Project
("Desk Setup"), matching this app's existing single-select relation convention (a Task
already links to at most one Project, an Area to at most one parent, via the generic
`itemRelations` table) — not a multi-link system.

**Note** (defined, not built): title + body, no status lifecycle, no schedule. Exists in
this document so the four-type model is complete on paper even though only Object ships
now — prevents this doc from needing a rewrite when Note is eventually built, just an
addition.

## Approach

### Data model — additive to the existing polymorphic schema

No new tables. RKA OS already stores every entity (task, project, area, habit,
medication, ...) as one row in a single `items` table discriminated by a `type` column,
with type-specific extra fields living in a `metadata` JSON blob (this is how
`durationMinutes`, `priority`, `preferredTimeBucket` already work for other types). Object
follows the exact same pattern:

- `items.type = 'object'` (new `ItemType` union member, alongside the existing
  `'area' | 'project' | 'task' | 'habit' | 'medication' | 'workout-template' |
  'workout-block' | 'exercise' | 'meal'`).
- `items.status` stays a plain `'active'` for the Object's whole life (until deleted) —
  the granular Want/Need/Saving/... progression is a *different axis* from the generic
  status column and doesn't try to reuse it.
- `metadata.objectStatus: 'want' | 'need' | 'saving' | 'ready' | 'ordered' | 'owned'`
- `metadata.price?: number`
- `metadata.links?: string[]`
- `metadata.photoUris?: string[]` — local file paths (see Photos below), not remote URLs.
- Category: reuses the existing generic `tags: string[]` field — no new column, no fixed
  category list. Grouping in "To Get" is by tag, same as any other tag-based grouping
  elsewhere in the app.
- Linked Task / linked Project: reuses the existing generic `itemRelations` table
  (`sourceId`/`targetId`/`relationType`, already powers Task→Project and Task→Task
  dependency links today) with the Object as `sourceId`. Task link uses a new
  `relationType` value (`relatedTask`); Project link reuses the existing `project`
  relationType, since "this Object belongs to this Project" is the same relationship
  shape Task→Project already expresses.

### Photos

`expo-image-picker` (not currently installed) for capture/selection;
`expo-file-system` (already installed) to copy the picked image into the app's own
document directory (a dedicated `objectPhotos/` folder) rather than storing a picker
tmp-path that may not persist — `metadata.photoUris` stores the app-local paths. This is
the one piece of this pass that touches native code and needs a rebuild (see Testing /
verification).

### Inbox processing — extends the existing mechanism, doesn't replace it

`InboxScreenV2`'s bulk toolbar already has a working "Classify as..." action
(`handleClassify`) that reassigns an item's `type` via `processInboxItem(id,
destination)` — `GtdDestination` already includes `'project' | 'area' | 'habit' |
'medication' | 'reference'`. This pass adds `'object'` as one more `GtdDestination` value
and one more `Alert.alert` option in `handleClassify`, with `processInboxItem`'s new
`case 'object':` setting `type = 'object'`, `status = 'active'`, and seeding
`metadata.objectStatus = 'want'` (every captured Object starts as a want, matching the
lifecycle's natural entry point). Capture itself is completely unchanged — still title-only,
still fast, still lands in Inbox with no type decision forced at capture time.

### "To Get" screen

New row in `MenuScreen` (`src/screens/MenuScreen.tsx`), matching the existing
Domains/Missions/Tasks/Upcoming/Workouts/Medications pattern exactly — same row
component, same navigation-into-`MenuStack` structure. Lists Objects grouped by tag
(ungrouped/"Other" bucket for untagged Objects), each row showing title + `objectStatus` +
price if set. Tapping opens an Object detail view.

### Object detail view — new, not a reuse of `ItemEditorSheet`

`ItemEditorSheet` (the existing generic edit sheet used by Task/Project/etc.) is built
around scheduling concepts — When/Duration/Repeat/Deadline sections — that don't apply to
a possession-tracking lifecycle. Rather than force Object's fields into that sheet's
layout (or add a pile of `if (item.type === 'object')` conditionals to an already-large
file), Object gets its **own** detail/edit surface: title, `objectStatus` (a segmented
picker or similar showing the 6-stage lifecycle), price, links, tags, photos, and the two
relation pickers (linked Task, linked Project) reusing the same relation-picker pattern
`ItemEditorSheet` already uses for Task→Project.

## Data flow / component boundaries

- **Database layer** (`src/db/database.ts`, `src/db/types.ts`): `ItemType` gains
  `'object'`; `GtdDestination`/`processInboxItem` gain the `'object'` case; no schema
  migration beyond what SQLite's schemaless `metadata` column already accommodates (no
  `ALTER TABLE` needed — new metadata keys just start appearing on new rows).
- **Inbox** (`InboxScreenV2.tsx`): one new line in `handleClassify`'s alert. No other
  change — the existing selection/bulk-action machinery is untouched.
- **New: `ObjectDetailSheet.tsx`** (`src/components/object/`): owns Object-specific
  editing. Does not touch `ItemEditorSheet` at all.
- **New: `ToGetScreen.tsx`** (`src/screens/`, registered under `MenuStack`): read-only
  list + grouping, same shape as the existing Tasks/Upcoming list screens already under
  `MenuStack`.
- **New: `objectPhotos.ts`** (`src/services/`): wraps `expo-image-picker` +
  `expo-file-system` copy-into-local-storage logic, matching this session's
  `deviceCalendar.ts` precedent of isolating a native-module integration behind a small
  service file rather than inlining picker calls into a screen component.

## Error handling

- Photo picker permission denial: same pattern as the calendar integration this session —
  request, and if denied, the photo section simply shows an "Add photo" affordance that
  re-prompts on next tap rather than a hard error state.
- Deleting an Object with linked Task/Project: the link is a normal `itemRelations` row:
  deleting the Object leaves the linked Task/Project untouched (relations are directional,
  sourced from the Object); no cascade needed since nothing else depends on an Object's
  existence.
- No new validation beyond what Task creation already has (title required to save) —
  price/links/photos are all optional.

## Testing / verification

No automated coverage for the new screens (matches this session's established
constraint — RN component/gesture UI isn't unit-testable in this project's `node --test`
setup); pure-logic pieces (objectStatus transitions if any validation is added,
metadata parsing) get plain-Node tests matching the existing `src/utils/*.test.ts`
pattern. `npx tsc --noEmit` must stay clean throughout.

This pass requires **one native rebuild** (for `expo-image-picker`), done once at the end
covering the whole Object feature — not per-task, matching the sequencing already agreed.
Manual device checklist once built:

1. Inbox → select a captured item → "Classify as..." → "Object" (new option) → item
   disappears from Inbox, type is now `object`, `objectStatus` defaults to `want`.
2. Menu → "To Get" (new row) → the classified Object appears, grouped under its tags (or
   "Other" if untagged).
3. Tapping the Object opens its detail view — all fields (status, price, links, photos,
   linked Task, linked Project) editable and persist correctly.
4. Adding a photo: picker opens, selected image persists across app restarts (confirms
   it's copied to local storage, not referencing a picker tmp path that gets cleared).
5. Linking a Task and a Project to an Object, confirming the link is visible from the
   Object's side (this pass does not require the reverse — Task/Project screens showing
   "referenced by this Object" — that's follow-on scope if wanted later).
6. Existing Task/Project/Area/Habit/Medication classify options and screens are
   completely unaffected (regression check).
