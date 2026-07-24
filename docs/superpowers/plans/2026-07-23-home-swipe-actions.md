# Home Swipe-Action Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix Home's swipe-action icons/labels so they say what they do — item rows get a
non-checkmark "Activate" icon plus a working swipe-to-complete, and the block header's
mislabeled "Archive" (actually quick-add) becomes accurate.

**Architecture:** `SwipeableItem` moves from hardcoded action icons/labels/haptics to
caller-supplied `SwipeAction` objects (`leftAction`, `rightActions`). Its two consumers
(item rows, block header) in `TimelineSection.tsx` each supply their own accurate
icon/label/color/haptic per action. No new files, no new state, no new DB calls.

**Tech Stack:** React Native, `react-native-gesture-handler` (`ReanimatedSwipeable`),
`react-native-reanimated`, TypeScript.

## Global Constraints

- `npx tsc --noEmit` (run from `apps/mobile/`) must be clean after every task.
- No automated test coverage exists for gesture/swipe UI in this project (only
  plain-Node tests for pure logic via `npm test`) — verification is `tsc` plus a manual
  device checklist, per the spec.
- `SwipeableItem.tsx` has exactly two consumers, both in `TimelineSection.tsx` — no other
  file imports it, so this refactor's blast radius is fully contained to one file plus its
  one consumer file.
- `handleItemComplete`'s existing blocked-item check (`getBlockingTask` + `Alert.alert`)
  must not be duplicated or bypassed — swipe-to-complete calls the exact same
  `onItemComplete` prop the completion disc already uses.

---

### Task 1: Make `SwipeableItem` accept configurable actions

**Files:**
- Modify: `apps/mobile/src/components/SwipeableItem.tsx` (full rewrite, 117 lines)

**Interfaces:**
- Produces: `export interface SwipeAction { key: string; icon: React.ReactNode; label:
  string; color: string; onPress: () => void; }` and `SwipeableItemProps { children:
  React.ReactNode; leftAction?: SwipeAction; rightActions?: SwipeAction[]; }`. Task 2 and
  Task 3 import `SwipeAction` and use these props.

- [ ] **Step 1: Replace the file contents**

```tsx
import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { spacing, radius } from '../theme';

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

function LeftAction({ drag, action, onPress }: {
  drag: SharedValue<number>;
  action: SwipeAction;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(drag.value, [0, 80], [0.8, 1], Extrapolation.CLAMP) }],
    opacity: interpolate(drag.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={[styles.leftAction, style]}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: action.color }]} onPress={onPress}>
        {action.icon}
        <Text style={styles.actionLabel}>{action.label}</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function RightActions({ drag, actions, onPress }: {
  drag: SharedValue<number>;
  actions: SwipeAction[];
  onPress: (action: SwipeAction) => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(drag.value, [-80, 0], [1, 0.8], Extrapolation.CLAMP) }],
    opacity: interpolate(drag.value, [-60, 0], [1, 0], Extrapolation.CLAMP),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingRight: spacing[2],
    marginBottom: spacing[2],
  }));

  return (
    <Reanimated.View style={style}>
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={[styles.actionBtn, { backgroundColor: action.color }]}
          onPress={() => onPress(action)}
        >
          {action.icon}
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </Reanimated.View>
  );
}

export function SwipeableItem({ children, leftAction, rightActions }: SwipeableItemProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();

  const runAction = (action: SwipeAction) => {
    action.onPress();
    close();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      enableTrackpadTwoFingerGesture
      renderLeftActions={
        leftAction
          ? (_, drag) => <LeftAction drag={drag} action={leftAction} onPress={() => runAction(leftAction)} />
          : undefined
      }
      renderRightActions={
        rightActions && rightActions.length > 0
          ? (_, drag) => <RightActions drag={drag} actions={rightActions} onPress={runAction} />
          : undefined
      }
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    justifyContent: 'center',
    paddingLeft: spacing[2],
    marginBottom: spacing[2],
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: radius.card,
    paddingVertical: spacing[3],
    gap: 4,
  },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
```

Note what changed from the previous version: `colors`/`Check`/`Archive`/`ArrowRight`
imports are dropped (icons/colors now arrive as props from the caller, not hardcoded
here). No haptic call remains inside `SwipeableItem` itself except the pre-existing
`onSwipeableWillOpen` one (fires once when a swipe begins revealing, unrelated to which
action is chosen) — each action's own `onPress` (supplied by the caller in Tasks 2–3)
carries its own haptic. This is what removes the double-haptic: today's duplicate comes
from this file's old `handleActivate`/`handleArchive`/`handleComplete` each firing a
haptic AND the caller's callback firing a second one for the same gesture.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: **errors** at this point — `TimelineSection.tsx` (Task 2/3's target) still calls
the old `onActivate`/`onArchive`/`onComplete` props, which no longer exist on
`SwipeableItemProps`. This is expected; Task 2 fixes it. Do not attempt to fix
`TimelineSection.tsx` in this task.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/SwipeableItem.tsx
git commit -m "$(cat <<'EOF'
refactor(mobile): make SwipeableItem's swipe actions configurable

Was hardcoding icon/label/color per side (checkmark+"Activate" left,
archive-icon+"Archive" right, plus an unused optional "Done"), which
meant its two consumers (item rows, block header) shared labels that
only made sense for one of them. Replaced with caller-supplied
SwipeAction objects. Also removes a double-haptic bug — this file's
own per-action haptic and the caller's own haptic were both firing for
the same swipe; haptics now live only in the caller-supplied onPress.

This intentionally breaks TimelineSection.tsx's build — fixed in the
next commit.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 2: Fix item rows — Activate icon + swipe-to-complete

**Files:**
- Modify: `apps/mobile/src/components/TimelineSection.tsx:1-22` (imports)
- Modify: `apps/mobile/src/components/TimelineSection.tsx:146-196` (`TimelineTaskRow`'s
  `SwipeableItem` usage)

**Interfaces:**
- Consumes: `SwipeAction`, `SwipeableItem` from Task 1 (`../SwipeableItem` relative to
  this file, i.e. `import { SwipeableItem, type SwipeAction } from './SwipeableItem';` —
  already imported without the type in the existing file, just add `type SwipeAction`).
  `TimerReset`, `ArrowRight`, `Archive` from `'../icons'`. `colors` from `'../theme'`.
  `onItemComplete`, `onItemActivate`, `onItemArchive` — all already props of
  `TimelineTaskRow`, unchanged.

- [ ] **Step 1: Add the new icon and `colors` imports**

Find (line 6):
```tsx
import { SwipeableItem } from './SwipeableItem';
```

Replace with:
```tsx
import { SwipeableItem, type SwipeAction } from './SwipeableItem';
```

Find (line 9):
```tsx
import { getThemeColors, type ThemeColors } from '../theme';
```

Replace with:
```tsx
import { colors, getThemeColors, type ThemeColors } from '../theme';
```

Find (line 11), immediately after `import { TimeIcon } from './icons/TimeIcon';`, add a
new import line:
```tsx
import { TimerReset, ArrowRight, Archive, Check, Plus } from '../icons';
```

(All five are already exported from `apps/mobile/src/icons.tsx` — `TimerReset` and
`ArrowRight`/`Archive`/`Check`/`Plus` are existing exports, none need to be added there.
`Check` and `Plus` are needed for Task 3, imported here too since both tasks touch the
same file.)

- [ ] **Step 2: Replace `TimelineTaskRow`'s `SwipeableItem` usage**

Find (the `<SwipeableItem>` opening tag through its props, inside `TimelineTaskRow`):
```tsx
      <SwipeableItem
        onActivate={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onItemActivate?.(item.id);
        }}
        onArchive={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onItemArchive?.(item.id);
        }}
      >
```

Replace with:
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

Leave everything between this opening tag and the matching `</SwipeableItem>` (the row's
inner `View`/`TouchableOpacity`/title/notes/badges/`DragHandleButton`/hairline) completely
unchanged — only the `SwipeableItem` props change. `onItemComplete` here is the exact same
prop `TimeBlockCompletionControl` (a few lines above, unchanged by this task) already
calls, which resolves to `HomeScreen.handleItemComplete` — the blocked-item check is
inherited automatically, not reimplemented.

- [ ] **Step 3: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: still has errors, from Task 3's untouched header `SwipeableItem` usage (still
calling the old `onActivate`/`onArchive` props). This is expected; Task 3 fixes it.

- [ ] **Step 4: Commit**

```bash
git add apps/mobile/src/components/TimelineSection.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): Home item rows — Activate icon + working swipe-to-complete

Swipe left "Activate" no longer shows a checkmark (which collided with
the completion disc's own "done" meaning) — now an orange circular-
arrow icon. Swipe right gains a "Done" action (blue, reuses the same
onItemComplete/handleItemComplete the disc already calls, inheriting
its blocked-item check) ahead of the existing Archive — SwipeableItem
already supported this action, Home just never wired it in.

Still breaks the block header's SwipeableItem usage — fixed next.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 3: Fix block header — correct label for the real quick-add action

**Files:**
- Modify: `apps/mobile/src/components/TimelineSection.tsx:476-484`

**Interfaces:**
- Consumes: `SwipeAction`, `Check`, `Plus`, `colors` — all imported in Task 2, already
  available in this file.

- [ ] **Step 1: Replace the block header's `SwipeableItem` usage**

Find:
```tsx
        <SwipeableItem
          onActivate={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onTimeBlockAction?.(block.key, 'completeAll');
          }}
          onArchive={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTimeBlockAction?.(block.key, 'quickAdd');
          }}
        >
```

Replace with:
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

The checkmark icon stays for `completeAll` — it was already the correct glyph for that
action; only the item row's *reuse* of the same hardcoded icon was the problem (fixed in
Task 2). Only the right-side label/icon changes here, from "Archive" (wrong — it never
archived anything) to "Add" (correct — matches what `quickAdd` actually does).
`onTimeBlockAction`'s handling in `HomeScreen.tsx` (the `Alert.alert('Complete All', ...)`
confirmation and the `completeAllInTimeBlock`/quick-add calls it makes) is untouched by
this plan — only what triggers reaching it changes.

- [ ] **Step 2: Typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: clean, no errors. Both `SwipeableItem` consumers now use the new API.

- [ ] **Step 3: Commit**

```bash
git add apps/mobile/src/components/TimelineSection.tsx
git commit -m "$(cat <<'EOF'
fix(mobile): block header swipe-right label — Add, not Archive

The header's right swipe already triggered quickAdd; it was just
labeled "Archive" (an artifact of reusing SwipeableItem's old hardcoded
label meant for item rows). Now shows "Add" with a plus icon, matching
the FLOWS.md-documented mismatch. Left-swipe "Complete All" keeps its
checkmark — that one was already correct.

Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>
EOF
)"
```

---

### Task 4: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full typecheck**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Confirm no stray old prop names remain**

Run: `cd apps/mobile && grep -n "onActivate=\|onArchive=\|onComplete=" src/components/TimelineSection.tsx src/components/SwipeableItem.tsx`
Expected: no matches (the old prop names `onActivate`/`onArchive`/`onComplete` should not
appear anywhere — both files now use `leftAction`/`rightActions`/`SwipeAction.onPress`).

- [ ] **Step 3: Confirm `SwipeableItem` has exactly its two known consumers**

Run: `cd apps/mobile && grep -rln "SwipeableItem" src --include="*.tsx" | grep -v "SwipeableItem.tsx"`
Expected: only `src/components/TimelineSection.tsx` — confirms no other file was affected
by the prop-shape change (if a third consumer existed and wasn't updated, this plan would
have left it broken; this step catches that).

- [ ] **Step 4: Run the pure-logic test suite (sanity check nothing else broke)**

Run: `cd apps/mobile && npm test`
Expected: all existing tests pass (this plan doesn't touch any file `npm test` covers —
regression guard only).

- [ ] **Step 5: Report the manual verification checklist to the user**

Requires the EAS dev client on a physical iPhone or the iOS Simulator — not reachable from
this session's tools (gesture/swipe behavior on native `ReanimatedSwipeable`). Report this
checklist and wait for confirmation before considering the work done:

1. Item row: swipe left → "Activate" shows an orange circular-arrow icon (not a
   checkmark); the underlying status change still happens.
2. Item row: swipe right → "Done" (blue, arrow icon) appears before "Archive" (grey);
   tapping Done completes the item; tapping Done on a blocked item shows the existing
   "Blocked" alert instead of completing (test with an item that has an active
   dependency, via long-press → "Depends on..." to set one first if needed).
3. Item row: exactly one haptic buzz per swipe action (left or right), not two.
4. Block header: swipe left → "Complete All" (checkmark, green) still shows the
   confirmation dialog and completes the whole block on confirm.
5. Block header: swipe right → "Add" (plus icon, blue) opens quick-add for that block.
6. Tap-to-complete via the completion disc is unchanged (regression check).
7. Both light and dark mode render all the above correctly.
