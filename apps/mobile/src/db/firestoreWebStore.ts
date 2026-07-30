import {
  collection,
  doc,
  onSnapshot,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  getDocs,
  query,
  where,
  type Unsubscribe,
} from 'firebase/firestore';
import { firestore } from '../lib/firebase';
import type { Item, ItemInstance, ActivityLog, ItemRelationRow, ItemOrderRow } from './types';

// The web build has no local SQLite. Instead, one onSnapshot listener per
// collection mirrors Firestore into memory, and database.web.ts's query
// functions are plain filters over these arrays — a mechanical port of the
// SQL predicates in database.ts. Writes go straight to Firestore; the listener
// echoes them back, so no local mutation bookkeeping is needed.

interface StoreState {
  items: Item[];
  itemInstances: ItemInstance[];
  itemRelations: ItemRelationRow[];
  itemOrder: ItemOrderRow[];
  activityLogs: ActivityLog[];
}

const EMPTY_STATE: StoreState = {
  items: [],
  itemInstances: [],
  itemRelations: [],
  itemOrder: [],
  activityLogs: [],
};

let uid: string | null = null;
let state: StoreState = EMPTY_STATE;
let unsubscribers: Unsubscribe[] = [];
const listeners = new Set<() => void>();

function requireFirestore() {
  if (!firestore) throw new Error('Firestore is not configured — check EXPO_PUBLIC_FIREBASE_* env vars');
  return firestore;
}

function requireUid(): string {
  if (!uid) throw new Error('Web store not started — call startWebStore(userId) after sign-in');
  return uid;
}

function notify(): void {
  for (const listener of listeners) listener();
}

export function subscribeToWebStoreChanges(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function startWebStore(userId: string): void {
  if (uid === userId) return;
  stopWebStore();
  uid = userId;
  const db = requireFirestore();

  const watch = <K extends keyof StoreState>(name: K) => {
    unsubscribers.push(
      onSnapshot(
        collection(db, 'users', userId, name),
        (snap) => {
          state = { ...state, [name]: snap.docs.map((d) => d.data()) } as StoreState;
          notify();
        },
        (error) => {
          console.warn(`[firestoreWebStore] ${name} listener error:`, error);
        }
      )
    );
  };

  watch('items');
  watch('itemInstances');
  watch('itemRelations');
  watch('itemOrder');
  watch('activityLogs');
}

export function stopWebStore(): void {
  unsubscribers.forEach((unsub) => unsub());
  unsubscribers = [];
  uid = null;
  state = EMPTY_STATE;
}

export function getItemsSnapshot(): Item[] {
  return state.items;
}
export function getItemInstancesSnapshot(): ItemInstance[] {
  return state.itemInstances;
}
export function getItemRelationsSnapshot(): ItemRelationRow[] {
  return state.itemRelations;
}
export function getItemOrderSnapshot(): ItemOrderRow[] {
  return state.itemOrder;
}
export function getActivityLogsSnapshot(): ActivityLog[] {
  return state.activityLogs;
}

// Firestore rejects undefined field values outright, so they're stripped rather
// than written as nulls — an absent field and a null one read back differently
// (see the `deletedAt IS NULL` style predicates ported in database.web.ts).
function sanitize<T extends Record<string, any>>(obj: T): Record<string, any> {
  const clean: Record<string, any> = {};
  for (const key of Object.keys(obj)) {
    if (obj[key] !== undefined) clean[key] = obj[key];
  }
  return clean;
}

export async function putItem(item: Item): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'items', item.id), sanitize(item));
}

// Deliberately looser than Partial<Item>: callers pass deleteField() sentinels
// to clear optional fields, which is how "set this column to NULL" in
// database.ts maps onto Firestore.
export async function patchItem(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = requireFirestore();
  await updateDoc(doc(db, 'users', requireUid(), 'items', id), sanitize(patch));
}

export async function putItemInstance(instance: ItemInstance): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'itemInstances', instance.id), sanitize(instance));
}

export async function deleteItemInstanceDoc(id: string): Promise<void> {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'users', requireUid(), 'itemInstances', id));
}

// Mirrors `DELETE FROM itemInstances WHERE itemId = ? AND status = 'pending'`.
// Reads the ids off the mirror rather than querying, since the listener already
// holds every instance for this user.
export async function deletePendingInstancesForItem(itemId: string): Promise<void> {
  const db = requireFirestore();
  const userId = requireUid();
  const pending = state.itemInstances.filter((i) => i.itemId === itemId && i.status === 'pending');
  if (pending.length === 0) return;
  const batch = writeBatch(db);
  pending.forEach((instance) => {
    batch.delete(doc(db, 'users', userId, 'itemInstances', instance.id));
  });
  await batch.commit();
}

export async function putItemRelation(row: ItemRelationRow): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'itemRelations', row.id), sanitize(row));
}

export async function deleteItemRelationDoc(sourceId: string, relationType: string): Promise<void> {
  const db = requireFirestore();
  const existing = state.itemRelations.find((r) => r.sourceId === sourceId && r.relationType === relationType);
  if (!existing) return;
  await deleteDoc(doc(db, 'users', requireUid(), 'itemRelations', existing.id));
}

// Mirrors setManualOrder's delete-then-reinsert: a drag produces the whole
// final ordering client-side, so the listKey's rows are replaced wholesale
// rather than diffed.
export async function replaceItemOrder(listKey: string, orderedIds: string[]): Promise<void> {
  const db = requireFirestore();
  const userId = requireUid();
  const batch = writeBatch(db);
  const existing = await getDocs(
    query(collection(db, 'users', userId, 'itemOrder'), where('listKey', '==', listKey))
  );
  existing.docs.forEach((d) => batch.delete(d.ref));
  orderedIds.forEach((itemId, position) => {
    batch.set(doc(db, 'users', userId, 'itemOrder', `${listKey}__${itemId}`), { listKey, itemId, position });
  });
  await batch.commit();
}

export async function putActivityLogDoc(log: ActivityLog): Promise<void> {
  const db = requireFirestore();
  await setDoc(doc(db, 'users', requireUid(), 'activityLogs', log.id), sanitize(log));
}

export async function patchActivityLogDoc(id: string, patch: Record<string, unknown>): Promise<void> {
  const db = requireFirestore();
  await updateDoc(doc(db, 'users', requireUid(), 'activityLogs', id), sanitize(patch));
}

export async function deleteActivityLogDoc(id: string): Promise<void> {
  const db = requireFirestore();
  await deleteDoc(doc(db, 'users', requireUid(), 'activityLogs', id));
}
