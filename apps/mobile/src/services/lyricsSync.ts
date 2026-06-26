import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LyricLine } from '../lib/lyricTypes';
import { normalizeLyricLines } from '../lib/lyricsUtils';
import { saveLyricsLocal } from '../lib/lyricsStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Lazy client — only created if env vars are present
let _supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

export async function saveLyrics(
  userId: string,
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  const normalized = normalizeLyricLines(lines);

  // 1. Save locally first (offline-safe)
  await saveLyricsLocal(trackId, normalized);

  // 2. Sync to Supabase (async, don't await)
  syncToSupabase(userId, trackId, normalized).catch((error) => {
    console.error('Failed to sync lyrics to Supabase:', error);
  });
}

async function syncToSupabase(
  userId: string,
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    console.warn('Supabase not configured, skipping remote sync');
    return;
  }

  const { error } = await client
    .from('lyrics')
    .upsert({ id: trackId, lines, userId })
    .eq('userId', userId);

  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }
}

export function subscribeLyrics(
  userId: string,
  trackId: string,
  onUpdate: (lines: LyricLine[]) => void
): () => void {
  const client = getSupabase();
  if (!client) {
    console.warn('Supabase not configured, skipping subscription');
    return () => {};
  }

  const subscription = client
    .from('lyrics')
    .on('*', (payload) => {
      if (payload.new?.userId === userId && payload.new?.id === trackId) {
        const lines = normalizeLyricLines(payload.new.lines || []);
        onUpdate(lines);
      }
    })
    .subscribe();

  return () => {
    subscription.unsubscribe();
  };
}
