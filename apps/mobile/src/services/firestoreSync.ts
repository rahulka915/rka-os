import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  deleteDoc,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore, hasFirebaseConfig } from '../lib/firebase';
import { getDb, getItemById } from '../db/database';
import type { Item, ItemInstance } from '../db/types';

let currentUserId: string | null = null;
let itemsUnsubscribe: Unsubscribe | null = null;
let instancesUnsubscribe: Unsubscribe | null = null;
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
  currentUserId = null;
}

export function getCurrentSyncUserId(): string | null {
  return currentUserId;
}
