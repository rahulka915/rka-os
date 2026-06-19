import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { hasSupabaseConfig, supabase } from '../lib/supabase';
import { getAuthSession, signOut, updateUserProfile } from '../data/auth';
import { setCurrentAuthState } from '../data/runtime';
import { setSupabaseSyncUser } from '../data/sync';

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  displayName: string | null;
  needsOnboarding: boolean;
  loading: boolean;
  localMode: boolean;
  logout: () => Promise<void>;
  completeProfile: (name: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState<boolean>(hasSupabaseConfig);

  useEffect(() => {
    let mounted = true;

    async function bootstrap() {
      if (!supabase) {
        setCurrentAuthState(null);
        void setSupabaseSyncUser(null);
        if (mounted) setLoading(false);
        return;
      }

      try {
        const current = await getAuthSession();
        if (!mounted) return;
        setSession(current);
        setCurrentAuthState(current);
        void setSupabaseSyncUser(current?.user ?? null);
      } catch (error) {
        if (!mounted) return;
        console.warn('Supabase auth bootstrap failed, continuing without a session.', error);
        setSession(null);
        setCurrentAuthState(null);
        void setSupabaseSyncUser(null);
      } finally {
        if (mounted) setLoading(false);
      }
    }

    void bootstrap();

    if (!supabase) return () => { mounted = false; };

    const { data: subscription } = supabase.auth.onAuthStateChange(async (_event, nextSession) => {
      setSession(nextSession);
      setCurrentAuthState(nextSession);
      void setSupabaseSyncUser(nextSession?.user ?? null);
      setLoading(false);
    });

    return () => {
      mounted = false;
      subscription.subscription.unsubscribe();
    };
  }, []);

  const displayName = session?.user.user_metadata?.name?.trim()
    || session?.user.user_metadata?.full_name?.trim()
    || session?.user.user_metadata?.display_name?.trim()
    || null;

  const value = useMemo<AuthContextValue>(() => ({
    user: session?.user ?? null,
    session,
    displayName,
    needsOnboarding: Boolean(session && !displayName),
    loading,
    localMode: !hasSupabaseConfig,
    logout: async () => {
      await signOut();
    },
    completeProfile: async (name: string) => {
      const updatedUser = await updateUserProfile(name);
      if (!updatedUser) return;
      if (!session) return;
      const nextSession = { ...session, user: updatedUser };
      setSession(nextSession);
      setCurrentAuthState(nextSession);
      void setSupabaseSyncUser(updatedUser);
    },
  }), [displayName, loading, session]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within AuthProvider');
  return context;
}
