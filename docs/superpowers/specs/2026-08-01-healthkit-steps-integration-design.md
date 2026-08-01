# HealthKit Steps Integration — Design

**Date:** 2026-08-01
**Status:** Approved for implementation

## Context

`app.json`'s iOS `infoPlist` already declares `NSHealthShareUsageDescription`/`NSHealthUpdateUsageDescription` (mentioning steps, workouts, sleep), and `apps/mobile/CLAUDE.md`'s "Dev Build Requirements" already lists HealthKit as a known dependency needing a dev build (`react-native-health`). Despite this, no HealthKit code, package, or native entitlement exists anywhere in the project today — confirmed via `find ios -iname "*.entitlements"` (no HealthKit key in `ios/RKAOS/RKAOS.entitlements`) and a full `src/` grep for `HealthKit`/`react-native-health` (zero matches). This is a from-scratch native integration.

**Explicitly deferred:** how step data actually gets used in the app (e.g. auto-feeding the "12k steps" Home habit, or the Potential system's Vitality stat) is not decided yet and out of scope here. This spec is infrastructure only: prove HealthKit access works end-to-end for step counts, with no UI feature built on top of it yet.

## Scope

- **Metric:** step count only (not workouts or sleep, despite the Info.plist strings already covering those — deferred to a future pass using the same pattern once this is proven).
- **Persistence:** none. Step data is queried live from HealthKit on demand; nothing is written to the app's SQLite database.
- **Verification surface:** a `__DEV__`-only section on `ProfileScreen.tsx`, following the same pattern as its existing `Ronin3DBench` dev-only block — shows permission status and today's step count. Not a real feature surface; exists purely to prove the pipe works.

## Architecture

- Add `@kingstinct/react-native-healthkit` (verified via its GitHub source: actively maintained, TypeScript-first, built on `react-native-nitro-modules` — already an installed dependency here (`^0.36.5`) for the in-progress Rive/Ronin work — which gives it solid New Architecture support, unlike the older `react-native-health` package, which has open, unresolved compatibility issues with RN's bridgeless New Architecture. This app runs RN 0.86 / Expo ~57, where New Architecture is on by default) plus `react-native-nitro-modules` (already present, so effectively a no-op re-add) as dependencies. Register its official Expo config plugin in `app.json`'s `plugins` array — `["@kingstinct/react-native-healthkit", { "NSHealthShareUsageDescription": ..., "NSHealthUpdateUsageDescription": ... }]` — which handles both the Info.plist strings (overriding with this project's existing copy) and the HealthKit entitlement automatically at prebuild time. No custom config plugin needs to be written.
- New `src/services/health.ts`:
  - `requestHealthPermissions(): Promise<boolean>` — checks `isHealthDataAvailable()`, then calls the library's `requestAuthorization({ toRead: ['HKQuantityTypeIdentifierStepCount'] })`, resolving `true`/`false` based on whether the user granted access.
  - `getTodayStepCount(): Promise<number>` — calls `queryStatisticsForQuantity('HKQuantityTypeIdentifierStepCount', ['cumulativeSum'], { filter: { date: { startDate: <midnight today>, endDate: <now> } } })` and reads `result.sumQuantity?.quantity ?? 0` — this is HealthKit's proper cumulative-sum statistics query (not manually summing raw samples, which risks double-counting across multiple data sources like a paired Apple Watch).
  - Both guarded for non-iOS platforms (`Platform.OS !== 'ios'` short-circuits to `false`/`0`) since HealthKit is iOS-only — matches the existing guarded-import pattern already used for `expo-background-task` in `src/services/backgroundSync.ts`.
- `ProfileScreen.tsx`: a new `__DEV__`-only block (sibling to the existing `Ronin3DBench` section) with a button to call `requestHealthPermissions()` and, once granted, a display of `getTodayStepCount()`'s result with a manual refresh button.

## Native Build Requirement

This requires a new native build after implementation — HealthKit is native code (framework linking + entitlement), not something Metro/JS can hot-reload. Same EAS cloud build flow already used earlier (`eas build --profile development --platform ios`, per `eas.json`'s existing `development` profile).

## Out of Scope

- Workouts, sleep, or any HealthKit metric beyond step count.
- Any persistence/sync of step data into the app's database.
- Any real feature UI (Home habit auto-completion, Potential Vitality auto-feed, etc.) — this spec only proves the data access works; deciding how it's used is a separate future project.
- Android (Health Connect) — this app is iOS-first per `apps/mobile/CLAUDE.md`, and `react-native-health` is iOS-only regardless.
