import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore, hasFirebaseConfig } from '../lib/firebase';
import { getDb } from '../db/database';
import { beginInitialSync, markInitialSyncListenerDone, resetSyncStatus } from './syncStatus';
import type { Item, ItemInstance, ItemRelationRow, ItemOrderRow, AppSettingRow, ActivityLog } from '../db/types';

// One entry per onSnapshot listener attached in startRealtimeSync — kept in
// sync with beginInitialSync's count so the header sync indicator clears
// exactly when every listener has delivered its first snapshot.
const SYNC_LISTENER_KEYS = ['items', 'itemInstances', 'itemRelations', 'itemOrder', 'appSettings', 'activityLogs'] as const;

let currentUserId: string | null = null;
let itemsUnsubscribe: Unsubscribe | null = null;
let instancesUnsubscribe: Unsubscribe | null = null;
let itemRelationsUnsubscribe: Unsubscribe | null = null;
let itemOrderUnsubscribe: Unsubscribe | null = null;
let appSettingsUnsubscribe: Unsubscribe | null = null;
let activityLogsUnsubscribe: Unsubscribe | null = null;
let isApplyingRemoteChange = false;
const LOCAL_BACKFILL_DELAY_MS = 10_000;

// Firestore's onSnapshot delivers the FULL existing collection as 'added'
// changes on first attach — which happens on every true cold start (a
// swipe-closed-then-reopened app re-runs the auth listener and re-attaches
// these from scratch; simply backgrounding/foregrounding keeps the same
// listeners subscribed, so this only refires on a genuine relaunch). Each
// listener below used to run one synchronous SQLite SELECT per changed doc
// just to read its local timestamp for the newer-wins comparison — for
// activityLogs especially (which only ever grows), a full-collection
// re-sync meant hundreds/thousands of synchronous native-bridge round trips
// blocking the JS thread right after cold launch. Batched into a single
// `WHERE id IN (...)` read per snapshot instead — same newer-wins
// comparison, same write path, just one read instead of N.
function loadLocalTimestamps(db: ReturnType<typeof getDb>, table: string, field: string, ids: string[], idColumn = 'id'): Map<string, number> {
  const timestamps = new Map<string, number>();
  const CHUNK = 500; // stay well under SQLite's bound-parameter limit
  for (let i = 0; i < ids.length; i += CHUNK) {
    const chunk = ids.slice(i, i + CHUNK);
    if (chunk.length === 0) continue;
    const placeholders = chunk.map(() => '?').join(',');
    const rows = db.getAllSync<{ key: string; ts: number }>(
      `SELECT ${idColumn} as key, ${field} as ts FROM ${table} WHERE ${idColumn} IN (${placeholders})`,
      chunk
    );
    for (const row of rows) timestamps.set(row.key, row.ts);
  }
  return timestamps;
}

// activityLogs is append-only and grows without bound, so re-downloading and
// re-applying the ENTIRE collection on every cold start (what a plain
// onSnapshot(collection) does on first attach) got heavier every day the user
// logged doses/habits/workouts — eventually the chunked re-apply loop was
// competing for the JS thread during the user's first taps (felt as FAB/nav
// lag). Instead we listen with a `where('createdAt', '>', watermark)` query so
// the first snapshot only carries genuinely-new rows; realtime additions
// (createdAt = now) still arrive. The watermark is device-LOCAL (stored via a
// key we never push to Firestore) so one device's progress never leaks to
// another. Tradeoff: a cross-device EDIT or DELETE of an OLD activityLog
// (createdAt <= watermark) won't propagate through this listener — acceptable
// for a mostly single-user app, and a full backup/restore still reconciles it.
const ACTIVITY_LOGS_WATERMARK_KEY = '_local.activityLogsSyncWatermark';

function getActivityLogsWatermark(db: ReturnType<typeof getDb>): number {
  const row = db.getAllSync<{ value: string }>(
    `SELECT value FROM appSettings WHERE key = ? LIMIT 1`,
    [ACTIVITY_LOGS_WATERMARK_KEY]
  )[0];
  if (row) {
    const parsed = Number(row.value);
    if (Number.isFinite(parsed)) return parsed;
  }
  // No stored watermark yet: seed from the local table's newest row, so a
  // device that already holds the full history starts cheap on the very first
  // post-fix launch instead of paying one more full-collection pass.
  const maxRow = db.getFirstSync<{ maxTs: number | null }>(
    `SELECT MAX(createdAt) as maxTs FROM activityLogs`
  );
  return maxRow?.maxTs ?? 0;
}

function setActivityLogsWatermark(db: ReturnType<typeof getDb>, ts: number): void {
  // Written directly (not via database.ts's setAppSetting) precisely so it is
  // NOT pushed to Firestore — this value must stay device-local.
  db.runSync(
    `INSERT INTO appSettings (key, value, updatedAt) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
    [ACTIVITY_LOGS_WATERMARK_KEY, String(ts), Date.now()]
  );
}

interface SyncDocChange {
  type: string;
  doc: { id: string; data: () => any };
}

interface ChunkedApplyOptions {
  changes: readonly SyncDocChange[];
  // Omit table/tsField/idOf for tables with no newer-wins timestamp check
  // (e.g. itemOrder) — applyChange then just always writes.
  table?: string;
  tsField?: string;
  idColumn?: string;
  idOf?: (change: SyncDocChange) => string | undefined;
  applyChange: (change: SyncDocChange, localTs: number | undefined) => boolean;
  onLocalChange?: () => void;
  onComplete: () => void;
}

// A single onSnapshot can deliver an entire subcollection at once (thousands
// of docs on a cold-start full sync). Applying them all inside one
// withTransactionSync blocked the JS thread for 150-330ms per listener — the
// exact multi-frame freeze the __DEV__ db-perf guardrail caught, felt as the
// app hanging a couple seconds after open. This applies the changes in small
// chunks, each in its own short transaction. A first pass yielded via
// setTimeout(16) between chunks, but that only yields the JS event loop —
// it doesn't wait for a paint, so under load (e.g. right as the deferred
// sync kicks in during the user's first interactions) chunks could still
// run back-to-back with no frame actually rendering in between, felt as
// sustained stutter rather than one-off jank. requestAnimationFrame instead
// guarantees a paint has happened before the next chunk starts, and the
// smaller chunk size keeps each transaction's own blocking time closer to
// a single frame budget. onComplete always runs once fully drained (drives
// the header sync indicator via markFirst); onLocalChange runs once at the
// end, only if something was actually written.
function applyDocChangesInChunks(opts: ChunkedApplyOptions): void {
  const { changes } = opts;
  if (changes.length === 0) {
    opts.onComplete();
    return;
  }
  const db = getDb();
  const CHUNK = 5;
  let index = 0;
  let mutatedOverall = false;

  const step = () => {
    const slice = changes.slice(index, index + CHUNK);
    index += CHUNK;

    let localTimestamps = new Map<string, number>();
    if (opts.table && opts.tsField && opts.idOf) {
      const ids = slice
        .filter((c) => c.type === 'added' || c.type === 'modified')
        .map((c) => opts.idOf!(c))
        .filter((id): id is string => id !== undefined);
      localTimestamps = loadLocalTimestamps(db, opts.table, opts.tsField, ids, opts.idColumn);
    }

    isApplyingRemoteChange = true;
    try {
      db.withTransactionSync(() => {
        for (const change of slice) {
          const id = opts.idOf?.(change);
          const localTs = id !== undefined ? localTimestamps.get(id) : undefined;
          if (opts.applyChange(change, localTs)) mutatedOverall = true;
        }
      });
    } catch (err) {
      console.warn(`[firestoreSync] chunk apply error (${opts.table ?? 'itemOrder'}):`, err);
    } finally {
      isApplyingRemoteChange = false;
    }

    if (index < changes.length) {
      requestAnimationFrame(step);
    } else {
      if (mutatedOverall) opts.onLocalChange?.();
      opts.onComplete();
    }
  };

  step();
}

// Remove undefined values because Firestore errors on undefined fields
function sanitizeForFirestore<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) {
      clean[key] = obj[key];
    }
  }
  return clean;
}

/**
 * Pushes a single item to Firestore for the active user.
 */
export async function pushItemToFirestore(userId: string, item: Item): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const itemRef = doc(firestore, 'users', userId, 'items', item.id);
    await setDoc(itemRef, sanitizeForFirestore({ ...item, userId }), { merge: true });
  } catch (err) {
    console.warn('[firestoreSync] pushItem error:', err);
  }
}

/**
 * Pushes a single item instance to Firestore for the active user.
 */
export async function pushInstanceToFirestore(userId: string, instance: ItemInstance): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const instRef = doc(firestore, 'users', userId, 'itemInstances', instance.id);
    await setDoc(instRef, sanitizeForFirestore(instance), { merge: true });
  } catch (err) {
    console.warn('[firestoreSync] pushInstance error:', err);
  }
}

/**
 * Deletes an item from Firestore.
 */
export async function deleteItemFromFirestore(userId: string, itemId: string): Promise<void> {
  if (!hasFirebaseConfig || !firestore || !userId || isApplyingRemoteChange) return;

  try {
    const itemRef = doc(firestore, 'users', userId, 'items', itemId);
    await deleteDoc(itemRef);
  } catch (err) {
    console.warn('[firestoreSync] deleteItem error:', err);
  }
}

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
  const firestoreDb = firestore;

  try {
    const batch = writeBatch(firestoreDb);
    const existingSnapshot = await getDocs(
      query(collection(firestoreDb, 'users', userId, 'itemOrder'), where('listKey', '==', listKey))
    );
    existingSnapshot.docs.forEach((d) => batch.delete(d.ref));
    orderedIds.forEach((itemId, position) => {
      const docId = `${listKey}__${itemId}`;
      batch.set(doc(firestoreDb, 'users', userId, 'itemOrder', docId), { listKey, itemId, position });
    });
    await batch.commit();
  } catch (err) {
    console.warn('[firestoreSync] pushItemOrderBatch error:', err);
  }
}

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

// startRealtimeSync only pushes local changes going forward (via the create/update
// wrappers in database.ts calling syncItemToRemote) and pulls remote changes via
// onSnapshot — it never pushes pre-existing local rows. Any item/instance/relation
// created before real-time sync was wired up (or before the Firestore rules
// permitted these collections) is stuck local-only forever unless something
// pushes it once. This reconciliation runs off the remote state a listener has
// ALREADY delivered in its first snapshot (see the listeners below), so it never
// issues its own getDocs — the previous standalone backfill re-downloaded every
// collection on every cold start (~23s of redundant network for typically zero
// pushes, on top of the identical download the listeners were doing anyway).
//
// `remoteVersion` maps remote id -> its version (updatedAt); a missing id means the
// row isn't remote at all. For existence-only tables (itemRelations) pass
// `existenceOnly` so a row already present remotely is never re-pushed. Pushes are
// sequenced one-at-a-time off the JS critical path (setTimeout between each) so a
// large reconciliation can't saturate Firestore's write queue — the exact
// "Write stream exhausted maximum allowed queued writes" failure the old
// fire-everything-at-once path produced.
function pushLocalOnlyRows<T extends { id: string; updatedAt?: number }>(
  userId: string,
  remoteVersion: Map<string, number>,
  table: string,
  existenceOnly: boolean,
  push: (userId: string, row: T) => Promise<void>
): void {
  let pendingIds: string[];
  try {
    const localVersions = existenceOnly
      ? getDb().getAllSync<{ id: string }>(`SELECT id FROM ${table}`)
      : getDb().getAllSync<{ id: string; updatedAt: number }>(`SELECT id, updatedAt FROM ${table}`);
    pendingIds = localVersions.filter((row) => {
      const remoteAt = remoteVersion.get(row.id);
      if (remoteAt === undefined) return true;
      return existenceOnly ? false : ((row as { updatedAt?: number }).updatedAt ?? 0) > remoteAt;
    }).map((row) => row.id);
  } catch (err) {
    console.warn(`[firestoreSync] ${table} backfill scan error:`, err);
    return;
  }
  if (pendingIds.length === 0) return;

  let pending: T[];
  try {
    const placeholders = pendingIds.map(() => '?').join(',');
    pending = getDb().getAllSync<T>(`SELECT * FROM ${table} WHERE id IN (${placeholders})`, pendingIds);
  } catch (err) {
    console.warn(`[firestoreSync] ${table} backfill row load error:`, err);
    return;
  }
  if (pending.length === 0) return;

  let i = 0;
  const step = () => {
    const row = pending[i++];
    if (!row) return;
    push(userId, row).finally(() => setTimeout(step, 0));
  };
  setTimeout(step, 0);
}

function scheduleLocalOnlyRows<T extends { id: string; updatedAt?: number }>(
  userId: string,
  remoteVersion: Map<string, number>,
  table: string,
  existenceOnly: boolean,
  push: (userId: string, row: T) => Promise<void>
): void {
  setTimeout(() => {
    if (currentUserId !== userId) return;
    pushLocalOnlyRows<T>(userId, remoteVersion, table, existenceOnly, push);
  }, LOCAL_BACKFILL_DELAY_MS);
}

// Builds an id -> version map from a listener's first snapshot, which contains the
// full remote collection. `versionOf` reads the field newer-wins compares against
// (updatedAt); existence-only tables ignore the value.
//
// NOT used on the cold-start path anymore — see the callers below. Walking
// `snapshot.docs` calls `.data()` on every doc, which forces Firestore's
// proto->JS deserialization synchronously, for the ENTIRE collection, in one
// unyielded pass outside any of applyDocChangesInChunks' chunking. On a large
// `items`/`itemInstances`/`itemRelations` collection that alone could block
// the JS thread for seconds with no accompanying [db-perf] warning (it never
// touches SQLite) — taps doing nothing while the screen looks completely
// normal. Kept only as a helper if a genuinely eager full-collection map is
// ever needed again; the listeners below accumulate the same map instead
// from inside their already-chunked applyChange callback.
function buildRemoteVersionMap(snapshot: { docs: { id: string; data: () => any }[] }, versionOf: (data: any) => number): Map<string, number> {
  const map = new Map<string, number>();
  for (const docSnap of snapshot.docs) map.set(docSnap.id, versionOf(docSnap.data()));
  return map;
}

/**
 * Starts real-time Firestore listeners for items and instances.
 * Whenever a remote change arrives, local SQLite is updated if the remote timestamp is newer.
 */
export function startRealtimeSync(userId: string, onLocalChange?: () => void): Unsubscribe {
  if (!hasFirebaseConfig || !firestore || !userId) {
    return () => {};
  }

  stopRealtimeSync();
  currentUserId = userId;

  // Drive the header's subtle sync indicator: "syncing" until every listener
  // below has delivered its first snapshot (markFirst), then idle.
  beginInitialSync(SYNC_LISTENER_KEYS.length);
  const firstSnapshotSeen = new Set<string>();
  const markFirst = (key: (typeof SYNC_LISTENER_KEYS)[number]) => {
    if (firstSnapshotSeen.has(key)) return;
    firstSnapshotSeen.add(key);
    markInitialSyncListenerDone();
  };

  const db = getDb();

  // Reconcile pre-existing local-only rows up to Firestore exactly once, reusing
  // the full remote collection each listener already delivers in its first
  // snapshot (see pushLocalOnlyRows) rather than issuing a separate full download.
  const backfilledTables = new Set<string>();

  // Every listener below applies its snapshot in chunks (applyDocChangesInChunks)
  // so a full-collection cold-start sync can never block the JS thread for more
  // than one short transaction at a time.

  // Listen to remote items subcollection
  const itemsRef = collection(firestore, 'users', userId, 'items');
  itemsUnsubscribe = onSnapshot(
    itemsRef,
    (snapshot) => {
      const buildingBackfill = !backfilledTables.has('items');
      const remoteVersionAcc = buildingBackfill ? new Map<string, number>() : null;
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        table: 'items', tsField: 'updatedAt', idOf: (c) => c.doc.id,
        applyChange: (change, localUpdatedAt) => {
          const remote = change.doc.data() as Item;
          if (!remote.id) return false;
          remoteVersionAcc?.set(remote.id, remote.updatedAt ?? 0);
          if (change.type === 'added' || change.type === 'modified') {
            if (localUpdatedAt === undefined || (remote.updatedAt && remote.updatedAt > localUpdatedAt)) {
              db.runSync(
                `INSERT OR REPLACE INTO items (id, type, title, status, notes, voice_transcript, scheduledDate, dueDate, rrule, metadata, createdAt, updatedAt, userId, archivedAt, deletedAt, completedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  remote.id,
                  remote.type ?? 'task',
                  remote.title ?? '',
                  remote.status ?? 'active',
                  remote.notes ?? null,
                  remote.voice_transcript ?? null,
                  remote.scheduledDate ?? null,
                  remote.dueDate ?? null,
                  remote.rrule ?? null,
                  remote.metadata ?? null,
                  remote.createdAt ?? Date.now(),
                  remote.updatedAt ?? Date.now(),
                  userId,
                  remote.archivedAt ?? null,
                  remote.deletedAt ?? null,
                  remote.completedAt ?? null,
                ]
              );
              return true;
            }
            return false;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM items WHERE id = ?`, [remote.id]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => {
          markFirst('items');
          if (remoteVersionAcc) {
            backfilledTables.add('items');
            scheduleLocalOnlyRows<Item>(userId, remoteVersionAcc, 'items', false, pushItemToFirestore);
          }
        },
      });
    },
    (error) => {
      console.warn('[firestoreSync] items listener error:', error);
    }
  );

  // Listen to remote itemInstances subcollection
  const instancesRef = collection(firestore, 'users', userId, 'itemInstances');
  instancesUnsubscribe = onSnapshot(
    instancesRef,
    (snapshot) => {
      const buildingBackfill = !backfilledTables.has('itemInstances');
      const remoteVersionAcc = buildingBackfill ? new Map<string, number>() : null;
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        table: 'itemInstances', tsField: 'updatedAt', idOf: (c) => c.doc.id,
        applyChange: (change, localUpdatedAt) => {
          const remote = change.doc.data() as ItemInstance;
          if (!remote.id) return false;
          remoteVersionAcc?.set(remote.id, remote.updatedAt ?? 0);
          if (change.type === 'added' || change.type === 'modified') {
            if (localUpdatedAt === undefined || (remote.updatedAt && remote.updatedAt > localUpdatedAt)) {
              db.runSync(
                `INSERT OR REPLACE INTO itemInstances (id, itemId, scheduledDate, completedAt, status, instanceMetadata, createdAt, updatedAt)
                 VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                  remote.id,
                  remote.itemId,
                  remote.scheduledDate,
                  remote.completedAt ?? null,
                  remote.status ?? 'pending',
                  remote.instanceMetadata ?? null,
                  remote.createdAt ?? Date.now(),
                  remote.updatedAt ?? Date.now(),
                ]
              );
              return true;
            }
            return false;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM itemInstances WHERE id = ?`, [remote.id]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => {
          markFirst('itemInstances');
          if (remoteVersionAcc) {
            backfilledTables.add('itemInstances');
            scheduleLocalOnlyRows<ItemInstance>(userId, remoteVersionAcc, 'itemInstances', false, pushInstanceToFirestore);
          }
        },
      });
    },
    (error) => {
      console.warn('[firestoreSync] instances listener error:', error);
    }
  );

  // Listen to remote itemRelations subcollection
  const itemRelationsRef = collection(firestore, 'users', userId, 'itemRelations');
  itemRelationsUnsubscribe = onSnapshot(
    itemRelationsRef,
    (snapshot) => {
      const buildingBackfill = !backfilledTables.has('itemRelations');
      const remoteVersionAcc = buildingBackfill ? new Map<string, number>() : null;
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        table: 'itemRelations', tsField: 'createdAt', idOf: (c) => c.doc.id,
        applyChange: (change, localCreatedAt) => {
          const remote = change.doc.data() as ItemRelationRow;
          if (!remote.id) return false;
          remoteVersionAcc?.set(remote.id, 0);
          if (change.type === 'added' || change.type === 'modified') {
            if (localCreatedAt === undefined || (remote.createdAt && remote.createdAt >= localCreatedAt)) {
              db.runSync(
                `INSERT OR REPLACE INTO itemRelations (id, sourceId, targetId, relationType, createdAt)
                 VALUES (?, ?, ?, ?, ?)`,
                [remote.id, remote.sourceId, remote.targetId, remote.relationType, remote.createdAt ?? Date.now()]
              );
              return true;
            }
            return false;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM itemRelations WHERE id = ?`, [remote.id]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => {
          markFirst('itemRelations');
          if (remoteVersionAcc) {
            backfilledTables.add('itemRelations');
            scheduleLocalOnlyRows<ItemRelationRow>(userId, remoteVersionAcc, 'itemRelations', true, pushItemRelationToFirestore);
          }
        },
      });
    },
    (error) => {
      console.warn('[firestoreSync] itemRelations listener error:', error);
    }
  );

  // Listen to remote itemOrder subcollection (no newer-wins timestamp — always overwrite)
  const itemOrderRef = collection(firestore, 'users', userId, 'itemOrder');
  itemOrderUnsubscribe = onSnapshot(
    itemOrderRef,
    (snapshot) => {
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        applyChange: (change) => {
          const remote = change.doc.data() as ItemOrderRow;
          if (!remote.listKey || !remote.itemId) return false;
          if (change.type === 'added' || change.type === 'modified') {
            db.runSync(
              `INSERT OR REPLACE INTO itemOrder (listKey, itemId, position) VALUES (?, ?, ?)`,
              [remote.listKey, remote.itemId, remote.position]
            );
            return true;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM itemOrder WHERE listKey = ? AND itemId = ?`, [remote.listKey, remote.itemId]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => markFirst('itemOrder'),
      });
    },
    (error) => {
      console.warn('[firestoreSync] itemOrder listener error:', error);
    }
  );

  // Listen to remote appSettings subcollection (keyed by `key`, not `id`)
  const appSettingsRef = collection(firestore, 'users', userId, 'appSettings');
  appSettingsUnsubscribe = onSnapshot(
    appSettingsRef,
    (snapshot) => {
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        table: 'appSettings', tsField: 'updatedAt', idColumn: 'key',
        idOf: (c) => (c.doc.data() as AppSettingRow).key,
        applyChange: (change, localUpdatedAt) => {
          const remote = change.doc.data() as AppSettingRow;
          if (!remote.key) return false;
          if (change.type === 'added' || change.type === 'modified') {
            if (localUpdatedAt === undefined || (remote.updatedAt && remote.updatedAt > localUpdatedAt)) {
              db.runSync(
                `INSERT INTO appSettings (key, value, updatedAt)
                 VALUES (?, ?, ?)
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt`,
                [remote.key, remote.value, remote.updatedAt ?? Date.now()]
              );
              return true;
            }
            return false;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM appSettings WHERE key = ?`, [remote.key]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => markFirst('appSettings'),
      });
    },
    (error) => {
      console.warn('[firestoreSync] appSettings listener error:', error);
    }
  );

  // Listen to remote activityLogs (append-only, grows unbounded) with a
  // device-local watermark so cold start only pulls rows newer than the last
  // launch instead of the whole history — see getActivityLogsWatermark above.
  const activityLogsWatermark = getActivityLogsWatermark(db);
  let maxActivityLogCreatedAt = activityLogsWatermark;
  const activityLogsRef = collection(firestore, 'users', userId, 'activityLogs');
  activityLogsUnsubscribe = onSnapshot(
    query(activityLogsRef, where('createdAt', '>', activityLogsWatermark)),
    (snapshot) => {
      applyDocChangesInChunks({
        changes: snapshot.docChanges(),
        table: 'activityLogs', tsField: 'createdAt', idOf: (c) => c.doc.id,
        applyChange: (change, localCreatedAt) => {
          const remote = change.doc.data() as ActivityLog;
          if (!remote.id) return false;
          if (change.type === 'added' || change.type === 'modified') {
            if (remote.createdAt && remote.createdAt > maxActivityLogCreatedAt) {
              maxActivityLogCreatedAt = remote.createdAt;
            }
            if (localCreatedAt === undefined || (remote.createdAt && remote.createdAt >= localCreatedAt)) {
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
              return true;
            }
            return false;
          }
          if (change.type === 'removed') {
            db.runSync(`DELETE FROM activityLogs WHERE id = ?`, [remote.id]);
            return true;
          }
          return false;
        },
        onLocalChange,
        onComplete: () => {
          markFirst('activityLogs');
          if (maxActivityLogCreatedAt > activityLogsWatermark) {
            setActivityLogsWatermark(db, maxActivityLogCreatedAt);
          }
        },
      });
    },
    (error) => {
      console.warn('[firestoreSync] activityLogs listener error:', error);
    }
  );

  return stopRealtimeSync;
}

/**
 * Stops real-time Firestore sync listeners.
 */
export function stopRealtimeSync(): void {
  if (itemsUnsubscribe) {
    itemsUnsubscribe();
    itemsUnsubscribe = null;
  }
  if (instancesUnsubscribe) {
    instancesUnsubscribe();
    instancesUnsubscribe = null;
  }
  if (itemRelationsUnsubscribe) {
    itemRelationsUnsubscribe();
    itemRelationsUnsubscribe = null;
  }
  if (itemOrderUnsubscribe) {
    itemOrderUnsubscribe();
    itemOrderUnsubscribe = null;
  }
  if (appSettingsUnsubscribe) {
    appSettingsUnsubscribe();
    appSettingsUnsubscribe = null;
  }
  if (activityLogsUnsubscribe) {
    activityLogsUnsubscribe();
    activityLogsUnsubscribe = null;
  }
  currentUserId = null;
  resetSyncStatus();
}

export function getCurrentSyncUserId(): string | null {
  return currentUserId;
}
