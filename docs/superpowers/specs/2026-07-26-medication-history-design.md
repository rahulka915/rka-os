# Medication Dose History — Richer History Display

**Date:** 2026-07-26
**Status:** Approved, pending implementation plan

## Problem

The Medications screen's HISTORY section shows each medication as a row of 5
day-cells, each a plain checkmark (taken) or empty gray square (not taken).
This is misleading:

- Some medications are taken multiple times a day; the checkmark can't
  distinguish "took it twice today" from "took it once."
- Some medications are as-needed (PRN), not a daily habit — a run of gray
  squares looks like "missed days" when really nothing was expected.
- Tapping into the full history sheet shows a flat, ungrouped list of the
  last 30 raw dose timestamps with no sense of which day each belongs to or
  how many doses landed on the same day.

## Non-goal

There is currently no per-medication schedule concept in the data model
(`MedicationMeta.frequency` exists but is unused/unwired; there's no
once-daily/twice-daily/PRN flag). This change does **not** add one — no new
schema field, no changes to the add/edit medication form. It only makes
better use of data that's already captured (dose log timestamps), so a
medication's actual usage pattern is visible without requiring the user to
first declare an expected schedule.

## Changes

### 1. `getMedicationDoseHistory` (apps/mobile/src/db/database.ts)

Currently returns `{ date: string; taken: boolean }[]` — collapses all doses
on a day to a single boolean.

Change to return `{ date: string; count: number }[]` — the number of
`medication-taken` log entries recorded on that calendar day. (Count of log
entries, not sum of `amount`, so split-dose halves count as 1 "time taken,"
matching how a user thinks about "did I take this twice today.")

### 2. Compact HISTORY row (`HistoryRow` in MedicationsScreen.tsx)

Each of the 5 day-cells (unchanged: last 5 calendar days, oldest → newest)
renders the count instead of a checkmark icon:

- `count === 0`: gray background (`palette.fill`), empty — same as today's
  "not taken" state.
- `count === 1`: light green background, count number in white/dark text as
  appropriate for contrast.
- `count >= 2`: solid green background, count number.

No layout change — same 20×20 cell size, same row of 5, just swapping the
`Check` icon for a `Text` node showing the count (or nothing, for 0).

### 3. Full history sheet (`SeeAllHistorySheet` in MedicationsScreen.tsx)

Currently: flat list of the last 30 raw `ActivityLog` rows via
`getMedicationLogs(item.id, 30)`, each rendered as a `LogEntry` with no
grouping.

Change: group the same 30 logs by calendar day before rendering:

- Each day gets a header: `Today` / `Yesterday` / `Jul 24` (reusing the
  existing date-label logic already used elsewhere in this file), plus the
  dose count for that day (e.g. "Today · 2 doses").
- Under each day header, render the existing `LogEntry` rows for that day's
  logs (unchanged — same edit/delete/resume-timer affordances), most recent
  first within the day.
- Days are still ordered most-recent-first, consistent with current sheet
  behavior.

## Out of scope

- No change to `MedicationMeta`, the add/edit medication form, or any
  schedule/frequency/PRN concept.
- No change to stock/refill tracking (`getStockBreakdown`, "N left of M").
- Compact row stays at 5 days (not expanded to 7).
