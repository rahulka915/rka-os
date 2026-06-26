import { useMemo, useState } from 'react';
import type { AudioPlayer } from 'expo-audio';
import { useAudioPlayerStatus } from 'expo-audio';
import type { ParsedLyricLine } from './types';
import { findActiveLyricIndex, getLyricProgress } from './sync';

interface UseSyncedLyricsOptions {
  initialOffsetMs?: number;
}

export function useSyncedLyrics(
  player: AudioPlayer,
  lyrics: ParsedLyricLine[],
  options: UseSyncedLyricsOptions = {}
) {
  const status = useAudioPlayerStatus(player);
  const [offsetMs, setOffsetMs] = useState(options.initialOffsetMs ?? 0);

  const currentMs = Math.max(0, Math.round((status.currentTime ?? 0) * 1000) + offsetMs);
  const durationMs = Math.max(0, Math.round((status.duration ?? 0) * 1000));

  const activeIndex = useMemo(
    () => findActiveLyricIndex(lyrics, currentMs),
    [lyrics, currentMs]
  );

  const activeLyric = activeIndex >= 0 ? lyrics[activeIndex] : null;
  const activeProgress = getLyricProgress(activeLyric, currentMs);

  const seekToLyric = async (line: ParsedLyricLine) => {
    const targetMs = Math.max(0, line.startMs - offsetMs);
    await player.seekTo(targetMs / 1000);
  };

  return {
    status,
    currentMs,
    durationMs,
    offsetMs,
    activeIndex,
    activeLyric,
    activeProgress,
    setOffsetMs,
    nudgeOffsetBackward: () => setOffsetMs((value) => value - 250),
    nudgeOffsetForward: () => setOffsetMs((value) => value + 250),
    seekToLyric,
  };
}
