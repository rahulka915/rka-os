# Home Medication Quick-Log Widget — Design

## Problem

Logging a medication dose currently requires: tap Menu → Medications → find the
specific medication row → tap Take. That's 3+ taps and a full screen navigation
for what should be a one-touch action from Home, the screen the user is on most.

## Goal

Add a compact quick-action on `HomeScreen.tsx` that lets the user log a dose for
any active medication in 2 taps, without leaving Home.

## Design

### Placement & visual style

`MedicationQuickLogWidget.tsx` (new, `src/components/home/`) is a square card
using the same `RiverStoneSurface` treatment as `InboxScrollCard.tsx`, placed
alongside it in the existing top row of `HomeScreen.tsx` — both cards at 50%
width, so Home gains a real two-up "quick actions" row instead of one lone tile.
`HabitsWidget` stays below this row, unchanged.

Card content: a medication icon (`MedicationBottleIcon`, already used on the
Medications screen) + "Log Medication" label. If there are zero tracked
medications (`getMedications().length === 0`), the whole widget renders `null`
— same "don't clutter Home with nothing to do" rule `HabitsWidget` already
follows.

### Interaction flow

1. Tap the card → `showActionSheet` (existing utility, already used for
   `MedicationsScreen`'s long-press menu) lists every active medication as
   `"{title}{dose ? ' ' + dose : ''}"`.
2. Picking one evaluates that medication's eligibility (see below) and shows a
   native `Alert.alert`:
   - Out of stock (`stock === 0` and stock is tracked) → single-button "Out of
     stock" alert, no action offered. Matches `TodayRow.handleTake`.
   - Too soon (`!canTake`) → single-button "Too soon, next dose in Xm/Xh"
     alert. Matches `TodayRow.handleTake`.
   - Otherwise → `Alert.alert('Take {title}', dose ?? 'Record dose?', [Cancel,
     Take, Take + Timer, ...(splitDoseEnabled && !hasPendingHalf ? ['Take
     Half'] : [])])`. "Take Half" triggers the same half-dose confirm flow
     `TodayRow.handleTakeHalf` uses today (asks Take / Take + Timer for the
     half).
3. Confirmed action calls `useMedications()`'s existing `takeMedication` or
   `takeHalfDose` — the exact same functions `MedicationsScreen` calls today,
   so stock decrement, timer start, and Live Activity behavior are identical
   to logging from the full screen. No new DB or service code.

### Refactor: shared eligibility logic

`MedicationsScreen.tsx`'s `useMedState(item)` (lines ~44-57) currently computes
`meta`, `lastLog`, `stock`, `isTrackingStock`, `isLowStock`, `canTake`,
`hasPendingHalf` inline, tied to a React hook (calls `getLastTakenLog`,
`getTotalStock` on every render for the currently-displayed item). The widget
needs the same "can this be taken right now" logic but for an item chosen at
tap-time, outside a component render — so the pure computation is extracted:

```ts
// src/utils/medicationState.ts
export interface MedicationEligibility {
  meta: MedicationMeta;
  lastLog: ActivityLog | undefined;
  stock: number;
  isTrackingStock: boolean;
  isLowStock: boolean;
  canTake: boolean;
  hasPendingHalf: boolean;
}

export function computeMedicationEligibility(item: Item): MedicationEligibility {
  // body = exact logic currently inline in useMedState
}
```

`useMedState` in `MedicationsScreen.tsx` becomes a thin wrapper:
`return computeMedicationEligibility(item)`. Behavior unchanged, verified by
existing manual/typecheck coverage (no test suite currently exercises this
screen). The widget imports `computeMedicationEligibility` directly.

### What this does NOT change

- No new database functions — `takeMedication`/`takeHalfDose`/`getMedications`
  all already exist in `useDb.ts` / `database.ts`.
- No desktop web equivalent in this pass — Medications already has full detail
  parity on desktop (separate feature), and desktop has no "Home quick action"
  concept currently. Out of scope here.
- No changes to `MedicationsScreen.tsx`'s own UI/behavior beyond the internal
  `useMedState` refactor (pure extraction, same output).

## Files touched

- Create: `src/utils/medicationState.ts`
- Create: `src/components/home/MedicationQuickLogWidget.tsx`
- Modify: `src/screens/MedicationsScreen.tsx` (`useMedState` → thin wrapper)
- Modify: `src/screens/HomeScreen.tsx` (add widget to top row, fetch
  `useMedications()`)
