# Native Stopwatch and Functional Header Controls Design

**Date:** 2026-07-14  
**Status:** Approved for implementation planning  
**Platform:** React Native + Expo iOS (`apps/mobile/`)

## Objective

Replace the current draggable medication timer widget with a reliable, native-iOS-style stopwatch experience. The in-app presentation and the Live Activity must be two views of the same persisted timer. Add per-medication automatic stopping, a tactile light/dark slider, and an honest functional backup control in the app header.

The avatar and centered `RKA OS` branding remain unchanged.

## Product Decisions

- Medication timers are elapsed-time stopwatches, not countdown timers.
- Each medication configures its own automatic stop duration.
- Automatic stopping ends the stopwatch and Live Activity, notifies the user, preserves the completed duration, and removes the timer from active UI.
- The app may run multiple stopwatches, but iOS presents only one primary Live Activity.
- The primary timer is the most recently started active timer. Paused timers rank after running timers.
- The in-app timer is an anchored capsule that expands into a native-style sheet. It is not draggable.
- The theme control is a two-state Light/Dark slider with deliberate haptics.
- Header sync represents snapshot backup state and provides Backup Now. It does not claim to be bidirectional real-time sync.

## Current Problems

### Timer

`PersistentTimerBanner` currently combines timer domain operations, Live Activity coordination, floating-window positioning, dragging, snapping, pinning, four presentation states, settings, and rendering. Important actions are split between tap cycling, long-press menus, and expanded controls. This makes stopping difficult to discover and creates presentation state that is unrelated to the underlying medication stopwatch.

Live Activity handles are tracked only in memory. After a full app restart, the app may no longer know that an activity exists. The timer itself remains persisted in SQLite, so the two presentations can drift.

### Header

- The theme control is an icon-only button with no visible two-state affordance.
- `Synced` is hard-coded and does not reflect authentication, connectivity, work in progress, success, or failure.
- Background backup and Profile backup state are not owned by one shared status source.

## Architecture

### MedicationTimerController

Introduce a single controller/service as the only mutation boundary for medication stopwatch state.

Public operations:

- `start(logId, medicationId)`
- `pause(logId)`
- `resume(logId)`
- `reset(logId)`
- `stop(logId, reason)`
- `reconcile(now)`
- `setPrimary(logId)` when selection changes

Valid stop reasons are `manual` and `automatic`.

All call sites—including dose logging, the in-app capsule/sheet, notification handling, and Live Activity interactions—must use this controller. Existing direct timer mutation helpers become controller internals or thin compatibility wrappers during migration.

Each successful operation performs one logical transition:

1. Update the SQLite activity log.
2. Update or end the primary Live Activity.
3. Schedule, cancel, or replace the cutoff notification.
4. Publish a timer-state revision so mounted UI refreshes immediately.

Operations must be idempotent. Repeating stop, pause, or an already-processed Live Activity command must not corrupt accumulated time or create duplicate history.

### Persisted Data

Add to medication metadata:

```ts
autoStopAfterHours?: number
```

Existing medications resolve an unset value to 24 hours.

Add to each timer log's details:

```ts
autoStopAfterMs: number
autoStopNotificationId?: string
completedElapsedMs?: number
timerStoppedReason?: 'manual' | 'automatic'
```

The resolved duration is copied into the log when the stopwatch starts. Editing the medication later affects new stopwatches only.

The cutoff is derived from active elapsed time, not wall-clock time. Paused time does not consume the auto-stop allowance. On resume, the controller schedules a new cutoff for the remaining active duration.

### Reconciliation

Run reconciliation:

- after database initialization;
- when the app becomes active;
- after timer mutations;
- when a timer notification/deep link opens the app.

For every persisted active timer, calculate active elapsed time from `accumulatedMs` and `startedAt`. Any timer at or beyond its resolved limit is stopped automatically with an exact capped `completedElapsedMs`.

iOS may delay app execution while terminated. A local notification is scheduled for the cutoff, but SQLite reconciliation occurs the next time the app receives execution. UI and history must still record the intended cutoff duration rather than the later foreground time.

## Live Activity

### One Primary Activity

Only the primary timer owns a Live Activity. Starting a newer timer ends the old primary activity presentation and starts/updates the new primary activity without stopping either underlying stopwatch. The in-app sheet continues to list all active and paused timers.

The Live Activity state contains stable identifiers and display data:

```ts
{
  logId: string
  medicationId: string
  medicationName: string
  dose?: string
  displayStartedAt: number
  pausedAt?: number
  autoStopAt?: number
  status: 'running' | 'paused' | 'ended'
}
```

The controller reconnects to existing `MedicationTimerActivity.getInstances()` results on launch where supported, instead of relying solely on an in-memory map.

### Interactions

Expanded Live Activity presents Pause/Resume and Stop targets. These targets dispatch stable commands containing `logId` and a unique command identifier. The controller processes each command once and updates both persisted state and Live Activity state.

Implementation begins with a feasibility spike against the installed `expo-widgets` interaction API. Acceptance requires that a target can safely reach the shared controller path without maintaining a second timer state. If Expo cannot mutate shared persisted state while the app is suspended, the target deep-links directly to the timer sheet with the requested action staged for explicit confirmation. It must never fake a paused/stopped Live Activity while SQLite still says running.

### Automatic End

At the configured limit:

- the local notification says, for example, “Dexamfetamine stopwatch ended after 5 hours”;
- the controller stores the capped completed duration and automatic reason;
- the Live Activity changes briefly to an ended state and is dismissed;
- the in-app capsule selects the next active timer or disappears.

When iOS does not grant execution at the exact cutoff, the notification still fires at the scheduled time and reconciliation ends the activity at the earliest subsequent execution opportunity.

## In-App Timer Experience

### Anchored Capsule

Replace the floating widget with a stable capsule beneath the app header, above screen content, and available across primary routes.

The capsule shows:

- medication icon and primary medication name;
- monospaced elapsed time;
- Pause or Resume button;
- `+N` when other stopwatches exist.

Tapping the capsule opens the timer sheet. The capsule cannot be dragged, pinned, cycled, minimized, or hidden. It reserves layout space rather than obscuring content.

### Timer Sheet

Use the existing `BottomSheet` primitive unless the native SwiftUI sheet already used by the project provides materially better timer behavior without fragmenting styling.

Primary timer section:

- medication and dose;
- large monospaced `HH:MM:SS` elapsed time;
- running/paused state;
- human-readable automatic stop time and remaining allowance;
- large Pause/Resume and Stop controls.

Stop is immediate because it preserves history and is reversible only by starting/resuming from the dose log. It uses a success haptic and removes the timer from active UI. Reset is secondary and lives in an overflow menu because it discards accumulated elapsed time.

Additional timers appear as rows with elapsed time, state, and direct Pause/Resume and Stop buttons. Selecting a row makes it primary and transfers the Live Activity presentation.

Swiping down dismisses the sheet only. It never stops or hides a timer.

## Medication Configuration

Add a Stopwatch section to medication create/edit UI:

```text
Auto-stop after    5 hours ›
```

Preset choices are 4, 5, 8, 12, 18, and 24 hours, plus Custom. Custom values must be positive and are stored as hours. The setting explains that it limits stopwatch relevance and does not represent medical advice or medication clearance guidance.

## Theme Slider

Replace the icon-only theme button with a compact River Stone two-position control.

- Left side: sun / Light.
- Right side: moon / Dark.
- Tap either side or drag the thumb.
- Theme changes after crossing the midpoint.
- `Haptics.selectionAsync()` fires once per threshold crossing.
- A soft impact fires when release settles on a different mode.
- No repeated haptic fires while remaining on the same side.
- Warm selected glow in Light; cool indigo selected glow in Dark.
- Minimum 44pt touch target, even if the visible pill is smaller.
- Accessibility role is `switch`; value and labels announce the selected appearance.
- Reduced Motion removes spring travel while retaining immediate state and haptic feedback.

System-following appearance remains a future Settings option and is not exposed in this two-state header control.

## Functional Backup Control

Create one app-level backup status owner used by Header and Profile.

States:

- `signedOut`
- `idle` with last successful backup timestamp
- `syncing`
- `offline`
- `error` with recoverable message

Header behavior:

- `Synced`: tap performs Backup Now.
- `Syncing…`: disabled until completion.
- `Offline`: tap retries after checking connectivity.
- `Retry`: tap retries the failed backup.
- `Sign in`: navigates to Profile's backup section.

The green check is displayed only after a successful backup for the current authenticated user. A locally changed database does not claim to be synced until the next successful snapshot. Timer actions remain local-first and never wait for backup.

Background backup attempts and Profile actions update the same shared state. The control must not claim bidirectional or real-time sync; the existing snapshot retention and restore model remains intact.

## Error Handling

- Timer database mutation failure leaves the previous UI state visible and reports a recoverable error.
- Live Activity start/update/end failure does not roll back the persisted stopwatch.
- Notification scheduling failure does not prevent the timer from starting; reconciliation still enforces the cutoff.
- Backup errors produce `Retry` and retain the last successful timestamp.
- Duplicate widget commands are ignored using their unique command identifiers.
- Invalid or missing auto-stop values resolve to the 24-hour default.

## Migration

- Existing active and paused timers receive a resolved 24-hour duration during first reconciliation.
- Existing timer presentation preferences for drag position, pinning, and hidden state are ignored after the new capsule ships.
- Existing elapsed/paused calculations remain compatible.
- Existing snapshot backups remain readable because metadata additions are optional.

## Verification

### Automated

- elapsed-time calculation across start, pause, resume, and reset;
- automatic cutoff calculation excluding paused time;
- manual and automatic completion records;
- idempotent duplicate actions;
- migration of old timer logs;
- primary selection with multiple timers;
- sync state transitions;
- theme slider threshold and haptic event decisions;
- TypeScript and build checks.

### Physical iPhone

- start from dose flow and from historical dose;
- foreground, background, force-quit, and relaunch before and after cutoff;
- notification timing and copy;
- Lock Screen and Dynamic Island compact/expanded/minimal layouts;
- Pause/Resume and Stop interaction path from Live Activity;
- multiple timers with one primary activity;
- capsule and sheet behavior on all main tabs;
- Light/Dark slider drag, tap, haptics, VoiceOver, and Reduce Motion;
- backup states for signed out, success, repeated tap, offline, and server failure.

## Out of Scope

- medical clearance or pharmacokinetic calculations;
- countdown timers;
- laps;
- real-time bidirectional data sync;
- Android foreground-service timer redesign;
- app icon, avatar, or centered header branding changes;
- a custom Swift ActivityKit module unless the Expo interaction feasibility spike fails and the user separately approves that expansion.

## Acceptance Criteria

- App and Live Activity always derive display from the same persisted stopwatch record.
- A stopwatch can be stopped in one obvious tap from the expanded app sheet.
- Per-medication automatic stop works and preserves a completed duration.
- Only one primary Live Activity is visible while all timers remain manageable in-app.
- The old draggable/pinned/hidden widget behavior is removed.
- Theme control behaves as a tactile two-position slider.
- Header backup status is truthful and Backup Now is functional.
- The feature passes automated checks and the documented physical-device test matrix.
