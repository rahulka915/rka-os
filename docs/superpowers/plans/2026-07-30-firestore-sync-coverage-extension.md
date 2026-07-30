# Firestore Sync Coverage Extension Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend `apps/mobile/src/services/firestoreSync.ts`'s existing real-time sync (currently `items`/`itemInstances` only) to also cover `itemRelations`, `itemOrder`, `appSettings`, and `activityLogs`, so every table SQLite holds is mirrored live to Firestore.

**Architecture:** Same dual-write shim pattern already in place: a push function per collection called from the relevant `db/database.ts` mutation, plus an `onSnapshot` listener per collection in `startRealtimeSync` that applies remote changes into SQLite (guarded by the existing `isApplyingRemoteChange` flag so applying a remote write never re-triggers a push).

**Tech Stack:** `firebase/firestore` (already a dependency), `expo-sqlite` (unchanged), existing `node --test` runner for the typecheck/regression-suite verification steps (no new automated tests — matches the existing convention: `items`/`itemInstances` sync has none either).

## Global Constraints

- SQLite stays the local source of truth; Firestore stays a sync layer on top — no change to that architecture (see `docs/superpowers/specs/2026-07-30-firestore-sync-coverage-extension-design.md`).
- Doc ID scheme: `itemRelations` and `activityLogs` use their existing SQLite `id` column; `itemOrder` uses `${listKey}__${itemId}` (no natural single-column key); `appSettings` uses `key`.
- Merge rule ("which write is newer, local or remote"): `itemRelations`/`activityLogs` compare `createdAt`; `appSettings` compares `updatedAt` (column exists); `itemOrder` has no per-row merge — a reorder is a whole-list batch write that simply replaces what was there.
- All new push functions follow the existing pattern in `firestoreSync.ts`: `async`, guarded by `hasFirebaseConfig`/`firestore`/`userId`/`!isApplyingRemoteChange`, wrapped in try/catch with `console.warn` on failure, payload passed through the existing `sanitizeForFirestore` helper.
- No automated tests for this plan (matches existing `items`/`itemInstances` sync, which has none) — each task's deliverable is verified via `npx tsc --noEmit`, the existing `npm test` suite, and a documented manual multi-device check.

---

## File Structure

**Modify:**
- `apps/mobile/src/db/types.ts` — add `ItemRelationRow`, `ItemOrderRow`, `AppSettingRow` interfaces (Task 1)
- `apps/mobile/src/services/firestoreSync.ts` — add push functions + listeners for all four collections (Tasks 1–4)
- `apps/mobile/src/db/database.ts` — wire push calls into `setRelation`, `setManualOrder`, `setAppSetting`, `logActivity`, and the 8 medication-timer functions (Tasks 1–4)

---

## Task 1: `itemRelations` sync

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/services/firestoreSync.ts`
- Modify: `apps/mobile/src/db/database.ts:179-190` (`setRelation`)

**Interfaces:**
- Produces: `ItemRelationRow` type (`{ id: string; sourceId: string; targetId: string; relationType: string; createdAt: number }`); `pushItemRelationToFirestore(userId, relation): Promise<void>`; `deleteItemRelationFromFirestore(userId, relationId): Promise<void>`.

- [ ] **Step 1: Add the `ItemRelationRow` type**

In `apps/mobile/src/db/types.ts`, append:

```typescript
export interface ItemRelationRow {
  id: string;
  sourceId: string;
  targetId: string;
  relationType: string;
  createdAt: number;
}
```

- [ ] **Step 2: Add push/delete functions to `firestoreSync.ts`**

Add near the existing `pushItemToFirestore`/`deleteItemFromFirestore` functions:

```typescript
import type { Item, ItemInstance, ItemRelationRow } from '../db/types';

/**
 * Pushes a single item relation to Firestore for the active user.
 */
export async function pushItemRelationToFirestore(userId: string, relation: ItemRelationRow): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const relationRef = doc(firestore, 'users', userId, 'itemRelations', relation.id);
    await setDoc(relationRef, sanitizeForFirestore(relation), { merge: true });
  } catch (err) {
    console.warn('[firestoreSync] pushItemRelation error:', err);
  }
}

/**
 * Deletes an item relation from Firestore.
 */
export async function deleteItemRelationFromFirestore(userId: string, relationId: string): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const relationRef = doc(firestore, 'users', userId, 'itemRelations', relationId);
    await deleteDoc(relationRef);
  } catch (err) {
    console.warn('[firestoreSync] deleteItemRelation error:', err);
  }
}
```

(Update the top-of-file `import type { Item, ItemInstance } from '../db/types';` to also import `ItemRelationRow`, as shown above, rather than adding a second import line.)

- [ ] **Step 3: Add an `itemRelations` listener**

Add a new unsubscribe variable near the top of the file, alongside the existing ones:

```typescript
let itemRelationsUnsubscribe: Unsubscribe | null = null;
```

Inside `startRealtimeSync`, after the existing `itemsUnsubscribe = onSnapshot(...)` block, add:

```typescript
  // Listen to remote itemRelations subcollection
  const itemRelationsRef = collection(firestore, 'users', userId, 'itemRelations');
  itemRelationsUnsubscribe = onSnapshot(
    itemRelationsRef,
    (snapshot) => {
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as ItemRelationRow;
            if (!remote.id) return;

            if (change.type === 'added' || change.type === 'modified') {
              const localRows = db.getAllSync<{ createdAt: number }>(
                `SELECT createdAt FROM itemRelations WHERE id = ?`,
                [remote.id]
              );
              const local = localRows[0];

              if (!local || (remote.createdAt && remote.createdAt >= local.createdAt)) {
                db.runSync(
                  `INSERT OR REPLACE INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
                   VALUES (?, ?, ?, ?, ?)`,
                  [remote.id, remote.sourceId, remote.targetId, remote.relationType, remote.createdAt ?? Date.now()]
                );
                hasMutatedLocal = true;
              }
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM itemRelations WHERE id = ?`, [remote.id]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local itemRelations apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
    },
    (error) => {
      console.warn('[firestoreSync] itemRelations listener error:', error);
    }
  );
```

In `stopRealtimeSync`, add:

```typescript
  if (itemRelationsUnsubscribe) {
    itemRelationsUnsubscribe();
    itemRelationsUnsubscribe = null;
  }
```

- [ ] **Step 4: Wire the push/delete calls into `setRelation`**

In `apps/mobile/src/db/database.ts`, replace:

```typescript
export function setRelation(sourceId: string, relationType: string, targetId: string | null): void {
  if (targetId === null) {
    getDb().runSync(`DELETE FROM itemRelations WHERE sourceId = ? AND relationType = ?`, [sourceId, relationType]);
    return;
  }
  getDb().runSync(
    `INSERT INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sourceId, relationType) DO UPDATE SET targetId = excluded.targetId`,
    [uuidv4(), sourceId, targetId, relationType, Date.now()]
  );
}
```

with:

```typescript
export function setRelation(sourceId: string, relationType: string, targetId: string | null): void {
  if (targetId === null) {
    const existing = getDb().getAllSync<{ id: string }>(
      `SELECT id FROM itemRelations WHERE sourceId = ? AND relationType = ?`,
      [sourceId, relationType]
    );
    getDb().runSync(`DELETE FROM itemRelations WHERE sourceId = ? AND relationType = ?`, [sourceId, relationType]);
    const userId = getCurrentSyncUserId();
    if (userId) {
      for (const row of existing) {
        deleteItemRelationFromFirestore(userId, row.id).catch(() => {});
      }
    }
    return;
  }
  const id = uuidv4();
  const createdAt = Date.now();
  getDb().runSync(
    `INSERT INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(sourceId, relationType) DO UPDATE SET targetId = excluded.targetId`,
    [id, sourceId, targetId, relationType, createdAt]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    // Read back the row so an upsert (ON CONFLICT branch) pushes the existing
    // id/createdAt rather than the freshly generated ones from this call.
    const row = getDb().getAllSync<{ id: string; createdAt: number }>(
      `SELECT id, createdAt FROM itemRelations WHERE sourceId = ? AND relationType = ?`,
      [sourceId, relationType]
    )[0];
    if (row) {
      pushItemRelationToFirestore(userId, { id: row.id, sourceId, targetId, relationType, createdAt: row.createdAt }).catch(() => {});
    }
  }
}
```

Add the new imports at the top of `db/database.ts`, alongside the existing `firestoreSync` import:

```typescript
import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore } from '../services/firestoreSync';
```

- [ ] **Step 5: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

Run: `npm test`
Expected: all existing tests still pass (82 tests as of the last check).

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/types.ts apps/mobile/src/services/firestoreSync.ts apps/mobile/src/db/database.ts
git commit -m "feat(mobile): sync itemRelations to Firestore in real time"
```

---

## Task 2: `itemOrder` sync

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/services/firestoreSync.ts`
- Modify: `apps/mobile/src/db/database.ts:217-228` (`setManualOrder`)

**Interfaces:**
- Consumes: `getCurrentSyncUserId` from `../services/firestoreSync` (already imported by Task 1).
- Produces: `ItemOrderRow` type (`{ listKey: string; itemId: string; position: number }`); `pushItemOrderBatchToFirestore(userId, listKey, orderedIds): Promise<void>`.

- [ ] **Step 1: Add the `ItemOrderRow` type**

In `apps/mobile/src/db/types.ts`, append:

```typescript
export interface ItemOrderRow {
  listKey: string;
  itemId: string;
  position: number;
}
```

- [ ] **Step 2: Add a batch push function to `firestoreSync.ts`**

`itemOrder` has no per-row merge (see Global Constraints), so this pushes the whole list's rows as one batch — delete every existing doc for that `listKey`, then set the new ones. Update the top-of-file imports first — add `writeBatch`, `getDocs`, `query`, `where` to the existing `firebase/firestore` import and `ItemOrderRow` to the existing `../db/types` import, so they read:

```typescript
import { collection, doc, onSnapshot, setDoc, deleteDoc, writeBatch, getDocs, query, where, type Unsubscribe } from 'firebase/firestore';
import type { Item, ItemInstance, ItemRelationRow, ItemOrderRow } from '../db/types';
```

Then add the function:

```typescript
/**
 * Replaces all itemOrder rows for one listKey in Firestore, matching the local
 * SQLite delete-then-reinsert pattern in setManualOrder.
 */
export async function pushItemOrderBatchToFirestore(
  userId: string,
  listKey: string,
  orderedIds: string[]
): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const batch = writeBatch(firestore);
    const existingSnapshot = await getDocs(
      query(collection(firestore, 'users', userId, 'itemOrder'), where('listKey', '==', listKey))
    );
    existingSnapshot.docs.forEach((d) => batch.delete(d.ref));
    orderedIds.forEach((itemId, position) => {
      const docId = `${listKey}__${itemId}`;
      batch.set(doc(firestore, 'users', userId, 'itemOrder', docId), { listKey, itemId, position });
    });
    await batch.commit();
  } catch (err) {
    console.warn('[firestoreSync] pushItemOrderBatch error:', err);
  }
}
```

- [ ] **Step 3: Add an `itemOrder` listener**

Add the unsubscribe variable:

```typescript
let itemOrderUnsubscribe: Unsubscribe | null = null;
```

Inside `startRealtimeSync`, after the `itemRelations` listener block added in Task 1, add:

```typescript
  // Listen to remote itemOrder subcollection
  const itemOrderRef = collection(firestore, 'users', userId, 'itemOrder');
  itemOrderUnsubscribe = onSnapshot(
    itemOrderRef,
    (snapshot) => {
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as ItemOrderRow;
            if (!remote.listKey || !remote.itemId) return;

            if (change.type === 'added' || change.type === 'modified') {
              db.runSync(
                `INSERT OR REPLACE INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`,
                [remote.listKey, remote.itemId, remote.position]
              );
              hasMutatedLocal = true;
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM itemOrder WHERE listKey = ? AND itemId = ?`, [remote.listKey, remote.itemId]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local itemOrder apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
    },
    (error) => {
      console.warn('[firestoreSync] itemOrder listener error:', error);
    }
  );
```

In `stopRealtimeSync`, add:

```typescript
  if (itemOrderUnsubscribe) {
    itemOrderUnsubscribe();
    itemOrderUnsubscribe = null;
  }
```

- [ ] **Step 4: Wire the push call into `setManualOrder`**

In `apps/mobile/src/db/database.ts`, replace:

```typescript
export function setManualOrder(listKey: string, orderedIds: string[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM itemOrder WHERE listKey = ?`, [listKey]);
    orderedIds.forEach((itemId, position) => {
      database.runSync(
        `INSERT INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`,
        [listKey, itemId, position]
      );
    });
  });
}
```

with:

```typescript
export function setManualOrder(listKey: string, orderedIds: string[]): void {
  const database = getDb();
  database.withTransactionSync(() => {
    database.runSync(`DELETE FROM itemOrder WHERE listKey = ?`, [listKey]);
    orderedIds.forEach((itemId, position) => {
      database.runSync(
        `INSERT INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`,
        [listKey, itemId, position]
      );
    });
  });
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushItemOrderBatchToFirestore(userId, listKey, orderedIds).catch(() => {});
  }
}
```

Update the `firestoreSync` import at the top of `db/database.ts` to also bring in `pushItemOrderBatchToFirestore`:

```typescript
import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore, pushItemOrderBatchToFirestore } from '../services/firestoreSync';
```

- [ ] **Step 5: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/types.ts apps/mobile/src/services/firestoreSync.ts apps/mobile/src/db/database.ts
git commit -m "feat(mobile): sync itemOrder to Firestore in real time"
```

---

## Task 3: `appSettings` sync

**Files:**
- Modify: `apps/mobile/src/db/types.ts`
- Modify: `apps/mobile/src/services/firestoreSync.ts`
- Modify: `apps/mobile/src/db/database.ts:677-685` (`setAppSetting`)

**Interfaces:**
- Produces: `AppSettingRow` type (`{ key: string; value: string; updatedAt: number }`); `pushAppSettingToFirestore(userId, key, value): Promise<void>`.

- [ ] **Step 1: Add the `AppSettingRow` type**

In `apps/mobile/src/db/types.ts`, append:

```typescript
export interface AppSettingRow {
  key: string;
  value: string;
  updatedAt: number;
}
```

- [ ] **Step 2: Add a push function to `firestoreSync.ts`**

Update the top-of-file `../db/types` import to also bring in `AppSettingRow`:

```typescript
import type { Item, ItemInstance, ItemRelationRow, ItemOrderRow, AppSettingRow } from '../db/types';
```

Then add the function:

```typescript
/**
 * Pushes a single app setting to Firestore for the active user.
 */
export async function pushAppSettingToFirestore(userId: string, key: string, value: string): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const settingRef = doc(firestore, 'users', userId, 'appSettings', key);
    await setDoc(settingRef, { key, value, updatedAt: Date.now() }, { merge: true });
  } catch (err) {
    console.warn('[firestoreSync] pushAppSetting error:', err);
  }
}
```

- [ ] **Step 3: Add an `appSettings` listener**

Add the unsubscribe variable:

```typescript
let appSettingsUnsubscribe: Unsubscribe | null = null;
```

Inside `startRealtimeSync`, after the `itemOrder` listener block added in Task 2, add:

```typescript
  // Listen to remote appSettings subcollection
  const appSettingsRef = collection(firestore, 'users', userId, 'appSettings');
  appSettingsUnsubscribe = onSnapshot(
    appSettingsRef,
    (snapshot) => {
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as AppSettingRow;
            if (!remote.key) return;

            if (change.type === 'added' || change.type === 'modified') {
              const localRows = db.getAllSync<{ updatedAt: number }>(
                `SELECT updatedAt FROM appSettings WHERE key = ?`,
                [remote.key]
              );
              const local = localRows[0];

              if (!local || (remote.updatedAt && remote.updatedAt > local.updatedAt)) {
                db.runSync(
                  `INSERT INTO appSettings (key, value, updatedAt)
                   VALUES (?, ?, ?)
                   ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
                  [remote.key, remote.value, remote.updatedAt ?? Date.now()]
                );
                hasMutatedLocal = true;
              }
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM appSettings WHERE key = ?`, [remote.key]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local appSettings apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
    },
    (error) => {
      console.warn('[firestoreSync] appSettings listener error:', error);
    }
  );
```

In `stopRealtimeSync`, add:

```typescript
  if (appSettingsUnsubscribe) {
    appSettingsUnsubscribe();
    appSettingsUnsubscribe = null;
  }
```

- [ ] **Step 4: Wire the push call into `setAppSetting`**

In `apps/mobile/src/db/database.ts`, replace:

```typescript
function setAppSetting(key: string, value: unknown): void {
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO appSettings (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, JSON.stringify(value), now]
  );
}
```

with:

```typescript
function setAppSetting(key: string, value: unknown): void {
  const now = Date.now();
  const serialized = JSON.stringify(value);
  getDb().runSync(
    `INSERT INTO appSettings (key, value, updatedAt)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [key, serialized, now]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushAppSettingToFirestore(userId, key, serialized).catch(() => {});
  }
}
```

Update the `firestoreSync` import at the top of `db/database.ts` to also bring in `pushAppSettingToFirestore`:

```typescript
import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore, pushItemOrderBatchToFirestore, pushAppSettingToFirestore } from '../services/firestoreSync';
```

- [ ] **Step 5: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors.

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/db/types.ts apps/mobile/src/services/firestoreSync.ts apps/mobile/src/db/database.ts
git commit -m "feat(mobile): sync appSettings to Firestore in real time"
```

---

## Task 4: `activityLogs` sync

**Files:**
- Modify: `apps/mobile/src/services/firestoreSync.ts`
- Modify: `apps/mobile/src/db/database.ts` — `logActivity` (line ~1412) and the 8 medication-timer functions (`stopMedicationTimer`, `completeMedicationTimer`, `setMedicationTimerNotificationId`, `pauseMedicationTimer`, `markMedicationTimerNotified`, `resumeMedicationTimer`, `resetMedicationTimer`, `startTimerFromLoggedDose`, lines ~810–941)

**Interfaces:**
- Consumes: `ActivityLog` type (already exists in `db/types.ts`).
- Produces: `pushActivityLogToFirestore(userId, log): Promise<void>`. Changes `logActivity`'s return type from `void` to `string` (the generated log id) — additive, existing callers that ignore the return value are unaffected.

- [ ] **Step 1: Add a push function to `firestoreSync.ts`**

Update the top-of-file `../db/types` import to also bring in `ActivityLog`:

```typescript
import type { Item, ItemInstance, ItemRelationRow, ItemOrderRow, AppSettingRow, ActivityLog } from '../db/types';
```

Then add the function:

```typescript
/**
 * Pushes a single activity log entry to Firestore for the active user.
 */
export async function pushActivityLogToFirestore(userId: string, log: ActivityLog): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const logRef = doc(firestore, 'users', userId, 'activityLogs', log.id);
    await setDoc(logRef, sanitizeForFirestore(log), { merge: true });
  } catch (err) {
    console.warn('[firestoreSync] pushActivityLog error:', err);
  }
}
```

- [ ] **Step 2: Add an `activityLogs` listener**

Add the unsubscribe variable:

```typescript
let activityLogsUnsubscribe: Unsubscribe | null = null;
```

Inside `startRealtimeSync`, after the `appSettings` listener block added in Task 3, add:

```typescript
  // Listen to remote activityLogs subcollection
  const activityLogsRef = collection(firestore, 'users', userId, 'activityLogs');
  activityLogsUnsubscribe = onSnapshot(
    activityLogsRef,
    (snapshot) => {
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as ActivityLog;
            if (!remote.id) return;

            if (change.type === 'added' || change.type === 'modified') {
              const localRows = db.getAllSync<{ createdAt: number }>(
                `SELECT createdAt FROM activityLogs WHERE id = ?`,
                [remote.id]
              );
              const local = localRows[0];

              if (!local || (remote.createdAt && remote.createdAt >= local.createdAt)) {
                db.runSync(
                  `INSERT OR REPLACE INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
                   VALUES (?, ?, ?, ?, ?, ?)`,
                  [
                    remote.id,
                    remote.entityId,
                    remote.actionType,
                    remote.timestamp ?? Date.now(),
                    remote.details ?? null,
                    remote.createdAt ?? Date.now(),
                  ]
                );
                hasMutatedLocal = true;
              }
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM activityLogs WHERE id = ?`, [remote.id]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local activityLogs apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
    },
    (error) => {
      console.warn('[firestoreSync] activityLogs listener error:', error);
    }
  );
```

Note this listener uses `remote.createdAt >= local.createdAt` (not `>`), matching the timer functions' pattern in Step 4 below, where a row is mutated in place multiple times with the same `createdAt` — using `>=` lets the most recent push always win rather than the first write blocking all later ones.

In `stopRealtimeSync`, add:

```typescript
  if (activityLogsUnsubscribe) {
    activityLogsUnsubscribe();
    activityLogsUnsubscribe = null;
  }
```

- [ ] **Step 3: Wire the push call into `logActivity`**

In `apps/mobile/src/db/database.ts`, replace:

```typescript
export function logActivity(entityId: string, actionType: string, details?: string): void {
  const now = Date.now();
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [uuid(), entityId, actionType, now, stringifyDetails(details) ?? null, now]
  );
}
```

with:

```typescript
export function logActivity(entityId: string, actionType: string, details?: string): string {
  const id = uuid();
  const now = Date.now();
  const serializedDetails = stringifyDetails(details) ?? undefined;
  getDb().runSync(
    `INSERT INTO activityLogs (id, entityId, actionType, timestamp, details, createdAt)
     VALUES (?, ?, ?, ?, ?, ?)`,
    [id, entityId, actionType, now, serializedDetails ?? null, now]
  );
  const userId = getCurrentSyncUserId();
  if (userId) {
    pushActivityLogToFirestore(userId, {
      id,
      entityId,
      actionType,
      timestamp: now,
      details: serializedDetails,
      createdAt: now,
    }).catch(() => {});
  }
  return id;
}
```

- [ ] **Step 4: Wire push calls into the 8 medication-timer functions**

Each of these functions ends with `getDb().runSync('UPDATE activityLogs SET details = ? WHERE id = ?', [JSON.stringify(details), logId])`. Add a push call using the same `logId` and the row's other already-known fields right after each one. Since each function already has `log` (the row fetched at the top) and the freshly-mutated `details`, push using those:

In `stopMedicationTimer`, replace:

```typescript
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  _syncLastTakenAt(itemId);
}
```

(the first occurrence, inside `stopMedicationTimer`) with:

```typescript
  getDb().runSync(
    `UPDATE activityLogs SET details = ? WHERE id = ?`,
    [JSON.stringify(details), logId]
  );
  pushActivityLogUpdate(log, details);
  _syncLastTakenAt(itemId);
}
```

To avoid repeating the same push boilerplate 8 times, add one small helper above `stopMedicationTimer` in `db/database.ts`:

```typescript
function pushActivityLogUpdate(log: ActivityLog, details: MedicationTimerDetails): void {
  const userId = getCurrentSyncUserId();
  if (!userId) return;
  pushActivityLogToFirestore(userId, { ...log, details: JSON.stringify(details) }).catch(() => {});
}
```

Then add `pushActivityLogUpdate(log, details);` immediately after each of the other 7 functions' `UPDATE activityLogs` call, in the same position as `stopMedicationTimer` above:

- `completeMedicationTimer`: after `getDb().runSync(\`UPDATE activityLogs SET details = ? WHERE id = ?\`, [JSON.stringify(details), logId]);` (the single-line form)
- `setMedicationTimerNotificationId`: after its single-line `getDb().runSync(...)` call
- `pauseMedicationTimer`: after its multi-line `getDb().runSync(...)` call
- `markMedicationTimerNotified`: after its multi-line `getDb().runSync(...)` call
- `resumeMedicationTimer`: after its multi-line `getDb().runSync(...)` call
- `resetMedicationTimer`: after its multi-line `getDb().runSync(...)` call
- `startTimerFromLoggedDose`: after its multi-line `getDb().runSync(...)` call

(`setMedicationTimerNotificationId` and `markMedicationTimerNotified` don't call `_syncLastTakenAt` — add `pushActivityLogUpdate(log, details);` as the function's last line in those two, matching where `_syncLastTakenAt` sits in the others.)

Update the `firestoreSync` import at the top of `db/database.ts` to also bring in `pushActivityLogToFirestore`:

```typescript
import { getCurrentSyncUserId, pushItemToFirestore, pushItemRelationToFirestore, deleteItemRelationFromFirestore, pushItemOrderBatchToFirestore, pushAppSettingToFirestore, pushActivityLogToFirestore } from '../services/firestoreSync';
```

- [ ] **Step 5: Verify**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no new errors. In particular, confirm no caller of `logActivity` broke from its return-type change `void` → `string` (callers ignoring the return value compile fine either way).

Run: `npm test`
Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add apps/mobile/src/services/firestoreSync.ts apps/mobile/src/db/database.ts
git commit -m "feat(mobile): sync activityLogs to Firestore in real time"
```

---

## Task 5: Full verification pass

**Files:** none (verification only)

- [ ] **Step 1: Typecheck the whole mobile app**

Run: `cd apps/mobile && npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 2: Run the full existing test suite**

Run: `cd apps/mobile && npm test`
Expected: all tests pass (82 as of the last check in this session, likely more by execution time — confirm the count printed matches "0 fail").

- [ ] **Step 3: Manual multi-device verification**

Sign in on two devices/simulators as the same account. For each of the four newly-synced collections, perform one action on device A and confirm it appears on device B within a few seconds:
- Set a task's Area/Project relation on A → relation appears on B (`itemRelations`).
- Drag-reorder a list on A → same order appears on B (`itemOrder`).
- Change a setting that goes through `setAppSetting` (e.g. timer widget presentation preference) on A → reflected on B (`appSettings`).
- Log a medication dose and start its timer on A → dose + active timer state appear on B (`activityLogs`).

No code changes in this step — it's a manual sign-off that the four sync paths actually work end-to-end on-device, not just in the type system.

---

## What this plan does not do (by design)

- Does not build the web/Mac companion client — this plan only makes Firestore's data complete enough for that client to eventually read from, per the design doc's stated goal.
- Does not add automated tests for `firestoreSync.ts` or the sync-wiring in `db/database.ts`, matching the existing convention (the `items`/`itemInstances` sync this plan extends has none either).
