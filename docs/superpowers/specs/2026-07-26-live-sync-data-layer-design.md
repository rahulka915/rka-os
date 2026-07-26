# Live Sync Data Layer — Design

## Context

This is sub-project 1 of a two-part effort to add a desktop/Mac/web companion app to RKA OS with real-time sync against the existing mobile app.

Today, mobile app data lives in local SQLite (`apps/mobile/src/db/database.ts`) with an opt-in manual backup/restore against Firestore (`apps/mobile/src/services/backupSync.ts`): the whole DB is serialized and pushed as one JSON blob, and restore pulls the latest blob wholesale. This is fine for a single active device, but breaks down the moment two clients (e.g. phone + a future Mac app) are used concurrently — whichever device backs up last silently overwrites the other's changes, with no per-item merge.

This sub-project reworks mobile's data layer to sync live, per-record, with proper offline support — independent of and prior to building any new client. It ships value on its own (safer against data loss, multi-phone sync) and is a prerequisite for sub-project 2 (web/Mac client), since it also gives the app a data-access layer that isn't tied to `expo-sqlite` (which doesn't run in a browser).

## Goals

- Real-time, per-record sync between devices signed into the same account — edits on one device appear on another within seconds when both are online.
- Full offline support: capture, complete tasks, log doses, etc. must all work with zero connectivity, and queued changes sync automatically once back online.
- Replace the current whole-DB snapshot backup/restore as the sync mechanism.
- Lay a data-access foundation that will also work from a browser/Mac client (sub-project 2), without committing to that work here.

## Non-goals

- Building the web/Mac client itself (sub-project 2).
- Multi-user collaboration / sharing data between different accounts (data is scoped per-user; a shared-project feature is out of scope here).
- CRDT-grade conflict resolution — plain last-write-wins per document is accepted (see Conflict Handling).
- Preserving a fully account-less mode. Sign-in becomes mandatory (once per device); this is a personal app used by one person across their own devices.

## Architecture

Firestore becomes the single source of truth for app data, replacing `expo-sqlite`. The existing Firebase JS SDK (`firebase/firestore`) is reconfigured with persistent local cache (`persistentLocalCache`), which gives every platform the same behavior: reads/writes hit the local cache instantly, changes queue automatically while offline, and sync to the server — then to other devices — the moment connectivity returns.

Real-time listeners (`onSnapshot`) replace the current synchronous `getDb()` calls; screens subscribe to live query results instead of reading a local SQLite snapshot on demand.

Data is scoped per-user under `users/{userId}/...`, enforced by Firestore security rules restricting all reads/writes to `users/{request.auth.uid}/...`.

Sign-in (already implemented via Firebase Auth email/password in `useBackup.ts`) becomes mandatory on first launch per device. After that initial sign-in, the app behaves like today — fully offline-capable via Firestore's local cache.

## Data Model

Each current SQLite table becomes a Firestore subcollection under `users/{userId}/`:

| SQLite table | Firestore collection | Notes |
|---|---|---|
| `items` | `items` | Same fields; `metadata` becomes a native map instead of a serialized JSON string |
| `itemInstances` | `itemInstances` | Same fields |
| `activityLogs` | `activityLogs` | Same fields |
| `itemRelations` | `itemRelations` | Same fields |
| `itemOrder` | `itemOrder` | Composite key (`listKey` + `itemId`) becomes the document ID, e.g. `project:abc123__item:xyz789` |
| `appSettings` | `appSettings` | Same key/value shape |

Soft-delete columns (`deletedAt`, `archivedAt`) carry over unchanged — same filtering logic, now as Firestore `where` clauses instead of SQL predicates.

The existing `backups` collection (whole-DB snapshot blobs) is retired as the sync mechanism. A lightweight **manual "export backup" action** is kept as a standalone disaster-recovery safety net — dumps current Firestore data to a JSON file on demand, unrelated to live sync.

## Migration & Refactor Strategy

Every screen/hook today calls synchronous functions like `getInboxItems()` directly against `db/database.ts`. These all need to become async/reactive. This is done feature-by-feature, not as a big-bang rewrite, so the app keeps working throughout:

1. Build a new Firestore data-access layer with function/hook shapes mirroring today's as closely as possible (e.g. a `useInboxItems()` hook replacing the synchronous `getInboxItems()`), so call-site changes are mostly "swap the import, add a loading state" rather than screen rewrites.
2. Migrate one vertical slice at a time — e.g. Inbox → Tasks → Calendar → Medication tracking → Activity log — verifying each slice works before moving to the next.
3. **One-time data migration**: on first sign-in after this ships, read the existing local SQLite DB and write it into the user's new Firestore collections. This is a one-shot upload, not ongoing dual-write.
4. Once migration is verified end-to-end, delete `expo-sqlite` usage and the old `backupSync.ts` snapshot push/restore logic, except for the manual export action (which now reads from Firestore instead of SQLite).

Given the number of call sites, this migration is expected to span multiple implementation-plan checkpoints (per feature slice), not a single PR.

## Conflict Handling

Firestore's default per-document last-write-wins is the accepted merge strategy. Because data is already split into fine-grained documents (one item, one instance, one log entry — not one blob), the only real collision case is editing the *same field of the same document* from two devices within the same sync window, which is rare for a single-person app and low-stakes if it happens (loses one field's edit, not the whole database — unlike today's snapshot model).

## Error Handling

The Firestore SDK handles retry and write-queueing for offline writes automatically — no custom retry logic needed. Security rules enforce per-user data isolation at the database level, so a bug can't cause cross-account data leakage.

## Testing

- Firestore emulator for unit/integration tests of the new data-access functions, avoiding a live network dependency in tests.
- Manual verification per migrated feature slice: two devices (or simulator + device) signed in as the same user, confirm edits propagate live; toggle airplane mode, make changes, reconnect, confirm they sync correctly.

## Open Items For Implementation Planning

- Exact order of feature slices to migrate.
- Firestore security rules content (draft during implementation, not this design).
- Whether `itemOrder` composite-key documents need any additional indexing for the existing per-list queries.
