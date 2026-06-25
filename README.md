# RKA OS

A highly opinionated, local-first Personal Operating System Progressive Web App (PWA) designed to reduce the friction between knowing what should be done and actually doing it.

> **Note:** This project was previously under the folder name `personal-os`. It has been renamed to `rka-os` to align with the package name, GitHub repository, and official branding. See [NAMING_HISTORY.md](./NAMING_HISTORY.md) for details.

## Product Vision

The app is built around the unified philosophy: **Everything is an Action.**
Tasks, Habits, Medications, and Workouts are not separate siloed modules. They are unified `Items` built upon a single local-first architecture (Dexie.js). 

It embraces the elegance and speed of Things 3, combined with the underlying flexibility of a modular database.

## Architecture & Data Model

The application leverages **Dexie (IndexedDB)** for extremely fast, offline-first execution.
The architecture uses a unified Item lifecycle:
- **Project/Area**: Top-level containers (Medicine, Fitness, Study, Admin, Personal).
- **Item**: The parent master record (`task`, `habit`, `medication`, `workout`). Contains polymorphic `metadata`.
- **ItemInstance**: The materialized occurrence of an Item scheduled for a specific date.
- **Tags**: M:N relational tags parsed via natural language (`#tag`).

## Setup Instructions

1. **Install Dependencies:**
   ```bash
   npm install
   ```

2. **Run Development Server:**
   ```bash
   npm run dev
   ```

3. **Build for Production:**
   ```bash
   npm run build
   ```

## Current Features
- **Home Command Centre**: Unified dashboard of all active areas of responsibility.
- **Execution View (Today)**: Distraction-free daily hit-list.
- **Natural Language Quick Add**: Add tasks, schedule dates, and apply `#tags` instantly.
- **Habit Streaks**: Automatic recurrence and streak tracking via `rrule`.
- **Medication Inventory**: Track stock, deduct doses automatically, and alert on low refills.
- **Active Workout Mode**: Full-screen distraction-free workout logging.
- **PWA Ready**: Installs to your iOS/Android home screen seamlessly, handling safe-area insets correctly.
