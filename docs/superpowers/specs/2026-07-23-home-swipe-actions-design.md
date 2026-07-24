# Fix Home swipe-action affordances

## Context

An audit of Home's interaction surface (informed by an internal functional review plus a
Mobbin comparison against Things 3 and Tiimo) initially concluded "you can't complete a
single task from Home." That claim was wrong — deeper reading of
[`TimelineSection.tsx`](../../../apps/mobile/src/components/TimelineSection.tsx) found
that tapping the completion disc (`TimeBlockCompletionControl` → `LacquerDiscControl`)
already completes an item correctly, matching Things 3's own "tap the circle" pattern.

What's real, found while re-reading the same code:

- **Swipe left** on an item row is labeled "Activate" (text is accurate — it sets
  `status: 'active'`, which matters for `overdue`/`due-today` items) but renders with a
  **green checkmark icon** — the same glyph the completion disc uses for "done." The icon
  clashes with its own action's meaning.
- **Swipe right** on an item row only offers "Archive." [`SwipeableItem`](../../../apps/mobile/src/components/SwipeableItem.tsx)
  already has a built-in "Done" action (blue, arrow icon, `onComplete`) — `TimelineTaskRow`
  simply never passes it in, so a swipe-to-complete path exists in the shared component but
  isn't reachable from Home.
- **`SwipeableItem`'s icon/label/color are hardcoded inside the component**, not
  configurable per caller. It has exactly one other consumer besides item rows: the time
  block **header** (also in `TimelineSection.tsx`), which reuses the same hardcoded
  "Activate" (checkmark) / "Archive" (archive icon) labels for **different actual actions**
  — the header's left swipe really does `completeAll` (checkmark happens to still make
  sense here) and its right swipe really does `quickAdd` but is labeled "Archive". This is
  the exact "Mismatched" entry `apps/mobile/FLOWS.md` already documents for the header.
- **Haptics currently fire twice** for the row's Activate/Archive swipes — once inside
  `SwipeableItem`'s own `handleActivate`/`handleArchive`, once again in the caller's
  `onActivate`/`onArchive` callback in `TimelineTaskRow`. Pre-existing double-buzz bug,
  unrelated to the above but touched by the same refactor.
- **NextUp → full-screen Focus timer** was considered as a second half of this effort but
  is explicitly **out of scope**: the app has no generic "start a timer on any item"
  subsystem to build on — `usePersistentTimerState` and the Live Activity work
  (`medicationLiveActivity.ts`) are entirely medication-specific. A real Focus mode is a
  new subsystem, not a wiring job, and is deferred to its own future brainstorm.

## Goal

Make Home's swipe actions say what they do. No new capabilities beyond wiring the
already-built "Done" swipe action into item rows; everything else is a labeling/icon
correction plus the double-haptic fix that falls out of the same component change.

## Non-goals

- NextUp → Focus timer (deferred, see Context).
- Delete-via-swipe. Delete stays long-press-only — a destructive action having more
  friction than a same-direction-as-Archive swipe is a reasonable default, not a gap to
  close here.
- Any change to the completion disc, its 380ms animation, or `LacquerDiscControl` itself —
  it already works correctly.
- Any change to `handleItemComplete`'s blocked-item check — swipe-to-complete reuses that
  exact handler, inheriting the check for free, not re-implementing it.

## Approach

### `SwipeableItem` becomes configurable

Replace the `onActivate?: () => void; onArchive?: () => void; onComplete?: () => void;`
prop trio with explicit, caller-supplied action objects:

```ts
export interface SwipeAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightActions?: SwipeAction[];
}
```

`LeftAction` renders `leftAction` if present (nothing if absent, same as today's
`onActivate ? ... : undefined` gating). `RightActions` renders `rightActions` in array
order (0, 1, or 2 items — the row will use 2, the header will use 1). Both still animate
via the existing `drag` shared-value interpolation; only the rendered content changes from
hardcoded to prop-driven.

`SwipeableItem` itself keeps owning "run the action, then close the row" — each action's
`onPress` is wrapped once, generically:

```ts
const runAction = (action: SwipeAction) => {
  action.onPress();
  close();
};
```

No haptic call lives inside `SwipeableItem` anymore. Every action's `onPress` (supplied by
the caller) includes its own haptic — this is what removes the double-fire, since today's
duplicate comes from `SwipeableItem`'s internal handler firing one haptic and the caller's
callback firing a second one for the same gesture.

### Item rows (`TimelineTaskRow` in `TimelineSection.tsx`)

```tsx
<SwipeableItem
  leftAction={{
    key: 'activate',
    icon: <TimerReset size={20} color="#fff" strokeWidth={2} />,
    label: 'Activate',
    color: colors.orange,
    onPress: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      onItemActivate?.(item.id);
    },
  }}
  rightActions={[
    {
      key: 'complete',
      icon: <ArrowRight size={20} color="#fff" strokeWidth={2.5} />,
      label: 'Done',
      color: colors.blue,
      onPress: () => {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        onItemComplete?.(item.id);
      },
    },
    {
      key: 'archive',
      icon: <Archive size={20} color="#fff" strokeWidth={1.5} />,
      label: 'Archive',
      color: colors.textTertiary,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onItemArchive?.(item.id);
      },
    },
  ]}
>
```

`onItemComplete` is the same prop `TimeBlockCompletionControl` already calls (→
`HomeScreen.handleItemComplete`, which checks `getBlockingTask` and shows the existing
"Blocked" alert before completing) — swipe-to-complete gets that check automatically, no
new logic. Icon/label swap for Activate: `TimerReset` (circular-arrow, already exported
from `src/icons.tsx`) in `colors.orange` (already defined in
[`theme/colors.ts`](../../../apps/mobile/src/theme/colors.ts)), replacing the checkmark
that collided with the disc's "done" meaning. `Archive`'s icon/color/label are unchanged
from today, just moved into the array.

### Block header (also in `TimelineSection.tsx`)

```tsx
<SwipeableItem
  leftAction={{
    key: 'completeAll',
    icon: <Check size={20} color="#fff" strokeWidth={2.5} />,
    label: 'Complete All',
    color: colors.green,
    onPress: () => {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      onTimeBlockAction?.(block.key, 'completeAll');
    },
  }}
  rightActions={[
    {
      key: 'quickAdd',
      icon: <Plus size={20} color="#fff" strokeWidth={2.5} />,
      label: 'Add',
      color: colors.blue,
      onPress: () => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onTimeBlockAction?.(block.key, 'quickAdd');
      },
    },
  ]}
>
```

Checkmark stays for `completeAll` (it's the correct glyph there — this label was already
accurate, only the item row's reuse of the same hardcoded checkmark was the problem). The
header's right swipe changes from "Archive" (wrong) to "Add" with a plus icon (correct —
`Plus` is already exported from `src/icons.tsx`), matching what `quickAdd` actually does.
`onTimeBlockAction`'s existing `Alert.alert('Complete All', ...)` confirmation in
`HomeScreen.tsx` is untouched — this only changes what triggers that call being reachable,
not the call itself.

## Data flow / component boundaries

No new state, no new DB functions, no new handlers in `HomeScreen.tsx` — every `onPress`
above calls a handler `HomeScreen` already owns and passes down
(`handleItemComplete`/`handleItemActivate`/`handleItemArchive`/`onTimeBlockAction`).
`SwipeableItem` goes from "owns specific business semantics" (activate/archive/complete)
to "owns generic swipe-reveal-and-run-an-action mechanics" — a cleaner boundary, since the
component has zero opinions about what the actions mean, only how they're presented and
dismissed.

## Error handling

No new failure modes. The one existing error path (blocked-item completion) is inherited
automatically by reusing `handleItemComplete` rather than re-implemented.

## Testing / verification

Swipe/gesture behavior isn't unit-testable in this project (no RN component test runner;
`npm test` covers only pure-logic files via plain `node --test`). Verification is
`npx tsc --noEmit` (must stay clean) plus a manual device checklist:

1. Item row: swipe left → "Activate" shows orange circular-arrow (not checkmark), performs
   the same status change as before.
2. Item row: swipe right → "Done" (blue arrow) appears before "Archive" (grey); tapping
   Done completes the item; tapping Done on a blocked item shows the existing "Blocked"
   alert instead of completing.
3. Item row: only **one** haptic fires per swipe action (not two) for both left and right.
4. Block header: swipe left → "Complete All" (checkmark, green) still shows the existing
   confirmation dialog and completes the whole block on confirm.
5. Block header: swipe right → "Add" (plus icon, blue) opens quick-add for that block —
   label now matches the action.
6. Tap-to-complete via the disc is unchanged (regression check only, not new behavior).
7. Both light and dark mode render correctly (colors used are already theme-aware tokens).
