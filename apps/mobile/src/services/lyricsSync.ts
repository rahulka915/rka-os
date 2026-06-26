import { createClient } from '@supabase/supabase-js';
import { LyricLine } from '../lib/lyricTypes';
import { normalizeLyricLines } from '../lib/lyricsUtils';
import { saveLyricsLocal } from '../lib/lyricsStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.warn('Supabase environment variables not set. Sync will not work.');
}

export const supabase = createClient(
  supabaseUrl || '',
  supabaseKey || ''
);

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
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase not configured, skipping remote sync');
    return;
  }

  const { error } = await supabase
    .from('lyrics')
    .upsert({
      id: trackId,
      lines: lines,
      userId: userId,
    })
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
  if (!supabaseUrl || !supabaseKey) {
    console.warn('Supabase not configured, skipping subscription');
    return () => {};
  }

  const subscription = supabase
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
