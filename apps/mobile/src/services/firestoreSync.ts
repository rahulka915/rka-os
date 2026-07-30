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
import { getDb, getItemById } from '../db/database';
import type { Item, ItemInstance, ItemRelationRow, ItemOrderRow, AppSettingRow } from '../db/types';

let currentUserId: string | null = null;
let itemsUnsubscribe: Unsubscribe | null = null;
let instancesUnsubscribe: Unsubscribe | null = null;
let itemRelationsUnsubscribe: Unsubscribe | null = null;
let itemOrderUnsubscribe: Unsubscribe | null = null;
let appSettingsUnsubscribe: Unsubscribe | null = null;
let isApplyingRemoteChange = false;

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
 * Starts real-time Firestore listeners for items and instances.
 * Whenever a remote change arrives, local SQLite is updated if the remote timestamp is newer.
 */
export function startRealtimeSync(userId: string, onLocalChange?: () => void): Unsubscribe {
  if (!hasFirebaseConfig || !firestore || !userId) {
    return () => {};
  }

  stopRealtimeSync();
  currentUserId = userId;

  const db = getDb();

  // Listen to remote items subcollection
  const itemsRef = collection(firestore, 'users', userId, 'items');
  itemsUnsubscribe = onSnapshot(
    itemsRef,
    (snapshot) => {
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as Item;
            if (!remote.id) return;

            if (change.type === 'added' || change.type === 'modified') {
              const local = getItemById(remote.id);

              // Only update if remote is newer or doesn't exist locally
              if (!local || (remote.updatedAt && remote.updatedAt > local.updatedAt)) {
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
                hasMutatedLocal = true;
              }
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM items WHERE id = ?`, [remote.id]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local SQLite apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
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
      isApplyingRemoteChange = true;
      let hasMutatedLocal = false;

      try {
        db.withTransactionSync(() => {
          snapshot.docChanges().forEach((change) => {
            const remote = change.doc.data() as ItemInstance;
            if (!remote.id) return;

            if (change.type === 'added' || change.type === 'modified') {
              const localRows = db.getAllSync<{ updatedAt: number }>(
                `SELECT updatedAt FROM itemInstances WHERE id = ?`,
                [remote.id]
              );
              const local = localRows[0];

              if (!local || (remote.updatedAt && remote.updatedAt > local.updatedAt)) {
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
                hasMutatedLocal = true;
              }
            } else if (change.type === 'removed') {
              db.runSync(`DELETE FROM itemInstances WHERE id = ?`, [remote.id]);
              hasMutatedLocal = true;
            }
          });
        });
      } catch (err) {
        console.warn('[firestoreSync] local instances apply error:', err);
      } finally {
        isApplyingRemoteChange = false;
      }

      if (hasMutatedLocal && onLocalChange) {
        onLocalChange();
      }
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
  currentUserId = null;
}

export function getCurrentSyncUserId(): string | null {
  return currentUserId;
}
