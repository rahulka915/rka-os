# Native Stopwatch and Functional Header Controls Implementation Plan

> **For Claude:** Use `${SUPERPOWERS_SKILLS_ROOT}/skills/collaboration/executing-plans/SKILL.md` to implement this plan task-by-task.

**Goal:** Build one persisted medication stopwatch system shared by the app and one primary Live Activity, add per-medication automatic stopping, and replace the header's decorative theme/sync elements with functional controls.

**Architecture:** Pure timer math remains isolated from SQLite and React so it can be tested with Node's built-in TypeScript test runner. A medication timer controller owns mutations, notification scheduling, reconciliation, and primary Live Activity coordination. App-level providers expose timer revisions and backup state to an anchored capsule, timer sheet, Profile, and Header.

**Tech Stack:** React Native 0.86, Expo 57, TypeScript 6, expo-sqlite, expo-notifications, expo-widgets/ActivityKit, React Native Gesture Handler/Reanimated, Supabase, Node test runner.

---

### Task 1: Pure Stopwatch Domain and Persisted Fields

**Files:**
- Create: `apps/mobile/src/domain/medicationTimer/timerMath.ts`
- Create: `apps/mobile/src/domain/medicationTimer/timerMath.test.ts`
- Modify: `apps/mobile/src/db/database.ts`
- Modify: `apps/mobile/src/utils/timerPresentation.ts`
- Modify: `apps/mobile/package.json`

**Step 1: Write failing domain tests**

Cover active elapsed time, paused elapsed time, remaining allowance, capped automatic completion, and default 24-hour resolution.

**Step 2: Run tests and verify failure**

Run: `cd apps/mobile && npm test -- --test-name-pattern=timer`

Expected: FAIL because `timerMath.ts` is absent.

**Step 3: Implement pure timer math**

Export constants and functions for resolving hours, calculating elapsed active milliseconds, calculating remaining allowance, and determining automatic expiration. Functions accept explicit `now` values.

**Step 4: Extend persisted types**

Add `autoStopAfterHours` to `MedicationMeta`. Add `autoStopAfterMs`, notification id, completed elapsed, and stopped reason to `MedicationTimerDetails`. Update presentation to use the pure calculations.

**Step 5: Run tests and typecheck**

Run: `cd apps/mobile && npm test && npm run typecheck`

Expected: PASS.

### Task 2: Timer Controller, Notifications, and Reconciliation

**Files:**
- Create: `apps/mobile/src/services/medicationTimerController.ts`
- Create: `apps/mobile/src/services/medicationTimerEvents.ts`
- Modify: `apps/mobile/src/db/database.ts`
- Modify: `apps/mobile/src/hooks/usePersistentTimerState.ts`
- Modify: `apps/mobile/src/hooks/useNotifications.ts`
- Modify: `apps/mobile/App.tsx`

**Step 1: Add tests for transition decisions**

Test remaining cutoff scheduling after pause/resume, capped auto-stop duration, and idempotent stop decisions using pure helpers.

**Step 2: Implement one mutation boundary**

Controller methods load a timer log, apply a transition, persist it, update notification scheduling, coordinate the primary activity, and publish a revision.

**Step 3: Implement reconciliation**

On launch and foreground, automatically stop timers whose active elapsed time reached their resolved duration. Preserve the intended capped duration and `automatic` reason.

**Step 4: Route existing call sites through the controller**

Dose logging, historical-dose timer starts, and timer UI actions must stop calling raw database timer helpers directly.

**Step 5: Verify**

Run unit tests and TypeScript. Confirm older timer logs resolve to 24 hours without a schema migration.

### Task 3: One Primary Live Activity

**Files:**
- Modify: `apps/mobile/src/liveActivities/MedicationTimerActivity.tsx`
- Modify: `apps/mobile/src/services/medicationLiveActivity.ts`
- Modify: `apps/mobile/src/services/medicationTimerController.ts`

**Step 1: Add primary activity state**

Persist the primary log id in app settings and make the most recent running stopwatch primary by default.

**Step 2: Reconnect activity handles**

Use `MedicationTimerActivity.getInstances()` on startup where supported. Do not suppress the in-app timer merely because a Live Activity exists.

**Step 3: Enforce one activity**

Starting/selecting a new primary ends the previous presentation and starts or updates one activity for the selected timer.

**Step 4: Spike interactive targets**

Confirm the installed Expo Widgets button event can reach the controller safely. Implement direct Pause/Resume and Stop if it can. If not, use action-specific deep links into the timer sheet; never mutate only the Live Activity view.

**Step 5: Verify on build/typecheck**

Confirm activity props compile in the widget bundle and app TypeScript.

### Task 4: Anchored Timer Capsule and Native-Style Sheet

**Files:**
- Replace: `apps/mobile/src/components/PersistentTimerBanner.tsx`
- Create: `apps/mobile/src/components/timer/MedicationTimerCapsule.tsx`
- Create: `apps/mobile/src/components/timer/MedicationTimerSheet.tsx`
- Modify: `apps/mobile/App.tsx`

**Step 1: Remove floating presentation behavior**

Delete drag, snap, pin, minimized, expanded, hidden, and long-press presentation logic from the rendered experience.

**Step 2: Build the capsule**

Render one primary name, monospaced elapsed time, Pause/Resume, and `+N`. Place it beneath the header/navigation layer without obscuring screen content.

**Step 3: Build the timer sheet**

Use `BottomSheet`, a large stable timer display, obvious Pause/Resume and Stop controls, an overflow Reset action, and rows for additional timers. Dismissing the sheet does not affect timers.

**Step 4: Add accessibility and haptics**

All controls receive labels/hints and minimum 44pt targets. Pause uses light/medium impact; manual Stop uses success notification haptic.

**Step 5: Verify integration**

Typecheck and manually inspect state transitions using a temporary short auto-stop value.

### Task 5: Per-Medication Auto-Stop Configuration

**Files:**
- Modify: `apps/mobile/src/screens/MedicationsScreen.tsx`
- Modify: `apps/mobile/src/db/database.ts`

**Step 1: Add form state and presets**

Expose 4, 5, 8, 12, 18, and 24 hours in medication create/edit UI. Store a positive custom value when selected.

**Step 2: Add explanatory copy**

State that this only controls stopwatch relevance and is not medical clearance guidance.

**Step 3: Persist and verify**

Confirm create/edit round-trips metadata and active timers retain the duration resolved when they started.

### Task 6: Shared Functional Backup Status

**Files:**
- Create: `apps/mobile/src/contexts/BackupStatusContext.tsx`
- Modify: `apps/mobile/src/hooks/useBackup.ts`
- Modify: `apps/mobile/src/services/backupSync.ts`
- Modify: `apps/mobile/src/components/AppHeader.tsx`
- Modify: `apps/mobile/src/screens/ProfileScreen.tsx`
- Modify: `apps/mobile/App.tsx`

**Step 1: Centralize state**

Provider owns session, last successful backup, busy state, error, and manual Backup Now. Header and Profile consume the same instance.

**Step 2: Make dirty/success state honest**

Record last successful snapshot and show green `Synced` only after success for the current authenticated user. Background pushes update the provider when the app is alive.

**Step 3: Implement header actions**

Render Sign in, Syncing, Synced, Offline/Retry states. Synced/Retry triggers Backup Now; Sign in navigates to Profile.

**Step 4: Verify failure and repeated taps**

Prevent duplicate backup requests and expose retry after failure.

### Task 7: Tactile Theme Slider

**Files:**
- Create: `apps/mobile/src/components/header/ThemeSlider.tsx`
- Modify: `apps/mobile/src/components/AppHeader.tsx`
- Modify: `apps/mobile/App.tsx`

**Step 1: Implement tap and drag state**

Use a 44pt touch target, two visual positions, threshold crossing, and spring/reduced-motion behavior.

**Step 2: Implement haptic decisions**

Selection haptic fires once per threshold crossing; a soft impact fires on release only when the final theme differs from the initial theme.

**Step 3: Add accessibility**

Expose switch role, checked value, and Light/Dark labels.

**Step 4: Verify**

Typecheck and test tap, drag, interrupted gesture, VoiceOver, and Reduce Motion on device.

### Task 8: Final Integration and Verification

**Files:**
- Modify: `apps/mobile/DESIGN_CHECKLIST.md`
- Modify: `apps/mobile/FLOWS.md`

**Step 1: Run automated checks**

Run:

```bash
cd apps/mobile
npm test
npm run typecheck
npx expo export --platform ios --output-dir /private/tmp/rka-os-ios-export
```

Expected: all tests pass, no TypeScript errors, iOS bundle exports successfully.

**Step 2: Review diff and asset/build hygiene**

Run `git diff --check`, inspect only scoped files, and confirm no generated build output is inside the workspace.

**Step 3: Document physical-device test matrix**

Provide exact checks for timer start/pause/resume/reset/manual stop/auto-stop, app restart, notifications, Dynamic Island, multiple timers, theme haptics, VoiceOver, Reduce Motion, and every backup state.

**Step 4: Commit scoped implementation changes**

Create new conventional commits without amending existing history and preserve unrelated user changes.
