# Mobile Web-Parity Overhaul Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Bring `apps/mobile` materially closer to the old web app by rebuilding the missing shell behaviors, custom interaction patterns, and higher-polish component surfaces instead of continuing with one-off patches.

**Architecture:** Treat the old web app as the product reference for behavior and hierarchy, but not as a literal component-for-component port. Start by building a small mobile primitive layer for sheets, floating surfaces, timer widgets, rows, and animated state changes. Then migrate the highest-value product surfaces in order: persistent medication timer, quick capture and inbox, shell and navigation polish, and finally secondary overlays such as audio player and app metadata surfaces.

**Tech Stack:** Expo, React Native, TypeScript, Tamagui, react-native-reanimated, react-native-gesture-handler, expo-haptics, expo-sqlite, existing `apps/mobile/src/db` logic

---

## Parity Audit Summary

### Already Rebuilt Well Enough To Preserve

- `apps/mobile/App.tsx`
- `apps/mobile/src/screens/HomeScreen.tsx`
- `apps/mobile/src/screens/InboxScreen.tsx`
- `apps/mobile/src/screens/QuickAddScreen.tsx`
- `apps/mobile/src/screens/MedicationsScreen.tsx`
- `apps/mobile/src/components/SwipeableItem.tsx`
- `apps/mobile/src/components/ContextMenu.tsx`
- `apps/mobile/src/db/database.ts`

These provide the correct product skeleton and data behavior. They should be refined, not replaced blindly.

### Partially Rebuilt But Below Web Standard

- `apps/mobile/src/components/PersistentTimerBanner.tsx`
- `apps/mobile/src/components/LogDoseSheet.tsx`
- `apps/mobile/src/components/AppHeader.tsx`
- `apps/mobile/src/components/audio/AudioPlayerHost.tsx`
- `apps/mobile/App.tsx` tab bar shell

These work, but they do not yet match the old web app in interaction depth, visual hierarchy, or persistence.

### Missing Web-Level Patterns Entirely

- shared bottom-sheet primitive equivalent to `src/components/ui/primitives.tsx`
- pull-to-refresh shell behavior from `src/components/shell/PullToRefresh.tsx`
- richer app info / version history surfaces from `src/components/shell/AppInfoModal.tsx` and `src/components/ui/VersionHistoryModal.tsx`
- action-list level reusable schedule row system from `src/components/actions/ActionList.tsx`
- full shell-level floating widget treatment from `src/components/shell/ActiveTimersBanner.tsx`

---

## Success Criteria

- The mobile medication timer feels like a persistent system widget, not a plain banner.
- Quick capture, inbox, and shell overlays feel like one cohesive design family.
- Motion is intentional: expand, collapse, press, sheet open, and dock/minimize transitions feel deliberate.
- Shared mobile primitives replace repeated bespoke layout code.
- The old web app is no longer meaningfully ahead on core daily-use flows.

---

### Task 1: Build the mobile parity primitives

**Files:**
- Create: `apps/mobile/src/components/ui/FloatingSurface.tsx`
- Create: `apps/mobile/src/components/ui/BottomSheet.tsx`
- Create: `apps/mobile/src/components/ui/DragHandle.tsx`
- Create: `apps/mobile/src/components/ui/SurfaceCard.tsx`
- Create: `apps/mobile/src/components/ui/ActionRow.tsx`
- Modify: `apps/mobile/src/theme/colors.ts`
- Modify: `apps/mobile/src/theme/spacing.ts`
- Modify: `apps/mobile/src/theme/index.ts`

**Step 1: Audit repeated surface styling in mobile**

Review repeated border radius, blur-like fills, hairlines, shadows, paddings, and icon button treatments in:
- `apps/mobile/src/components/PersistentTimerBanner.tsx`
- `apps/mobile/src/components/LogDoseSheet.tsx`
- `apps/mobile/src/components/audio/AudioPlayerHost.tsx`
- `apps/mobile/src/screens/QuickAddScreen.tsx`
- `apps/mobile/src/screens/InboxScreen.tsx`

**Step 2: Create shared surface wrappers**

Add small primitives for:
- floating cards
- modal sheets
- drag handles
- icon actions
- list rows with consistent title, subtitle, leading, and trailing lanes

**Step 3: Move common tokens into theme**

Normalize:
- elevated shadow values
- container radii
- compact spacing
- sheet header spacing
- muted text colors

**Step 4: Verify visual consistency**

Check that timer, quick add, inbox, and audio player all read as the same product family.

**Step 5: Commit**

Use a commit focused only on the primitive layer.

---

### Task 2: Rebuild the medication timer to web parity

**Files:**
- Modify: `apps/mobile/src/components/PersistentTimerBanner.tsx`
- Modify: `apps/mobile/src/components/LogDoseSheet.tsx`
- Modify: `apps/mobile/src/db/database.ts`
- Create: `apps/mobile/src/hooks/usePersistentTimerState.ts`
- Create: `apps/mobile/src/utils/timerPresentation.ts`
- Reference: `src/components/shell/ActiveTimersBanner.tsx`
- Reference: `src/components/shell/active-timers.css`

**Step 1: Write down the exact web timer behaviors to match**

Match these behaviors from web:
- persistent minimized state
- persistent placement or anchored placement rules
- richer compact pill state
- expanded multi-medication state
- ready-for-next-dose visual treatment
- stop action clarity
- stronger header and affordance hierarchy

**Step 2: Decide the mobile drag model**

Implement one of these, but keep it consistent:
- draggable floating widget constrained to safe area
- anchored bottom widget with user-controlled compact/expanded snap states

Use the second model if full drag creates too much Expo complexity.

**Step 3: Persist view state**

Store:
- collapsed vs expanded
- last chosen presentation mode
- any user-selected anchor position if drag is implemented

**Step 4: Improve layout hierarchy**

Make the timer show:
- stronger leading icon state
- clearer primary medication title
- clearer elapsed / ready status
- grouped multi-medication rows
- more intentional compact mode copy

**Step 5: Improve animation and haptics**

Use reanimated or `Animated` for:
- compact-to-expanded transition
- minimize transition
- entry / exit

Use distinct haptics for:
- expand
- stop
- ready-state interactions if applicable

**Step 6: Improve the linked dose log sheet**

Refine `LogDoseSheet` so it supports the timer system better:
- clearer resume-timer affordance
- cleaner exact/relative input mode treatment
- better hierarchy for recent logs

**Step 7: Verify behavior**

Test:
- one active medication
- multiple active medications
- resumed timer from previous dose
- ready-for-next-dose state
- no timers

**Step 8: Commit**

Keep this as its own commit because it is the highest-risk product surface.

---

### Task 3: Bring quick capture and inbox up to web standard

**Files:**
- Modify: `apps/mobile/src/screens/QuickAddScreen.tsx`
- Modify: `apps/mobile/src/screens/InboxScreen.tsx`
- Modify: `apps/mobile/src/components/SwipeableItem.tsx`
- Modify: `apps/mobile/src/components/ContextMenu.tsx`
- Create: `apps/mobile/src/components/inbox/InboxEmptyState.tsx`
- Create: `apps/mobile/src/components/inbox/CaptureComposer.tsx`
- Reference: `src/components/shell/QuickAddSheet.tsx`
- Reference: `src/components/home/InboxSheet.tsx`
- Reference: `src/components/actions/ActionList.tsx`

**Step 1: Rebuild quick capture as a real sheet surface**

Improve:
- title field rhythm
- notes field treatment
- metadata pills
- toolbar layout
- transition and keyboard behavior

**Step 2: Add missing capture intelligence**

Port lightweight behavior from web where appropriate:
- automatic type inference from typed text
- stronger save-state feedback
- better reset behavior on close

**Step 3: Make inbox feel like an intentional destination**

Improve:
- empty state
- item density
- capture row polish
- section spacing
- action affordance clarity

**Step 4: Refine gesture and long-press behavior**

Tune:
- swipe thresholds
- action lane reveal feel
- context menu open/close motion

**Step 5: Verify usage flow**

Test:
- add from FAB
- activate inbox item
- archive inbox item
- delete inbox item
- long-press context menu
- keyboard open / close

**Step 6: Commit**

Commit the capture and inbox overhaul separately.

---

### Task 4: Rebuild shell-level polish and navigation behavior

**Files:**
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/src/components/AppHeader.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/MenuScreen.tsx`
- Create: `apps/mobile/src/components/shell/PullToRefresh.tsx`
- Create: `apps/mobile/src/components/shell/AppInfoSheet.tsx`
- Reference: `src/components/shell/AppHeader.tsx`
- Reference: `src/components/shell/BottomTabNav.tsx`
- Reference: `src/components/shell/PullToRefresh.tsx`
- Reference: `src/components/shell/AppInfoModal.tsx`
- Reference: `src/components/ui/VersionHistoryModal.tsx`

**Step 1: Improve the app header**

Bring back stronger shell cues from web:
- profile affordance clarity
- sync-state behavior
- tappable app-title action if we want app info or version history

**Step 2: Improve bottom navigation motion**

Refine:
- active tab treatment
- press feedback
- FAB transition and depth
- menu open behavior

**Step 3: Add shell pull-to-refresh**

Implement a mobile-native pull-to-refresh wrapper where it meaningfully improves core screens, starting with Home and possibly Calendar.

**Step 4: Add app info / version surface**

Provide a mobile equivalent for the web app metadata surface rather than leaving the title inert.

**Step 5: Verify shell cohesion**

Check the app as a whole:
- header
- tab bar
- fab
- home
- menu
- global overlays

**Step 6: Commit**

Keep shell polish isolated from feature overhauls.

---

### Task 5: Bring the audio player and dock behavior into the same system

**Files:**
- Modify: `apps/mobile/src/components/audio/AudioPlayerHost.tsx`
- Create: `apps/mobile/src/components/audio/AudioDock.tsx`
- Create: `apps/mobile/src/components/audio/LyricLineEditor.tsx`
- Reference: `src/components/shell/QuickAddSheet.tsx`
- Reference images already provided in thread

**Step 1: Split the current player into subcomponents**

Extract:
- expanded player shell
- minimized dock
- artwork block
- lyric line editor

**Step 2: Align the visual language**

Make the player feel like the same system as the timer and sheets:
- matching glass / surface treatment
- matching spacing and controls
- stronger minimize affordance

**Step 3: Preserve current functionality**

Do not regress:
- local MP3 selection
- ID3 title / artist / artwork parsing
- manual lyric line creation
- timestamp stamping

**Step 4: Improve minimize / restore motion**

The dock transition should feel intentional, not just present.

**Step 5: Commit**

Commit audio separately because it is visually large and easy to review independently.

---

### Task 6: Add a mobile parity review pass across all major surfaces

**Files:**
- Modify: `apps/mobile/App.tsx`
- Modify: `apps/mobile/src/screens/HomeScreen.tsx`
- Modify: `apps/mobile/src/screens/CalendarScreen.tsx`
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx`
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`
- Modify: any new primitives created in Tasks 1-5

**Step 1: Tighten spacing and hierarchy**

Run a pass for:
- title sizes
- subtitle contrast
- section gaps
- touch target consistency

**Step 2: Tighten motion**

Remove awkward or mismatched transitions and ensure reduced-motion behavior remains respected where relevant.

**Step 3: Tighten copy**

Align labels and microcopy so they feel like one product voice.

**Step 4: Regression test the main loop**

Test this full loop:
1. open app
2. quick capture an item
3. process inbox
4. open medications
5. log a dose and start timer
6. minimize and reopen timer
7. open audio player and dock it

**Step 5: Commit**

Use a final polish commit only after the main overhaul tasks are stable.

---

## Acceptance Checklist

- `PersistentTimerBanner` no longer feels like a temporary banner.
- `QuickAddScreen` and `InboxScreen` feel clearly derived from the old web app rather than generic RN defaults.
- Header and navigation have meaningful press states and system-level polish.
- Audio player design now belongs to the same design system as the rest of the app.
- Shared mobile primitives reduce duplicated styling and interaction code.

## Recommended Execution Order

1. Task 1
2. Task 2
3. Task 3
4. Task 4
5. Task 5
6. Task 6

## Notes For Implementation

- Prefer preserving current mobile data and navigation logic unless a parity feature requires changing it.
- Do not port web-only desktop assumptions directly.
- Reuse existing haptics and safe-area handling everywhere.
- If a parity behavior from web fights native mobile conventions, keep the mobile-native behavior but preserve the old information hierarchy and product feel.
