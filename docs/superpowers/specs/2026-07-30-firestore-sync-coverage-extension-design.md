# Firestore Sync Coverage Extension — Design

## Context

`apps/mobile/src/services/firestoreSync.ts` implements real-time bidirectional sync between local SQLite and Cloud Firestore, but only for the `items` and `itemInstances` tables. `itemRelations` (Areas/Projects links), `itemOrder` (manual drag-to-reorder), `appSettings` (key/value prefs), and `activityLogs` (medication dose history, timer state, GTD/status-change audit trail) are not synced at all — they exist only in local SQLite on each device.

This is a prerequisite for the planned web/Mac companion app: that client will read/write Firestore directly (no local SQLite, per the desktop/web companion brainstorm), so it can only show data that's actually in Firestore. Closing this gap now, on mobile, ships value independently (these tables sync between multiple phones too) and unblocks the companion app design.

This follows directly on from the items-table fix (`syncItemToRemote`, wired into every item-mutating function in `db/database.ts`, commit `f6f357e`).

## Goals

- `itemRelations`, `itemOrder`, `appSettings`, and `activityLogs` sync in real time between devices signed into the same account, same as `items`/`itemInstances` already do.
- Follow the exact existing pattern in `firestoreSync.ts` (push-on-write + `onSnapshot` listener merging into SQLite) — no new architecture.

## Non-goals

- The web/Mac companion client itself (separate, later sub-project).
- Changing mobile's storage model — SQLite stays the local source of truth, Firestore stays a sync layer on top (per the existing dual-write architecture, not the Firestore-native rewrite that was scoped and then abandoned earlier — see `project_firestore_sync_dual_write` memory).
- Automated tests — matches the existing `items`/`itemInstances` sync, which has none; verified manually.

## Design

### Doc ID scheme per collection

- `itemRelations`: use the row's existing `id` column as the Firestore doc ID (already unique).
- `itemOrder`: no natural single-column key (SQLite composite PK is `listKey`+`itemId`) — Firestore doc ID is `${listKey}__${itemId}`.
- `appSettings`: use `key` as the Firestore doc ID.
- `activityLogs`: use the row's existing `id` column as the Firestore doc ID.

### Push functions (new, in `firestoreSync.ts`)

- `pushItemRelationToFirestore(userId, relation)` / `deleteItemRelationFromFirestore(userId, sourceId, relationType)`
- `pushItemOrderToFirestore(userId, listKey, orderedIds)` — writes the full batch for that `listKey` (delete existing docs with that prefix, set new ones), mirroring `setManualOrder`'s SQLite delete-then-reinsert.
- `pushAppSettingToFirestore(userId, key, value)`
- `pushActivityLogToFirestore(userId, log)`

### Listeners (extend `startRealtimeSync`/`stopRealtimeSync`)

Four more `onSnapshot` listeners, one per collection, following the existing `items` listener's shape: on `added`/`modified`, apply to SQLite via `INSERT OR REPLACE` if the remote row is "newer" (see merge rule below); on `removed`, `DELETE` the local row. All four share the existing `isApplyingRemoteChange` guard so applying a remote change doesn't re-trigger a push.

### Merge rule (newer-wins) per collection

- `itemRelations`: compare `createdAt`. Low conflict risk — a relation is set-once-per-(sourceId, relationType), not frequently re-edited.
- `itemOrder`: no per-row merge — a reorder is a whole-list operation, so the batch write for a `listKey` simply replaces whatever was there (last full write for that list wins).
- `appSettings`: compare `updatedAt` (column already exists).
- `activityLogs`: compare `createdAt`. Rows are mutated in place by timer functions (pause/resume/stop), but those are a natural sequence within one device's session, not concurrent edits — `createdAt`-ordering is sufficient.

### Call sites to wire in `db/database.ts`

- `setRelation` → push on set; delete-push on clear (`targetId === null` branch).
- `setManualOrder` → push the batch after the SQLite transaction.
- `setAppSetting` → push on write.
- `logActivity` → push on new row.
- Timer-mutation functions that rewrite an existing `activityLogs` row's `details` (`stopMedicationTimer`, `completeMedicationTimer`, `setMedicationTimerNotificationId`, `pauseMedicationTimer`, `markMedicationTimerNotified`, `resumeMedicationTimer`, `resetMedicationTimer`, `startTimerFromLoggedDose`) → push after each SQLite update, using the same doc-ID (row `id`) so the write is a Firestore `setDoc` upsert, not a new document.

### Error handling

Identical to existing push functions: try/catch, `console.warn` on failure, never throws to the caller. `sanitizeForFirestore` (existing helper, strips `undefined` fields) reused for all new push payloads.

## Self-review notes

- Placeholder scan: none found.
- Scope check: focused to one file (`firestoreSync.ts`) plus wiring in `db/database.ts` — appropriately sized for one implementation pass, not decomposed further.
- Ambiguity check: `itemOrder`'s lack of per-row merge is called out explicitly as accepted behavior (whole-list replace), not an oversight.
