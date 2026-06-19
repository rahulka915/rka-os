import type { Session, User } from '@supabase/supabase-js';

let currentUser: User | null = null;
let currentSession: Session | null = null;

export function setCurrentAuthState(session: Session | null) {
  currentSession = session;
  currentUser = session?.user ?? null;
}

export function getCurrentUser() {
  return currentUser;
}

export function getCurrentSession() {
  return currentSession;
}

export function getCurrentUserId() {
  return currentUser?.id ?? null;
}

