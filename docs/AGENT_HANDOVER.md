# RKA OS - Agent Handover & Project Context

*This document is intended for AI coding assistants to quickly understand the project architecture, recent changes, and ongoing roadmaps when starting a new session.*

## 🏗️ Project Architecture
- **Goal:** "RKA OS" is a premium, local-first PWA intended as a "second brain". It currently includes a rich Workout mini-app and task management.
- **Tech Stack:** React, Vite, TypeScript. Vanilla CSS (no Tailwind).
- **Data Layer:** 
  - **Local-First:** Uses `Dexie.js` (v5) as the primary authoritative database. The schema relies heavily on a generic graph-node model (`items`, `itemInstances`, `entityLinks`).
  - **Remote Sync:** `Supabase` is used for backup and cross-device sync.
  - **Sync Bridge:** Located in `src/data/sync.ts`. It intercepts Dexie operations and queues them for Supabase upload, while applying realtime Postgres events to IndexedDB.

## 📝 Ongoing Roadmaps
- **UI System Refactor:** Located at `docs/plans/2026-06-19-ui-system-refactor.md`. Focuses on standardizing components (rows, pills, headers) and removing page-level drift.

---

## 🕒 Change Log & Handover

### 📅 Session: 2026-06-22
**Agent:** Antigravity 
**Time Spent:** ~1 hour
**Focus:** Backend Sync Resilience & Offline Queue

#### What was done:
- **Offline Queue Added:** Created the `syncQueue` table in `src/db/db.ts` (bumped to v2). Hooked Dexie proxy methods in `sync.ts` to buffer offline writes instead of dropping them.
- **Non-Destructive Hydration:** Rewrote `hydrateUserCache` in `sync.ts`. It no longer calls `table.clear()`. It now performs a smart diff against Supabase, preserving local un-synced offline edits.
- **Queue Processor:** Added `processSyncQueue()` to chronologically upload offline edits, hooked to the `window.addEventListener('online')` event.
- **Realtime Safety:** `applyRemotePayload` now ignores incoming events if there is a pending local offline write for that record ID.

#### Leftover Tasks / Known Bugs:
- **Auth Page UI:** The previous agent started a refactor of `Auth.tsx` and `auth-flow.css`. It is currently a WIP and needs to be finished.
- **Today Navigation:** The `Today` bottom-nav item currently routes to `/home`. User needs it to be a distinct execution screen or renamed appropriately.
- **UI Refactor:** Proceed with the overarching UI refactor plan located in `docs/plans/2026-06-19-ui-system-refactor.md`.

#### Files Touched:
- `src/db/db.ts`
- `src/data/sync.ts`
- `src/db/seed.ts`
