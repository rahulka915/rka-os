# Capture Sheet Quick-Select: Today Chip + Mission/Destination Picker

**Date:** 2026-08-08
**Status:** Approved, ready for planning

## Problem

The FAB ("New item") quick-capture sheet (`CaptureSheet.tsx`) only supports typing a title/note and saving straight to Inbox. Assigning a Mission or marking the item for Today both require tapping "Details" and leaving the fast-capture flow, which defeats the purpose of quick capture. The "Inbox" pill at the top of the sheet is currently a display-only label — it shows the destination but can't be tapped to change it.

## Goal

Let the user, without leaving the capture sheet:
1. Toggle the new item onto **Today**.
2. Assign the new item to a **Mission** (and implicitly its Domain), or explicitly send it to **Inbox**.

## Scope

In scope:
- A new quick-select chip row in `CaptureSheet.tsx`: `Today` toggle chip + `Mission` chip.
- A destination picker (bottom sheet) reachable from both the existing "Inbox" context pill and the new `Mission` chip, showing a searchable, Domain-grouped list of Missions plus a pinned "Inbox" row.

Out of scope (deferred):
- Item-type quick-select chips (Task/Habit/Routine).
- Any status other than Inbox/Mission-assigned (Someday, Scheduled, etc.) — those remain reachable only via "Details."
- Changes to the voice-capture flow.

## Design

### 1. Quick-select chip row

Added between the note `TextInput` and the "Details ›" row in `CaptureSheet.tsx`.

- **`Today` chip** — toggle button.
  - On: sets `draft.metadata.plannedDate` to today's date (`YYYY-MM-DD`).
  - Off: removes `draft.metadata.plannedDate`.
  - This matches the existing "Add to Today" mechanism (`planForToday`/`unplanToday`, used in `TasksScreen.tsx:460` and `ProjectDetailScreen.tsx:205`, and the `mergedMetadata()` planned-date logic already in `itemComposerPersistence.ts:98-124`). No new persistence code path — just setting the same draft field earlier, at capture time.
  - Visual style: reuse the same selected/unselected chip styling already used for `bucketChip`/`choiceChip` in `ItemEditorSheet.tsx` (`material.accent` fill when selected, `material.fill` otherwise).

- **`Mission` chip** — opens the destination picker (see below).
  - Unset state: label reads "Mission".
  - Set state: label shows the selected Mission's title (truncated with ellipsis if long).

### 2. Destination picker

One shared control, opened from either:
- Tapping the existing "Inbox" context pill (top of sheet, currently `styles.contextChip`, presently non-interactive `Text` — becomes a `TouchableOpacity`).
- Tapping the new `Mission` chip.

Presented as a small bottom sheet:
- Search input at top, filters the list live (case-insensitive substring match on Mission title).
- **Inbox** row pinned above the search results — tapping it clears the Mission assignment (`draft.projectId`/`draft.projectTitle` → `undefined`) and closes the picker.
- Mission list grouped by Domain: Domain title as a section header, its Missions listed underneath. Missions are queried from the existing items table (`type: 'project'`) joined to their Domain via `itemRelations` (`relationType: 'area'`), same relation model already used elsewhere in the app (see `SCHEMA.md`).
- Tapping a Mission row: sets `draft.projectId` + `draft.projectTitle` (existing `ItemDraft` fields, already consumed by `contextLabel()` and the save path in `itemComposerPersistence.ts`), closes the picker.

After a selection, both the top context pill (`contextLabel(draft)`) and the `Mission` chip re-render from the same draft fields — no separate state to keep in sync.

### Data flow / persistence

No schema changes. Both new interactions write to the existing in-memory `ItemDraft` (`types.ts`) that `CaptureSheet` already holds:
- `draft.metadata.plannedDate` (Today toggle)
- `draft.projectId` / `draft.projectTitle` (Mission assignment)

Nothing is persisted to SQLite until the sheet's existing `onSave` → `saveItemDraft()` path runs, same as today. The Mission relation write (`setRelation(itemId, 'project', missionId)`) already happens inside that existing save path when `projectId` is set — no new write logic needed, only earlier/inline UI to set it.

### Error handling

- No network involved; picker data comes from local SQLite.
- Empty search results: show a simple "No missions found" empty state row.
- If a Mission referenced by a stale `projectId` is later deleted, existing save-path behavior is unchanged (not something this feature introduces or needs to handle beyond what already exists).

### Testing

- Unit/manual: toggling Today chip sets/unsets `metadata.plannedDate` correctly; verify item then appears/disappears from Home's Today buckets (`resolveTimeBucket` logic) after save.
- Manual: picker search filters correctly; selecting a Mission updates both pill and chip label; selecting Inbox clears assignment; saved item is correctly related to the chosen Mission (and inherits Domain via existing area relation) after reopening in `ItemEditorSheet`.
