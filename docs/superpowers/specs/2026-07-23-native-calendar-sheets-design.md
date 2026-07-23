# Native iOS chrome for Calendar sheets + timeline (sub-project 1 of app-wide native push)

## Context

The app currently mixes two UI strategies: hand-rolled RN/Reanimated chrome (custom
`BottomSheet.tsx` with its own drag-to-dismiss physics and remount-on-reopen logic,
plain RN `TextInput`), and, in one prior refactor
([`SchedulePickers.tsx`](../../../apps/mobile/src/components/item-composer/SchedulePickers.tsx)),
native SwiftUI components bridged in via `@expo/ui` (already installed, `~57.0.4`). The
native picker refactor read as more correct — real momentum, haptics, VoiceOver — for
free, with no custom code to maintain.

The immediate trigger: a bug where `CaptureSheet`'s custom `BottomSheet` got opened twice
in quick succession (a side effect fired from inside a `setState` updater, which React can
replay), and because `BottomSheet` intentionally mounts a fresh `KeyboardAvoidingView` /
`TextInput` on every open, the second open tore the keyboard-focused text field out from
under active typing, corrupting the saved title. The immediate bug is already fixed
(the side effect no longer lives inside the updater). This spec is the follow-on decision:
lean on native chrome going forward so this entire class of custom-state-machine bug has
less surface to occur in, and the app reads as more authentically iOS along the way.

This is sub-project 1 of a broader "prefer native iOS-optimized components app-wide"
effort. Scope here is deliberately narrow: the Calendar screen's three item sheets
(Capture, Preview, Edit) and the timeline's block interaction chrome. Other screens
(Inbox, Medications, etc.) are separate future sub-projects, out of scope here.

## Goal

Make the Calendar sheet + timeline surfaces feel like a real iOS app by adopting native
SwiftUI chrome (via `@expo/ui`) wherever a native primitive exists, while leaving the
custom day-timeline canvas (hour grid, colored blocks, drag gestures) as RN/Reanimated —
there is no native calendar/timeline widget, and the existing drag interactions already
mirror real iOS Calendar's tap-to-open / long-press-to-drag pattern.

## Non-goals

- Rebuilding the hour-grid canvas, lane layout, or the drag-to-create / drag-to-reschedule
  Pan gestures. These stay exactly as they are.
- `LacquerDiscControl` (the complete-toggle) keeps its bespoke visual identity — not part
  of this pass.
- `ItemEditorSheet` is **not** touched by the BottomSheet swap below — it already presents
  through RN's `Modal` with `presentationStyle="formSheet"`, which is itself a native
  UIKit sheet presentation, not the custom `BottomSheet.tsx`. Its many `TextInput`s and
  hand-rolled chip/segment pickers (duration, priority, time-of-day, repeat) are real
  native-conversion candidates but are a separate, larger sub-project — out of scope here.
- Android is not addressed. `@expo/ui/swift-ui` is iOS-only, matching the existing
  `SchedulePickers.tsx` precedent (no Android branch). Guarded with `Platform.OS` so nothing
  hard-crashes if Android is ever run, but no Android-equivalent chrome is built.

## Approach

### Phase 1 — Native `BottomSheet` chrome for Capture + Preview sheets

Replace [`BottomSheet.tsx`](../../../apps/mobile/src/components/ui/BottomSheet.tsx)'s
custom Reanimated implementation (manual backdrop opacity, pan-to-dismiss gesture,
`openId`-keyed remount-on-reopen) with `@expo/ui`'s native `BottomSheet` component,
wrapped in `Host`. This is a real native `.sheet()` presentation: native drag-to-dismiss,
detents, backdrop, all for free, with no hand-built state machine to have bugs in.

Content stays RN. `@expo/ui` ships `RNHostView`, an escape hatch that mounts a normal RN
subtree inside a native SwiftUI container. So `CaptureSheet.tsx` and
`TimelinePreviewSheet.tsx`'s inner layout (Tamagui/StyleSheet, existing header
Cancel/Save buttons, context chip, etc.) is unchanged in this phase — only the outer shell
swaps from custom to native. This is the lowest-risk slice with the biggest "feels native"
payoff (real sheet physics) and it structurally removes the double-open failure mode:
there's no more `presentation`/`isRendered`/`openId` state machine to desync.

New shared component: `src/components/ui/NativeBottomSheet.tsx`, matching the subset of
`BottomSheet.tsx`'s props surface `CaptureSheet` and `TimelinePreviewSheet` actually use
(`visible`, `onClose`, `isDark`, `title`, `headerLeft`, `headerRight`, `topAnchored`,
`scrollable`, `contentContainerStyle`, `sheetStyle`, `children`) so both swap their import
with no other changes. `BottomSheet.tsx` itself is **not** deleted in this pass —
`QuickCreateSheet.tsx`, `LogDoseSheet.tsx`, and `MedicationTimerSheet.tsx` still depend on
it, and migrating those is out of scope here (they belong to future sub-projects, same as
`ItemEditorSheet`). Two sheet implementations coexist temporarily by design; each future
sub-project retires one more caller until `BottomSheet.tsx` has none left and can go.

### Phase 2 — Native `TextField` for Capture sheet's title/notes

`CaptureSheet.tsx`'s title and notes `TextInput`s become `@expo/ui`'s native `TextField`.
This directly targets the bug class described above: native text handling doesn't have
React's controlled-value-vs-native-buffer race that caused the corruption. Wire via
`useNativeState` (per the `TextField` API) rather than plain React state, per
`@expo/ui`'s intended usage — plain `value`/`onChangeText` controlled-component wiring
works too but reintroduces the same class of re-render race this phase exists to remove.

### Phase 3 — Native `Menu` quick actions on timeline blocks

Add a small `•••` affordance to `TimelineEntryCard` (in `CalendarScreen.tsx`) that opens
`@expo/ui`'s `Menu` (tap-triggered dropdown — not `ContextMenu`, which owns long-press
natively and can't be cleanly sequenced with the existing Pan gesture) with actions: Edit,
Complete, Delete. `Menu`'s `label` accepts arbitrary RN content via a slot, so the `•••`
glyph stays whatever icon component the timeline already uses; the dropdown *items* are
native `Button`s. No gesture conflict: `Menu` triggers on tap, entirely orthogonal to the
existing long-press-drag-to-reschedule `Gesture.Pan`.

This is additive — the long-press-drag reschedule gesture is untouched. Edit was
previously only reachable via the Preview sheet's Edit button; it stays reachable there
too. Complete/Delete call the same `db/database.ts` functions
`ItemComposerProvider.complete()`/`remove()` already wrap (`updateItemStatus(id,
'completed')`, `deleteItem(id)`) directly on `entry.item.id` — no need to route through
the composer's draft state for a one-tap action, and no new persistence logic. Duplicate
is deliberately excluded: it would need new "copy an item" persistence logic that doesn't
exist anywhere in the app today, which is a feature addition, not a native-chrome
conversion — out of scope for this pass.

## Data flow / component boundaries

- `NativeBottomSheet` owns presentation state (`isPresented`) and dismiss callbacks only —
  no knowledge of what it's presenting. Same contract as today's `BottomSheet`.
- `CaptureSheet` / `TimelinePreviewSheet` keep owning their draft/content state exactly as
  today (`ItemComposerProvider` is untouched) — they just render inside a different shell.
- The new `•••` `Menu` on `TimelineEntryCard` reuses `onOpenEdit` for Edit, and gets two
  new callback props threaded down the same way `onReschedule` is today — `onComplete` and
  `onDelete` — both implemented in `CalendarScreen` as direct `db/database.ts` calls
  (`updateItemStatus`/`deleteItem`) followed by `refreshAll()`, not routed through
  `ItemComposerProvider`. No new global state.

## Error handling

No new failure modes introduced beyond what native `@expo/ui` components already handle
(they're native UIKit/SwiftUI controls — no JS-side gesture arbitration to get wrong).
Delete via the new Menu reuses the existing confirmation pattern already used in
`ItemEditorSheet.requestDelete` (`Alert.alert` with a destructive action) rather than
inventing a new one.

## Testing / verification

No native SwiftUI rendering is testable through the web Browser preview tools — this
requires the EAS dev client on a physical device or the iOS Simulator. Verification plan
per phase:

1. Phase 1: open Capture sheet, Preview sheet — confirm native drag-to-dismiss, confirm
   double-open no longer possible (same drag-to-create repro steps from the bug we just
   fixed), confirm dark/light mode both render correctly through `@expo/ui`'s theming.
2. Phase 2: type quickly into title/notes immediately after the sheet's entrance
   animation (the original repro conditions) — confirm no corruption, confirm
   autocorrect/selection behave like native Notes/Messages.
3. Phase 3: long-press-drag still reschedules with no interference from the new `•••`
   tap target; Menu actions (Edit/Complete/Delete) each produce the expected result;
   Delete confirms via Alert before removing.

`npx tsc --noEmit` must stay clean throughout — this codebase's usual level of
verification for changes that need a device to fully confirm.

## Rollout

Land phase by phase (1 → 2 → 3), each independently shippable and revertable — Phase 2
depends on Phase 1's shell existing (native `TextField` should live inside the native
sheet, not the old custom one) but Phase 3 is independent and could land in any order.
