import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth';
import { auth, hasFirebaseConfig } from '../lib/firebase';
import {
  pushBackup,
  getLatestBackupMeta,
  fetchLatestBackupPayload,
  listBackups,
  fetchBackupPayload,
  type BackupListEntry,
} from '../services/backupSync';
import { startRealtimeSync, stopRealtimeSync } from '../services/firestoreSync';
import { restoreBackup } from '../db/backup';

function useBackupState() {
  const [user, setUser] = useState<User | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refreshLastBackup = useCallback(async (userId: string) => {
    const meta = await getLatestBackupMeta(userId);
    setLastBackupAt(meta?.createdAt ?? null);
  }, []);

  useEffect(() => {
    if (!hasFirebaseConfig || !auth) return;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (nextUser) {
        refreshLastBackup(nextUser.uid);
        startRealtimeSync(nextUser.uid);
      } else {
        stopRealtimeSync();
        setLastBackupAt(null);
      }
    });

    return () => {
      unsubscribe();
      stopRealtimeSync();
    };
  }, [refreshLastBackup]);

  const backUpNow = useCallback(async (options?: { force?: boolean }) => {
    if (!user || busy) return;
    setBusy(true);
    setError(null);
    try {
      await pushBackup(user.uid, options);
      await refreshLastBackup(user.uid);
    } catch (err) {
      console.warn('[backup] push failed', err);
      setError(err instanceof Error ? err.message : 'Backup failed');
      throw err;
    } finally {
      setBusy(false);
    }
  }, [user, busy, refreshLastBackup]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured');
    setBusy(true);
    try {
      const credential = await signInWithEmailAndPassword(auth, email, password);
      await refreshLastBackup(credential.user.uid);
    } finally {
      setBusy(false);
    }
  }, [refreshLastBackup]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase is not configured');
    setBusy(true);
    try {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      await refreshLastBackup(credential.user.uid);
    } finally {
      setBusy(false);
    }
  }, [refreshLastBackup]);

  const signOut = useCallback(async () => {
    if (!auth) return;
    await firebaseSignOut(auth);
  }, []);

  const restoreLatest = useCallback(async (): Promise<boolean> => {
    if (!user) return false;
    setBusy(true);
    try {
      const payload = await fetchLatestBackupPayload(user.uid);
      if (!payload) return false;
      restoreBackup(payload);
      return true;
    } finally {
      setBusy(false);
    }
  }, [user]);

  const listAllBackups = useCallback(async (): Promise<BackupListEntry[]> => {
    if (!user) return [];
    return listBackups(user.uid);
  }, [user]);

  const restoreBackupById = useCallback(async (backupId: string): Promise<boolean> => {
    if (!user) return false;
    setBusy(true);
    try {
      const payload = await fetchBackupPayload(backupId);
      if (!payload) return false;
      restoreBackup(payload);
      return true;
    } finally {
      setBusy(false);
    }
  }, [user]);

  return {
    isSignedIn: !!user,
    email: user?.email ?? null,
    lastBackupAt,
    busy,
    error,
    signIn,
    signUp,
    signOut,
    backUpNow,
    restoreLatest,
    listAllBackups,
    restoreBackupById,
  };
}

type BackupState = ReturnType<typeof useBackupState>;

const BackupContext = createContext<BackupState | null>(null);

export function BackupProvider({ children }: { children: ReactNode }) {
  const value = useBackupState();
  return createElement(BackupContext.Provider, { value }, children);
}

export function useBackup() {
  const value = useContext(BackupContext);
  if (!value) throw new Error('useBackup must be used within BackupProvider');
  return value;
}
