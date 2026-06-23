# RKA OS Context & Architecture

This document serves as the foundational context for any agent working on this repository. Read this completely before starting tasks to understand the architecture, design philosophy, and data flow.

## 1. Tech Stack
- **Frontend**: React 19, TypeScript, Vite 8
- **Styling**: Vanilla CSS (`.css` files), CSS Variables for theming (e.g., `var(--rka-bg)`). No Tailwind.
- **Local DB**: Dexie.js v4 (wrapper for IndexedDB) + `dexie-react-hooks` (`useLiveQuery`). Database name: `PersonalOS_v5`.
- **Backend / Auth**: Supabase (PostgreSQL 17, Row Level Security, GoTrue Auth, Realtime).
- **Icons**: `lucide-react`.
- **PWA**: `vite-plugin-pwa` (Service Worker, Web Manifest, `registerType: 'prompt'`).
- **Deployment**: Vercel (auto-deploys from git push). SPA rewrite in `vercel.json`.

## 2. Core Architecture (Local-First Offline Sync)
The app is strictly **Local-First**. The frontend reads and writes EXCLUSIVELY from the local IndexedDB database (via `Dexie`).
It does not await network requests for UI changes.

### GOLDEN RULE — Single Write Path
> ALL writes go through `src/db/actions.ts` → Dexie → sync bridge → Supabase.
> **NEVER write directly to Supabase from components or data/*.ts files.** The monkey-patch sync bridge in `sync.ts` intercepts every Dexie mutation and enqueues it for remote sync automatically.
> The files `src/data/items.ts`, `src/data/workouts.ts`, `src/data/activityLogs.ts`, `src/data/entityLinks.ts` are **thin read wrappers only** — they read from Dexie (not Supabase). Do NOT add direct Supabase upsert/delete calls to them.

### GOLDEN RULE — Single Read Path
> ALL reads go through Dexie via `useLiveQuery()`. Never read from Supabase directly inside components or pages.

### How Sync Works (`src/data/sync.ts`)
1. **Monkey-patching**: `installSupabaseSyncBridge(db)` (called in `db.ts`) wraps all Dexie table mutation methods (`add`, `put`, `update`, `delete`, `clear`, `bulkAdd`, `bulkPut`, `bulkDelete`) to automatically enqueue a sync entry after each local write.
2. **Sync Queue**: The `syncQueue` table (IndexedDB) persists write operations. Each entry has: `id`, `tableName`, `operation` (upsert/delete/clear), `recordId`, `createdAt`.
3. **Queue Processor** (`processSyncQueue()`): Dequeues entries chronologically and executes batched remote upserts/deletes against Supabase. Has exponential backoff on failure (1s→2s→4s→8s, max 60s). Queue entries are preserved on failure and retried automatically.
4. **Smart Hydration** (`hydrateUserCache()`): On login or app-foreground, first flushes the local sync queue (push local → remote), then pulls all remote data and reconciles. Local records pending upsert are NEVER overwritten. Local records with pending deletes are excluded from pull. This protects offline changes.
5. **Sync Status**: `sync.ts` emits global custom events (`rka-sync-status`) which UI components listen to to display real-time 'syncing', 'synced', 'error', or 'offline' states.
6. **Realtime**: Supabase Realtime channel `rka-os-sync:{userId}` listens to `postgres_changes` on all 10 tables filtered by `user_id`. Incoming remote changes are applied to local Dexie via the stored `originalTableMethods` (bypassing sync bridge to avoid loops).
7. **Logout Guard**: Before logging out, the app checks `syncQueue.count()`. If there are pending entries, the user is warned and given the option to force-sync first or discard and logout.

### Sync Queue Suppression
Use `withRemoteWritesSuppressedAsync()` (or `pushRemoteWriteSuppression()` / `popRemoteWriteSuppression()`) when performing batch operations (hydration, seeding) that should NOT enqueue sync entries. This prevents loops during hydration and seeding.

## 3. UI & Design Philosophy
- **Responsive Layout**: Controlled primarily in `src/components/shell/AppShell.tsx` and `shell.css`.
  - **Desktop**: Features a left-side `SidebarNav` (width 228px). The top header (`AppHeader`) is hidden.
  - **Mobile**: Features a `BottomTabNav` and an `AppHeader`.
- **Pull-To-Refresh**: A custom wrapper in `AppShell` that detects downward swiping at the top of the scroll view. When triggered, it calls `forceSyncAll()` to push local data and pull remote data.
- **Safe Areas**: Extensive use of `env(safe-area-inset-top)` and `env(safe-area-inset-bottom)` to account for iPhone notches, dynamic islands, and home indicators.
- **Aesthetics**: Heavy reliance on glassmorphism (`backdrop-filter: blur()`), smooth transitions (`160ms ease-out`), and modern system fonts (Inter/SF Pro).

## 4. Service Worker & Auto-Updates
- Managed by `vite-plugin-pwa`.
- The component `src/components/shell/UpdatePrompt.tsx` handles PWA updates.
- It aggressively polls the service worker every 30 seconds for new deployments.
- If an update is detected, it waits for the user to be idle (no mouse/keyboard/touch activity for 5 seconds) before forcing an automatic `location.reload()`. This prevents the user from having to manually refresh to see newly deployed features.
- **Dev note**: Dev mode (`resetDevPwaState()` in `main.tsx`) unregisters all service workers and clears caches on localhost. Offline behavior should be tested on the live Vercel deployment.

## 5. Domain Models (`src/db/db.ts`)
- **Items**: Abstract tasks, routines, or entities (e.g., "Drink Water", "Read a Book"). Type can be: `area`, `project`, `task`, `habit`, `medication`, `workout-template`, `workout-block`, `exercise`, `meal`.
- **ItemInstances**: Concrete executions of items on specific dates. `src/db/actions.ts` (`generateDailyInstances`) runs on boot to clone repeating Items into concrete instances for "today".
- **ActivityLogs**: Immutable ledgers of actions (e.g., "medication-taken", "workout-logged").
- **Soft Delete**: All tables have `deletedAt` / `deleted_at` columns. Use these instead of hard deletes. `deleteEntity()` sets `deletedAt` and `updatedAt`; it does NOT call `db.table.delete()`.

## 6. Key Files to Know
- `src/App.tsx`: Routing, Supabase Auth initialization, and PWA registration.
- `src/db/db.ts`: Dexie schema definition (PersonalOS_v5, currently v2).
- `src/db/actions.ts`: **The ONLY place to write data.** Business logic for all entity operations.
- `src/data/sync.ts`: The Sync Engine — queue, hydration, realtime, retry backoff.
- `src/data/items.ts` / `workouts.ts` / `activityLogs.ts` / `entityLinks.ts`: Read-only Dexie helpers. Do NOT add direct Supabase writes here.
- `src/auth/AuthProvider.tsx`: Auth context + logout guard (warns if unsynced data exists).
- `src/pages/Home.tsx`: The complex dashboard timeline grouping instances by morning/afternoon/evening.
- `src/components/ui/VersionHistoryModal.tsx`: The changelog (MUST be updated every PR/Feature!).

## 7. Database (Supabase PostgreSQL)
- **10 remote tables**: `items`, `item_instances`, `tags`, `item_tags`, `entity_links`, `activity_logs`, `workout_sessions`, `exercise_sessions`, `set_entries`, `exercise_media`.
- **RLS**: All tables have `FOR SELECT` and `FOR ALL` policies scoped to `user_id = auth.uid()`.
- **Indexes**: Added in migration `20260623_add_indexes.sql` on `user_id`, `type`, `status`, and foreign key columns.
- **Serialization**: Dexie uses `camelCase`, Supabase uses `snake_case`. All conversion goes through `src/data/serializers.ts`. Never bypass this layer.

## 8. Known Limitations / Future Work
- Monkey-patching Dexie methods is fragile — a future refactor should use Dexie's official middleware/hooks system (`db.use()`).
- No per-record conflict resolution beyond last-write-wins. Multi-device simultaneous edits to the same record will defer to whichever write arrives at Supabase last.
- Background Sync API (Service Worker) is not yet implemented — writes only sync when the app is open/foregrounded.
