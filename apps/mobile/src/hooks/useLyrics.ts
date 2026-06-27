import { useEffect, useState } from 'react';
import { LyricLine } from '../lib/lyricTypes';
import { loadLyrics } from '../lib/lyricsStorage';
import { subscribeLyrics } from '../services/lyricsSync';

export function useLyrics(trackId: string, userId: string | null | undefined) {
  const [lyrics, setLyrics] = useState<LyricLine[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Load from local storage first
    loadLyrics(trackId).then((local) => {
      setLyrics(local);
      setLoading(false);
    });

    // Subscribe to remote updates
    const unsubscribe = subscribeLyrics(userId, trackId, (updated) => {
      setLyrics(updated);
    });

    return unsubscribe;
  }, [trackId, userId]);

  return { lyrics, setLyrics, loading };
}
