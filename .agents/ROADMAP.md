# RKA OS Roadmap

## ✅ Completed Milestones (Phase 1: Foundation)
- [x] Initial scaffolding (Vite + React + TS).
- [x] Database Schema setup (Dexie + Supabase).
- [x] Local-first Sync Bridge with queue-based architecture.
- [x] User Authentication via Supabase GoTrue.
- [x] Core Entities: Items, Instances, Activity Logs, Workouts, Medications.
- [x] Complex Home Dashboard timeline (Morning/Afternoon/Evening logic based on item metadata).
- [x] PWA configuration with installability and custom Icons.
- [x] Sync Engine enhancements (Force sync, push-before-pull data protection).
- [x] Fully responsive layout (Desktop Sidebar vs Mobile Bottom Tabs).
- [x] Smart Auto-Updater: Polls SW and reloads automatically when user is idle.
- [x] Native-feeling "Pull to Refresh" UI.

## ✅ Completed Milestones (Phase 2: Sync Hardening — June 2026)
- [x] **Backend Audit**: Comprehensive audit identified 5 critical data loss vectors and 10+ moderate issues.
- [x] **Unified Write Path**: Removed all direct Supabase writes from `data/*.ts` files. All writes now go exclusively through Dexie → sync bridge → queue → Supabase.
- [x] **Logout Guard**: `AuthProvider` now warns users if there are pending unsynced changes before logout, with an option to Force Sync first.
- [x] **Smart Hydration (Queue-First)**: `hydrateUserCache()` now flushes the sync queue before pulling remote data, preventing offline writes from being overwritten by hydration.
- [x] **Exponential Backoff Retry**: `processSyncQueue()` now retries failed batches with exponential backoff (1s→2s→4s→8s, max 60s) instead of stopping permanently on first error.
- [x] **Soft Delete**: `deleteEntity()` now sets `deletedAt` timestamp instead of hard-deleting records, enabling recovery and safer conflict resolution.
- [x] **DB Indexes**: Added Supabase migration with indexes on `user_id`, `type`, `status`, and all foreign key columns.
- [x] **Fixed Timestamp Serialization**: `toNumber()` in `serializers.ts` now returns `null` for unparseable timestamps instead of defaulting to `Date.now()`.
- [x] **Updated Agent Docs**: `CONTEXT.md` and `ROADMAP.md` fully reflect the hardened architecture.

## 🏗 Active / Upcoming (Phase 3: Refinement & Advanced Features)
- **Design Enhancements**: Replacing placeholders (like the "RKA OS" text) with proper custom SVG/image logos.
- **Grid Layout Tool**: The user mentioned wanting a grid overlay tool in the Profile section to help with visual UI positioning/testing on live devices.
- **Performance & Edge Cases**: Handling massive Sync Queues smoothly, adding pagination to Activity Logs if they grow too large.
- **Dexie Middleware Migration**: Replace monkey-patching with Dexie's official `db.use()` middleware system for a more maintainable sync bridge.
- **Data Export**: Allow user to download all data as a JSON backup from the Profile page.

## 🔮 Future Ideas (Phase 4)
- Push Notifications for reminders (Service Worker Push API).
- Background Sync API integration — process the sync queue even when the app tab is closed.
- Multi-device conflict resolution improvements (CRDTs or timestamp-wins logic).
- Deep integration with Health APIs (Apple Health / Google Fit) if running in a capacitor/native shell wrapper.
