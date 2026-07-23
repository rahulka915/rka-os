import {
  addDoc,
  collection,
  deleteDoc,
  doc,
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

const MAX_SNAPSHOTS_PER_USER = 5;
const BACKUPS_COLLECTION = 'backups';

export interface BackupMeta {
  id: string;
  createdAt: string;
}

export async function pushBackup(userId: string): Promise<void> {
  if (!hasFirebaseConfig || !firestore) return;

  const payload = serializeBackup();
  const deviceId = getOrCreateDeviceId();

  await addDoc(collection(firestore, BACKUPS_COLLECTION), {
    userId,
    deviceId,
    payload,
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
