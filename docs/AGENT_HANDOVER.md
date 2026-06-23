# RKA OS - Agent Handover & Project Context

*This document is intended for AI coding assistants to quickly understand the project architecture, recent changes, and ongoing roadmaps when starting a new session.*

## 🏗️ Project Architecture
- **Goal:** "RKA OS" is a premium, local-first PWA intended as a "second brain". It currently includes a rich Workout mini-app and task management.
- **Tech Stack:** React 19, Vite 8, TypeScript. Vanilla CSS (no Tailwind).
- **Data Layer:** 
  - **Local-First:** Uses `Dexie.js` (v4) as the primary authoritative database. The schema relies heavily on a generic graph-node model (`items`, `itemInstances`, `entityLinks`).
  - **Remote Sync:** `Supabase` is used for backup and cross-device sync.
  - **Sync Bridge:** Located in `src/data/sync.ts`. It monkey-patches Dexie table methods to intercept mutations and queue them for Supabase upload, while applying realtime Postgres events to IndexedDB.

## ⚠️ CRITICAL Architecture Rules (Read Before Any Code Change)
1. **Single Write Path**: ALL writes go through `src/db/actions.ts` → Dexie → sync bridge → Supabase. **NEVER call Supabase `.upsert()` or `.delete()` directly from components or `data/*.ts` files.**
2. **Single Read Path**: ALL reads come from Dexie via `useLiveQuery()`. Never read from Supabase directly in components.
3. **Soft Delete**: `deleteEntity()` sets `deletedAt` + `updatedAt` — it does NOT call `db.table.delete()`. This preserves history and enables recovery.
4. **Suppress Sync**: Use `withRemoteWritesSuppressedAsync()` for batch operations (hydration, seeding) to avoid loop-backs.

## 📝 Ongoing Roadmaps
- **UI System Refactor:** Located at `docs/plans/2026-06-19-ui-system-refactor.md`. Focuses on standardizing components (rows, pills, headers) and removing page-level drift.

---

## 🕒 Change Log & Handover

### 📅 Session: 2026-06-23
**Agent:** Antigravity  
**Time Spent:** ~1 hour  
**Focus:** Full Backend & Sync Audit → Sync Hardening (v2.7.0)

#### What was done:
- **Backend Audit:** Ran comprehensive audit of all source files, Supabase schema, sync engine, and data flow. Identified 5 critical data-loss vectors and 10+ moderate issues.
- **Fix #1 — Unified Write Path:** Stripped all direct Supabase calls from `src/data/items.ts`, `src/data/workouts.ts`, `src/data/activityLogs.ts`, `src/data/entityLinks.ts`. These files are now Dexie-only read helpers.
- **Fix #2 — Logout Guard:** `AuthProvider.tsx` now checks `getPendingSyncCount()` before signing out. If pending writes exist, the user is warned and offered a Force Sync first. Prevents silent data loss on offline logout.
- **Fix #3 — Queue-First Hydration:** `hydrateUserCache()` in `sync.ts` now flushes the sync queue before pulling remote data (Step 1: push → Step 2: pull). This prevents offline writes from being overwritten by remote hydration.
- **Fix #4 — Exponential Backoff Retry:** `processSyncQueue()` now retries failed batches with exponential backoff (`syncRetryDelay`: 1s→2s→4s→…→60s) instead of stopping permanently on first error.
- **Fix #5 — Soft Delete:** `deleteEntity()` in `actions.ts` now sets `deletedAt` + `updatedAt` on the item and its instances instead of calling hard `.delete()`.
- **Fix #6 — DB Indexes:** Added new Supabase migration `20260623000000_add_indexes.sql` with indexes on `user_id`, `type`, `status`, `scheduled_date`, and all foreign key columns across all 10 tables.
- **Fix #7 — Timestamp Serialization:** `toNumber()` in `serializers.ts` now returns `undefined` for null/invalid timestamps (not `Date.now()`). Added `toNumberOrNow()` variant for required fields.
- **Docs Updated:** `.agents/CONTEXT.md`, `.agents/ROADMAP.md`, `docs/AGENT_HANDOVER.md`, `src/components/ui/VersionHistoryModal.tsx` all updated.

#### Files Touched:
- `src/data/items.ts` — stripped to Dexie-only reads
- `src/data/workouts.ts` — stripped to Dexie-only reads
- `src/data/activityLogs.ts` — stripped to Dexie-only reads
- `src/data/entityLinks.ts` — stripped to Dexie-only reads
- `src/data/sync.ts` — exponential backoff, queue-first hydration, getPendingSyncCount export
- `src/data/serializers.ts` — fixed toNumber() → toNumberOrNow() for required fields
- `src/auth/AuthProvider.tsx` — logout guard added
- `src/db/actions.ts` — soft delete implementation
- `src/components/ui/VersionHistoryModal.tsx` — v2.7.0 changelog
- `supabase/migrations/20260623000000_add_indexes.sql` — new migration
- `.agents/CONTEXT.md` — full rewrite with audit findings
- `.agents/ROADMAP.md` — Phase 2 completed, Phase 3 upcoming

#### Leftover Tasks / Known Issues:
- **Supabase DB migration pending deployment**: The new `20260623000000_add_indexes.sql` migration needs to be applied to the live Supabase project (`npx supabase db push` or via the Supabase dashboard).
- **Soft delete not yet reflected in UI filters**: Components that list items should filter out `item.deletedAt != null`. The Dexie read helpers in `data/*.ts` already do this filtering, but any direct `useLiveQuery()` calls in pages may need to add `.filter(i => !i.deletedAt)`.
- **Auth Page UI:** Previous WIP refactor of `Auth.tsx` and `auth-flow.css` still needs finishing.
- **UI Refactor:** Proceed with `docs/plans/2026-06-19-ui-system-refactor.md`.

### 📅 Session: 2026-06-22
**Agent:** Antigravity  
**Time Spent:** ~1 hour  
**Focus:** Backend Sync Resilience & Offline Queue

#### What was done:
- **Offline Queue Added:** Created the `syncQueue` table in `src/db/db.ts` (bumped to v2). Hooked Dexie proxy methods in `sync.ts` to buffer offline writes instead of dropping them.
- **Non-Destructive Hydration:** Rewrote `hydrateUserCache` in `sync.ts`. It no longer calls `table.clear()`. It now performs a smart diff against Supabase, preserving local un-synced offline edits.
- **Queue Processor:** Added `processSyncQueue()` to chronologically upload offline edits, hooked to the `window.addEventListener('online')` event.
- **Realtime Safety:** `applyRemotePayload` now ignores incoming events if there is a pending local offline write for that record ID.

#### Files Touched:
- `src/db/db.ts`
- `src/data/sync.ts`
- `src/db/seed.ts`
