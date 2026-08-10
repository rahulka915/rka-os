import { createContext, createElement, type ReactNode, useCallback, useContext, useEffect, useState } from 'react';
import { InteractionManager, Platform } from 'react-native';
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
import { startWebStore, stopWebStore } from '../db/firestoreWebStore';
import { restoreBackup } from '../db/backup';

// Web has no local SQLite to sync against — it reads and writes Firestore
// directly through database.web.ts, so it starts the in-memory mirror instead
// of firestoreSync's dual-write listeners.
const isWeb = Platform.OS === 'web';

function startSync(userId: string): void {
  if (isWeb) startWebStore(userId);
  else startRealtimeSync(userId);
}

function stopSync(): void {
  if (isWeb) stopWebStore();
  else stopRealtimeSync();
}

// Runs `cb` once the app is interactive (so it never competes with cold-start
// rendering or the user's first taps), but never later than a hard cap — a
// runaway animation could in principle hold InteractionManager's queue open
// forever, and "sync silently never starts" would be a far worse failure than
// "sync starts a beat early". Returns a canceller for when auth changes or the
// provider unmounts before it fires.
function scheduleWhenIdle(cb: () => void): { cancel: () => void } {
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    cb();
  };
  const handle = InteractionManager.runAfterInteractions(run);
  const timer = setTimeout(run, 3000);
  return {
    cancel: () => {
      done = true;
      handle.cancel();
      clearTimeout(timer);
    },
  };
}

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

    // A not-yet-run deferred sync start, so a later auth change (or unmount)
    // can cancel it before it fires.
    let pendingStart: { cancel: () => void } | null = null;

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (pendingStart) {
        pendingStart.cancel();
        pendingStart = null;
      }
      if (nextUser) {
        refreshLastBackup(nextUser.uid);
        // Defer sync startup until the app is interactive. Attaching the six
        // Firestore listeners — and applying their first full-collection
        // snapshot into SQLite — is the single heaviest thing that happens
        // right after auth resolves; running it inline blocked cold-start
        // rendering and the user's first taps (the "hangs a couple seconds
        // after open" symptom). runAfterInteractions lets capture/navigation
        // win the thread first; the header sync indicator covers the gap.
        pendingStart = scheduleWhenIdle(() => {
          pendingStart = null;
          startSync(nextUser.uid);
        });
      } else {
        stopSync();
        setLastBackupAt(null);
      }
    });

    return () => {
      if (pendingStart) pendingStart.cancel();
      unsubscribe();
      stopSync();
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
