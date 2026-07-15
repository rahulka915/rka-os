# RKA OS

A highly opinionated, local-first Personal Operating System — a native iOS app (React Native + Expo) designed to reduce the friction between knowing what should be done and actually doing it.

> **Note:** This project was previously under the folder name `personal-os`. It has been renamed to `rka-os` to align with the package name, GitHub repository, and official branding. See [NAMING_HISTORY.md](./NAMING_HISTORY.md) for details.
>
> This repo also previously shipped a companion Progressive Web App (Vite + React + Dexie.js at repo root). That PWA has been fully retired now that the mobile app covers everything it did — all app code lives at `apps/mobile/`.

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
