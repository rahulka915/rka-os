import { useCallback, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, hasSupabaseConfig } from '../lib/supabase';
import { pushBackup, getLatestBackupMeta, fetchLatestBackupPayload } from '../services/backupSync';
import { restoreBackup } from '../db/backup';

export function useBackup() {
  const [session, setSession] = useState<Session | null>(null);
  const [lastBackupAt, setLastBackupAt] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const refreshLastBackup = useCallback(async (userId: string) => {
    const meta = await getLatestBackupMeta(userId);
    setLastBackupAt(meta?.createdAt ?? null);
  }, []);

  useEffect(() => {
    if (!hasSupabaseConfig || !supabase) return;

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session) refreshLastBackup(data.session.user.id);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession) {
        refreshLastBackup(nextSession.user.id);
      } else {
        setLastBackupAt(null);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, [refreshLastBackup]);

  const backUpNow = useCallback(async () => {
    if (!session) return;
    setBusy(true);
    try {
      await pushBackup(session.user.id);
      await refreshLastBackup(session.user.id);
    } catch (err) {
      console.warn('[backup] push failed', err);
    } finally {
      setBusy(false);
    }
  }, [session, refreshLastBackup]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase is not configured');
    setBusy(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      if (data.session) {
        await pushBackup(data.session.user.id).catch((err) =>
          console.warn('[backup] initial push after sign-in failed', err)
        );
        await refreshLastBackup(data.session.user.id);
      }
    } finally {
      setBusy(false);
    }
  }, [refreshLastBackup]);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
  }, []);

  const restoreLatest = useCallback(async (): Promise<boolean> => {
    if (!session) return false;
    setBusy(true);
    try {
      const payload = await fetchLatestBackupPayload(session.user.id);
      if (!payload) return false;
      restoreBackup(payload);
      return true;
    } finally {
      setBusy(false);
    }
  }, [session]);

  return {
    isSignedIn: !!session,
    email: session?.user.email ?? null,
    lastBackupAt,
    busy,
    signIn,
    signOut,
    backUpNow,
    restoreLatest,
  };
}
