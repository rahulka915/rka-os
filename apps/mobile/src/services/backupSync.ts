import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  serverTimestamp,
  Timestamp,
  where,
} from 'firebase/firestore';
import { firestore, hasFirebaseConfig } from '../lib/firebase';
import { serializeBackup, getOrCreateDeviceId, type BackupPayload } from '../db/backup';

const MAX_SNAPSHOTS_PER_USER = 20;
const BACKUPS_COLLECTION = 'backups';
// Below this fraction of the previous snapshot's item count, a push looks like
// accidental data loss (e.g. a fresh install syncing an empty local DB) rather
// than a real shrink — see the 2026-07-24 incident where this rolled a real
// backup out of the retention window before anyone noticed.
const SHRINK_GUARD_RATIO = 0.5;

export interface BackupMeta {
  id: string;
  createdAt: string;
}

export class BackupShrinkGuardError extends Error {
  constructor(public previousCount: number, public newCount: number) {
    super(
      `New backup has ${newCount} item(s), down from ${previousCount} in the last backup. Refusing to push without confirmation.`
    );
    this.name = 'BackupShrinkGuardError';
  }
}

export async function pushBackup(userId: string, options?: { force?: boolean }): Promise<void> {
  if (!hasFirebaseConfig || !firestore) return;

  const payload = serializeBackup();
  const itemCount = payload.items.length;
  const deviceId = getOrCreateDeviceId();

  if (!options?.force) {
    const latest = await listBackups(userId);
    const previousCount = latest[0]?.itemCount ?? 0;
    if (previousCount > 0 && itemCount < previousCount * SHRINK_GUARD_RATIO) {
      throw new BackupShrinkGuardError(previousCount, itemCount);
    }
  }

  await addDoc(collection(firestore, BACKUPS_COLLECTION), {
    userId,
    deviceId,
    payload,
    itemCount,
    createdAt: serverTimestamp(),
  });

  await pruneOldBackups(userId);
}

async function pruneOldBackups(userId: string): Promise<void> {
  if (!firestore) return;

  const snapshot = await getDocs(
    query(
      collection(firestore, BACKUPS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
  );

  const toDelete = snapshot.docs.slice(MAX_SNAPSHOTS_PER_USER);
  if (toDelete.length === 0) return;

  await Promise.all(toDelete.map((d) => deleteDoc(doc(firestore!, BACKUPS_COLLECTION, d.id))));
}

export async function getLatestBackupMeta(userId: string): Promise<BackupMeta | null> {
  if (!hasFirebaseConfig || !firestore) return null;

  const snapshot = await getDocs(
    query(
      collection(firestore, BACKUPS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
  );
  if (snapshot.empty) return null;

  const first = snapshot.docs[0];
  const createdAt = first.get('createdAt') as Timestamp | null;
  return { id: first.id, createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString() };
}

export async function fetchLatestBackupPayload(userId: string): Promise<BackupPayload | null> {
  if (!hasFirebaseConfig || !firestore) return null;

  const snapshot = await getDocs(
    query(
      collection(firestore, BACKUPS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc'),
      limit(1)
    )
  );
  if (snapshot.empty) return null;

  return snapshot.docs[0].get('payload') as BackupPayload;
}

export interface BackupListEntry extends BackupMeta {
  itemCount: number;
}

export async function listBackups(userId: string): Promise<BackupListEntry[]> {
  if (!hasFirebaseConfig || !firestore) return [];

  const snapshot = await getDocs(
    query(
      collection(firestore, BACKUPS_COLLECTION),
      where('userId', '==', userId),
      orderBy('createdAt', 'desc')
    )
  );

  return snapshot.docs.map((d) => {
    const createdAt = d.get('createdAt') as Timestamp | null;
    const storedCount = d.get('itemCount') as number | undefined;
    const payload = d.get('payload') as BackupPayload | undefined;
    return {
      id: d.id,
      createdAt: createdAt ? createdAt.toDate().toISOString() : new Date().toISOString(),
      itemCount: storedCount ?? payload?.items.length ?? 0,
    };
  });
}

export async function fetchBackupPayload(backupId: string): Promise<BackupPayload | null> {
  if (!hasFirebaseConfig || !firestore) return null;

  const snap = await getDoc(doc(firestore, BACKUPS_COLLECTION, backupId));
  if (!snap.exists()) return null;

  return snap.get('payload') as BackupPayload;
}
