# Web Companion — Core GTD — Design

## Context

RKA OS currently ships only as a native iOS app (`apps/mobile/`, React Native + Expo). This is the first sub-project of a desktop/Mac/web companion effort: get the core task-management workflow (Inbox, Tasks, Areas/Projects, Calendar/timeline) running in a browser, reusing the existing React Native codebase via React Native Web, before extending to a Mac app (Tauri-wrapped) or additional feature areas (medications, voice capture, etc.).

This depends on the mobile app's real-time Firestore sync being complete and correct, which was verified working across all six synced tables (`items`, `itemInstances`, `itemRelations`, `itemOrder`, `appSettings`, `activityLogs`) earlier in this session — the web client reads/writes that same Firestore data directly.

## Goals

- Core GTD screens (Inbox, Tasks, Areas/Projects, Calendar/timeline) run in a browser via `expo start --web`, built from the same `apps/mobile/` source as the iOS app.
- Data layer forks per-platform: mobile keeps SQLite + the existing Firestore dual-write sync; web reads/writes Firestore directly, with zero local database.
- Screens, hooks, navigation, and theme code are reused unchanged between platforms — only the data-access layer differs.

## Non-goals

- A Mac desktop app (Tauri wrapper) — later sub-project, built once the web client works.
- Medications, voice capture, workouts, HealthKit, native calendar integration, Live Activities/timers, or any other native-only feature area.
- Offline support beyond whatever Firestore's own browser-side persistence provides by default (no custom offline-queueing work in this sub-project).
- Automated UI tests — matches the existing project convention (none exist for mobile either).

## Architecture

`apps/mobile/`'s existing screens, hooks, navigation, and theme are reused as-is for the browser build via `expo start --web` (Expo's built-in React Native Web support) — no new project or duplicated UI code.

The data layer forks per-platform using Metro's platform-specific file extension convention: `db/database.ts` (existing, SQLite-backed) stays unchanged for mobile; a new `db/database.web.ts` implements the same exported function names and signatures, backed by Firestore instead of SQLite. Metro automatically resolves to the `.web.ts` file when bundling for web, so every screen/hook that imports from `../db/database` needs no changes and has no awareness of which platform it's running on.

`db/database.web.ts` uses the same technique explored earlier in this session for the (since-superseded) Firestore-native rewrite: one `onSnapshot` listener per collection mirrors Firestore into an in-memory array, and each function is a mechanical port of the corresponding SQL predicate to an equivalent JS `.filter()`/`.sort()` over that array — not a redesign into native Firestore queries, which would require composite indexes and risk behavior drift from the SQLite original. `firestoreSync.ts` (mobile's dual-write shim) is not used on web at all — there's no local store to keep in sync with.

## Scope

The "Core GTD" slice maps to specific functions in the existing `db/database.ts` (~1400 lines, ~80 functions total):

- **Item CRUD**: `getInboxItems`, `getTodayItems`, `getUpcomingItems`, `getItemsByStatus`, `getItemsByType`, `getCompletedItems`, `getItemWithMetadata`, `createItem`, `updateItem`, `updateItemMetadata`, `updateItemTitle`, `updateItemStatus`, `deleteItem`.
- **Relations & manual order**: `setRelation`, `getRelation`, `getBlockingTask`, `setManualOrder`, `applyManualOrder`, `getRelatedItems`, `countRelated`, `getProjectItemCount`, `getAreaProjectCount`, `getProjectsForArea`.
- **Today-planning**: `planForToday`, `unplanToday`, `getPlannedTodayItems`, `getRepeatingItemsForToday`, `isPlannedForToday` (pure, no port needed).
- **Calendar/timeline**: `getItemsForDate`, `getInstancesForDate`, `getTimelineEntriesForDate`, `createTimedItem`, `updateTimelineItemTime`, `updateTimelineItemSchedule`.
- **GTD triage**: `processInboxItem`, `applyTaskTriage`.
- **Activity logs (write side only, for the `created`/`status-changed` entries these functions produce)**: `logActivity`, `getTodayLogs`.

This is roughly 50+ functions — too large for a single implementation plan (same lesson learned from the mobile sync-coverage work earlier this session). Expect this to become 2-3 implementation plans (e.g. item CRUD + relations first, calendar/timeline + triage second), decided at planning time rather than fixed here.

**Explicitly excluded** from this sub-project (and therefore from `database.web.ts` for now): medication tracking, GTD triage's medication/object destinations' downstream screens, workout tracking, and anything else outside the four in-scope screens.

## Native Dependency Handling

Screens in scope mostly use cross-platform primitives (React Native core components, Tamagui, `react-native-svg`, Reanimated 4 — all have React Native Web support). Where a native-only import shows up transitively (e.g. `expo-haptics` calls in shared components), the fix is either relying on it already being a safe no-op on web, or wrapping the call to skip on web. These are handled file-by-file as they're encountered during implementation, not pre-audited exhaustively in this design — the in-scope screens are not expected to have deep native dependencies, but this isn't verified line-by-line ahead of time.

## Auth

Reuses Firebase Auth as-is. The Firebase JS SDK already used by mobile (`apps/mobile/src/lib/firebase.ts`) works identically in a browser — same sign-in/sign-up flow, rendered via React Native Web instead of native components.

## Testing

Manual verification in a browser per screen/function as it's ported, matching the existing project convention (no automated UI or data-layer tests exist anywhere in this codebase, mobile included). `database.web.ts` functions are verified by comparing behavior against the SQLite original function-by-function, plus manual checks against live Firestore data (same technique used to verify the mobile sync-coverage work this session — checking Firestore state directly via the Firebase CLI's stored OAuth token, since there's no formal test harness for Firestore-backed code here).

## Self-review notes

- Placeholder scan: none found.
- Scope check: appropriately bounded to one sub-project (core GTD screens + their data-layer functions); explicitly defers Tauri/Mac wrapping and out-of-scope feature areas to later sub-projects.
- Ambiguity check: the expected multi-plan breakdown for `database.web.ts` is stated explicitly as "decided at planning time," not left as an open question that could be misread as "one plan covers all of it."
