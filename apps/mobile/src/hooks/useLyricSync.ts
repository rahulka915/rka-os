import { useEffect, useRef, useState } from 'react';
import { LyricLine } from '../lib/lyricTypes';

// Binary search to find active lyric at current time
function activeAt(lyrics: LyricLine[], currentTime: number): number {
  let left = 0;
  let right = lyrics.length - 1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lyrics[mid];

    if (line.startTime <= currentTime && currentTime < line.endTime) {
      return mid;
    }
    if (line.startTime > currentTime) {
      right = mid - 1;
    } else {
      left = mid + 1;
    }
  }

  return -1;
}

export interface UseLyricSyncOptions {
  updateInterval?: number; // ms between updates
}

export function useLyricSync(
  currentTime: number,
  lyrics: LyricLine[],
  options: UseLyricSyncOptions = {}
) {
  const { updateInterval = 250 } = options;
  const [activeIndex, setActiveIndex] = useState(-1);
  const prevIndexRef = useRef(-1);

  useEffect(() => {
    const interval = setInterval(() => {
      const idx = activeAt(lyrics, currentTime);
      if (idx !== prevIndexRef.current) {
        setActiveIndex(idx);
        prevIndexRef.current = idx;
      }
    }, updateInterval);

    return () => clearInterval(interval);
  }, [currentTime, lyrics, updateInterval]);

  // Calculate fill progress (0-1) for active line
  let progress = 0;
  if (activeIndex >= 0 && lyrics[activeIndex]) {
    const line = lyrics[activeIndex];
    const duration = line.endTime - line.startTime;
    const elapsed = currentTime - line.startTime;
    progress = Math.max(0, Math.min(1, elapsed / duration));
  }

  return { activeIndex, progress };
}
