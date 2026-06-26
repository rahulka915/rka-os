import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { REALTIME_SUBSCRIBE_STATES, RealtimePostgresChangesPayload } from '@supabase/realtime-js';
import { LyricLine } from '../lib/lyricTypes';
import { normalizeLyricLines } from '../lib/lyricsUtils';
import { saveLyricsLocal } from '../lib/lyricsStorage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

// Lazy client — only created if env vars are present
let _supabase: SupabaseClient | null = null;

type LyricsRow = {
  id: string;
  lines: LyricLine[];
  userId: string;
  updatedAt?: string;
};

function isLyricsRow(value: unknown): value is LyricsRow {
  if (!value || typeof value !== 'object') return false;
  const row = value as Partial<LyricsRow>;
  return typeof row.id === 'string'
    && typeof row.userId === 'string'
    && Array.isArray(row.lines);
}

function getSupabase(): SupabaseClient | null {
  if (!supabaseUrl || !supabaseKey) return null;
  if (!_supabase) {
    _supabase = createClient(supabaseUrl, supabaseKey);
  }
  return _supabase;
}

function isUuid(value: string | null | undefined): value is string {
  return typeof value === 'string'
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function lyricsRowId(userId: string, trackId: string): string {
  return `${userId}:${trackId}`;
}

export async function saveLyrics(
  userId: string | null | undefined,
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
  userId: string | null | undefined,
  trackId: string,
  lines: LyricLine[]
): Promise<void> {
  const client = getSupabase();
  if (!client) {
    console.warn('Supabase not configured, skipping remote sync');
    return;
  }
  if (!isUuid(userId)) {
    console.warn('Skipping lyric sync because no authenticated mobile user is available');
    return;
  }

  const { error } = await client
    .from('lyrics')
    .upsert({
      id: lyricsRowId(userId, trackId),
      lines,
      userId,
    });

  if (error) {
    throw new Error(`Supabase sync failed: ${error.message}`);
  }
}

export function subscribeLyrics(
  userId: string | null | undefined,
  trackId: string,
  onUpdate: (lines: LyricLine[]) => void
): () => void {
  const client = getSupabase();
  if (!client) {
    console.warn('Supabase not configured, skipping subscription');
    return () => {};
  }
  if (!isUuid(userId)) {
    return () => {};
  }

  const rowId = lyricsRowId(userId, trackId);
  const channel = client
    .channel(`lyrics:${rowId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'lyrics',
        filter: `id=eq.${rowId}`,
      },
      (payload: RealtimePostgresChangesPayload<LyricsRow>) => {
        const nextRow = 'new' in payload && isLyricsRow(payload.new) ? payload.new : null;
        if (nextRow && nextRow.userId === userId && nextRow.id === rowId) {
          const lines = normalizeLyricLines(nextRow.lines || []);
          onUpdate(lines);
        }
      }
    )
    .subscribe((status) => {
      if (status === REALTIME_SUBSCRIBE_STATES.CHANNEL_ERROR) {
        console.warn('Lyrics realtime channel failed to subscribe');
      }
    });

  return () => {
    void client.removeChannel(channel);
  };
}
