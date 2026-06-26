import type { ParsedLyricLine } from './types';

export function findActiveLyricIndex(
  lyrics: ParsedLyricLine[],
  currentMs: number
): number {
  let left = 0;
  let right = lyrics.length - 1;

  while (left <= right) {
    const middle = Math.floor((left + right) / 2);
    const line = lyrics[middle];

    if (line.startMs <= currentMs && currentMs < line.endMs) {
      return middle;
    }

    if (currentMs < line.startMs) {
      right = middle - 1;
    } else {
      left = middle + 1;
    }
  }

  if (lyrics.length > 0 && currentMs >= lyrics[lyrics.length - 1].startMs) {
    return lyrics.length - 1;
  }

  return -1;
}

export function getLyricProgress(line: ParsedLyricLine | null, currentMs: number): number {
  if (!line) return 0;
  const duration = Math.max(1, line.endMs - line.startMs);
  const elapsed = currentMs - line.startMs;
  return Math.max(0, Math.min(1, elapsed / duration));
}

export function formatMs(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0:00';
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}
