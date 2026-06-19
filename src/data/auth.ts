import type { Session } from '@supabase/supabase-js';
import { supabase, hasSupabaseConfig } from '../lib/supabase';

export async function getAuthSession(): Promise<Session | null> {
  if (!supabase) return null;
  const { data, error } = await supabase.auth.getSession();
  if (error) throw error;
  return data.session ?? null;
}

export async function signInWithPassword(email: string, password: string) {
  if (!supabase) return { disabled: true as const };
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data.session ?? null;
}

export async function signUpWithPassword(email: string, password: string) {
  if (!supabase) return { disabled: true as const, session: null, accountExists: false };
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
  });
  if (error) throw error;

  // Supabase may hide an existing account behind an empty identities array to
  // prevent email enumeration. Treat that separately from a new unconfirmed user.
  const accountExists = Boolean(data.user && data.user.identities?.length === 0);
  return {
    disabled: false as const,
    session: data.session ?? null,
    accountExists,
  };
}

export async function signOut() {
  if (!supabase) return;
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function updateUserProfile(name: string) {
  if (!supabase) return;
  const trimmed = name.trim();
  const { data, error } = await supabase.auth.updateUser({
    data: {
      name: trimmed,
      full_name: trimmed,
      display_name: trimmed,
    },
  });
  if (error) throw error;
  return data.user;
}

export const isAuthEnabled = hasSupabaseConfig;
