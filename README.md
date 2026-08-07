# RKA OS

A highly opinionated, local-first Personal Operating System — a native iOS app (React Native + Expo) designed to reduce the friction between knowing what should be done and actually doing it. A companion desktop web app shares the same codebase and data — see below.

> **Note:** This project was previously under the folder name `personal-os`. It has been renamed to `rka-os` to align with the package name, GitHub repository, and official branding. See [NAMING_HISTORY.md](./NAMING_HISTORY.md) for details.
>
> This repo also previously shipped a *different, now-retired* companion Progressive Web App (Vite + React + Dexie.js at repo root, last touched 2026-06-23). That PWA has been fully retired now that the mobile app covers everything it did — all app code lives at `apps/mobile/`. **Do not confuse it with the desktop web app below, which is current and active.**

## Desktop Web App

`apps/mobile/` also ships a genuinely separate, actively-developed desktop/web target — not a revival of the retired PWA above, and not just a browser preview of the mobile screens. It's built with Expo's web support (`.web.tsx` platform-specific files alongside the native screens, e.g. `WorkoutsScreen.web.tsx` next to `WorkoutsScreen.tsx`), sharing the exact same SQLite-backed data layer (`db/database.ts`, `hooks/useDb.ts`) as iOS, but with its own screens (`apps/mobile/src/webApp/`), own theme (`theme/webTheme.ts`), own icon set (`lucide-react-native`), and a desktop-appropriate navigation model — a `Sidebar` of top-level views with a right-side sliding `DetailPanel`, instead of mobile's `react-navigation` screen stack. Run it with `npm run web` from `apps/mobile/`; it deploys to Firebase Hosting (`firebase.json`'s `hosting.public: apps/mobile/dist`, built via `npm run web:build`). See [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md#desktop-web-app) for current screen parity and conventions.

## Product Vision

The app is built around the unified philosophy: **Everything is an Action.**
Tasks, Habits, Medications, and Workouts are not separate siloed modules. They are unified `Items` built upon a single local-first architecture (SQLite via `expo-sqlite`).

It embraces the elegance and speed of Things 3, combined with the underlying flexibility of a modular database.

## Architecture & Data Model

The app leverages **SQLite (`expo-sqlite`)** for extremely fast, offline-first execution. See [`apps/mobile/SCHEMA.md`](apps/mobile/SCHEMA.md) for the full data model. The architecture uses a unified Item lifecycle:
- **Project/Area**: Top-level containers (Medicine, Fitness, Study, Admin, Personal).
- **Item**: The parent master record (`task`, `habit`, `medication`, `workout`). Contains polymorphic `metadata`.
- **ItemInstance**: The materialized occurrence of an Item scheduled for a specific date.
- **Tags**: M:N relational tags parsed via natural language (`#tag`).

## Development

This project is managed by **[RKA Launcher](../rka-launcher/)** — a native macOS app that handles starting/stopping dev servers. Register this repo in the launcher and use it instead of running commands manually.

Manual commands (if not using the launcher):

```bash
cd apps/mobile
npx expo start --dev-client    # start the iOS development client server (port 8081)
```

See [`apps/mobile/CLAUDE.md`](apps/mobile/CLAUDE.md) for the full setup/run guide.

## Current Features
- **Home Command Centre**: Unified dashboard of all active areas of responsibility.
- **Execution View (Today)**: Distraction-free daily hit-list.
- **Natural Language Quick Add**: Add tasks, schedule dates, and apply `#tags` instantly.
- **Habit Streaks**: Automatic recurrence and streak tracking via `rrule`.
- **Medication Inventory**: Track stock, deduct doses automatically, and alert on low refills.
- **Active Workout Mode**: Full-screen distraction-free workout logging.
