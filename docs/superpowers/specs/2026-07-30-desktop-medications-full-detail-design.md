# Desktop Medications — Full Detail Parity

## Goal

Bring the desktop Medications screen up to full parity with mobile's feature set: low-stock
warnings, live time-since-last-dose, packaged-stock breakdown, restock, a full log/timer panel
(relative or exact-time dose logging, live elapsed timer with pause/resume/reset, editable dose
history), a 5-day dose-history strip, and a complete create/edit form covering every packaging
field. Excludes only what has no meaningful desktop equivalent: iOS Live Activities and local
push notifications (the underlying timer *state* and elapsed-time *display* are fully portable
pure functions with zero native dependency, confirmed by reading `timerMath.ts`/
`timerPresentation.ts` — only the OS-level lock-screen widget and notification scheduling are
skipped).

## Context

Desktop currently has a minimal `MedicationsScreen.web.tsx`/`MedicationDetailForm.web.tsx`:
title, dose text, read-only total stock, "Log dose now", a 5-entry plain log list, delete. Mobile
has a much richer feature set researched directly from `database.ts`, `MedicationsScreen.tsx`,
`LogDoseSheet.tsx`, `timerMath.ts`, and `timerPresentation.ts`. Everything needed is either
already a pure function (portable verbatim) or a thin wrapper around `activityLogs`/`items`
metadata, which already sync to web via the existing Firestore mirror.

## Data layer changes (`database.web.ts`)

All additions are direct ports of the native functions, substituting `getDb().runSync`/
`getAllSync` with the existing web primitives (`getActivityLogsSnapshot`, `putActivityLogDoc`,
`patchActivityLogDoc`, `getItemsSnapshot`, `patchItem`) — no behavior changes, no new pure logic:

- Replace the `getStockBreakdown`/`getContainerSummary` stubs with verbatim ports (pure
  functions over `MedicationMeta`, zero DB dependency in the native version already).
- Add `pauseMedicationTimer`, `resumeMedicationTimer`, `stopMedicationTimer`,
  `resetMedicationTimer`, `startTimerFromLoggedDose`, `completeMedicationTimer`,
  `getActiveMedicationTimers`, `getPersistentMedicationTimers` — each reads/patches an
  `activityLogs` row's `details` JSON, same shape as native.
- Add a private `syncLastTakenAt(itemId)` helper (mirrors native's `_syncLastTakenAt`) called
  after any log mutation, recomputing `meta.lastTakenAt` from the remaining logs.
- Re-export the pure helpers directly from their existing source modules (no duplication):
  `resolveAutoStopAfterMs`, `getActiveElapsedMs`, `getAutoStopState` from
  `domain/medicationTimer/timerMath.ts`; `presentMedicationTimer`, `formatElapsedLabel` from
  `utils/timerPresentation.ts`; `countDosesByDay`, `groupLogsByDay` from
  `utils/medicationDoseHistory.ts` — all already framework-agnostic, already imported by
  `database.web.ts` in one case (`countDosesByDay`).
- Explicitly **not** ported: `markMedicationTimerNotified`, `setMedicationTimerNotificationId`,
  `getTimerWidgetPreferences`/`setTimerWidgetPreferences` — purely about local notification
  scheduling and the native lock-screen widget, no desktop UI will ever call them.

## UI changes

### `MedicationsScreen.web.tsx` (rewrite)

Three sections, mirroring mobile's `NeedsAttentionRow`/`TodayRow`/`HistoryRow`:

1. **Needs Attention** — medications where stock is tracked (`containers` or `stockRemaining`
   set) and `getTotalStock(meta) <= (refillThreshold ?? 5)`. Orange-tinted row: title, dose,
   "No doses remaining" / "N left — running low", a "Restock" chip.
2. **Today** — every medication: title, dose, live "time since last dose" (updates every 30s
   via `setInterval`, same granularity as mobile: "Just now" / "Nm ago" / "Xh Ym ago" /
   "Xd Yh ago" / "Never taken"), stock summary via `getContainerSummary` when packaging is
   configured, a **Take** button (click = log now; a small secondary "+Timer" link next to it
   starts a timer in the same action), disabled/"Wait" label during an active
   `minHoursBetweenDoses` cooldown (bypassed while a split-dose half is pending), "Take other
   half" label when `pendingHalfDoseAt` is set.
3. **History** — 5-day dot strip per medication via `getMedicationDoseHistory(id, 5)`: empty
   dot = 0 doses, light dot with number = 1, filled dot with number = 2+. Click opens the same
   log panel (below) which also serves as the full history view (mobile's separate
   `SeeAllHistorySheet` is folded into one panel here rather than a second sheet, since desktop
   already has more screen space to show a longer list at once).

Row click (anywhere except the Take button) opens `MedicationLogPanel` in the shared
`DetailPanel`. A pencil icon opens `MedicationEditForm` in the same panel pattern used for
Domains/Missions. A "+ Add medication" quick-capture bar at the top creates via
`createMedication(title, {})`, then the user fills in details via the edit form.

### `MedicationLogPanel.web.tsx` (new)

Replaces the current minimal recent-doses list inside `MedicationDetailForm`. Contents:

- **Log a dose** — two inputs: a relative one ("X hours ago" / "X minutes ago", two small
  number fields) and an "or pick exact time" toggle revealing a plain date+time text pair
  (reuses the `YYYY-MM-DD`/`HH:MM` input pattern already established in `ItemDetailForm`'s
  Schedule fields for consistency). Two submit buttons: **Log only** and **Log + Timer**.
- **Active timer card** — shown only if `getPersistentMedicationTimers()` has an entry for
  this medication: elapsed time (live, `setInterval` tick, formatted via
  `presentMedicationTimer`), Pause/Resume toggle, Reset, Stop.
- **Dose history** — every log for this item (no arbitrary cap, unlike mobile's two-tier
  5/10/30 limits — desktop shows them all in one scrollable list), each row: formatted
  time, relative-time subtitle, and inline actions: **Resume timer** (only if no timer
  currently active for that specific log), **Edit** (inline time fields), **Delete**.

### `MedicationEditForm.web.tsx` (new)

Full field form, replacing the ad-hoc dose-only field in the old detail form:

| Field | Control |
|---|---|
| Title | text input (existing pattern) |
| Dose | text input, e.g. "400mg" |
| Initial / current stock | text input (numeric); label switches to "Stock remaining (use Restock to add more)" and becomes read-only once the medication has been created, matching mobile |
| Min hours between doses | text input (numeric) |
| Can be split | toggle chip, subtitle "e.g. take half now, the other half later with no wait" |
| Auto-stop after | text input (numeric hours) + preset chips 4h/5h/8h/12h/18h/24h |
| Container label | text input, e.g. "box" |
| Pills per container | text input (numeric) |
| Containers per restock | text input (numeric) |
| Sheets per container (optional) | text input (numeric) |
| Pills per sheet (optional) | text input (numeric) |
| Packaging note (optional) | text input |
| Delete | existing destructive row pattern |

`maxPerDay`/`frequency` are confirmed dead fields on mobile (declared in the type, never read
or exposed in any UI) — not added to the desktop form either, since there's nothing to port.

### Restock

A "Restock" chip/link (Needs Attention row and inside `MedicationLogPanel`) triggers
`window.prompt("How many {containerLabel}s ({containerSize} each)?", String(containersPerRestock ?? 1))`
(or "How many pills?" defaulting to 30 for unpackaged meds) — mirrors mobile's
`Alert.prompt`, using the browser-native equivalent already established for destructive
confirmations (`window.confirm`) elsewhere in this codebase. Calls the existing
`restockMedication(id, count)` (already implemented and additive).

## Out of Scope

- iOS Live Activities / local push notifications (no desktop equivalent).
- The native lock-screen timer widget and its preferences.
- Any change to mobile code — this is desktop-only, same as every prior phase.

## Self-Review

- **Placeholder scan:** none.
- **Consistency:** reuses `webColors`/`webSpacing`/`webRadius`/`webFontSize`, the existing
  `DetailPanel` + pencil-icon-opens-edit-form pattern from Domains/Missions, and the
  `YYYY-MM-DD`/`HH:MM` text-input convention from `ItemDetailForm`/`CalendarScreen`.
- **Scope:** one data-layer file + one screen rewrite + two new form components — comparable
  in size to the Areas & Projects phase (also 3-4 files), still a single implementation pass.
- **Ambiguity resolved:** dose history shows the full list on desktop rather than mobile's
  10-then-"see all"-30 two-tier limit, since desktop already has the room and a second sheet
  would just add friction for no benefit.
