import { useMemo } from 'react';
import { LyricLine } from '../lib/lyricTypes';

// Binary search to find the most recent lyric whose timestamp has started.
export function findActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (lyrics.length === 0 || currentTime < lyrics[0].startTime) {
    return -1;
  }

  let left = 0;
  let right = lyrics.length - 1;
  let candidate = -1;

  while (left <= right) {
    const mid = Math.floor((left + right) / 2);
    const line = lyrics[mid];

    if (line.startTime <= currentTime) {
      candidate = mid;
      left = mid + 1;
    } else {
      right = mid - 1;
    }
  }

  return candidate;
}

export function getActiveLyricProgress(
  lyrics: LyricLine[],
  activeIndex: number,
  currentTime: number
): number {
  if (activeIndex < 0 || !lyrics[activeIndex]) {
    return 0;
  }

  const line = lyrics[activeIndex];
  const nextStart = lyrics[activeIndex + 1]?.startTime;
  const fallbackEnd = line.startTime + 4;
  const endTime = typeof nextStart === 'number'
    ? nextStart
    : line.endTime > line.startTime
      ? line.endTime
      : fallbackEnd;
  const duration = Math.max(0.001, endTime - line.startTime);
  const elapsed = currentTime - line.startTime;

  return Math.max(0, Math.min(1, elapsed / duration));
}

export interface UseLyricSyncOptions {
  offsetSeconds?: number;
}

export interface LyricScrollTargetOptions {
  lyrics: LyricLine[];
  activeIndex: number;
  progress: number;
  currentTime: number;
  rowOffsets: Record<string, number>;
  anchorY: number;
  preRollSeconds?: number;
  preRollTravel?: number;
}

function getLineOffsetKey(line: LyricLine, index: number) {
  return line.id ?? `${index}:${line.startTime}:${line.text}:${line.translation ?? ''}`;
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

export function getLyricScrollTarget({
  lyrics,
  activeIndex,
  progress,
  currentTime,
  rowOffsets,
  anchorY,
  preRollSeconds = 6,
  preRollTravel = 72,
}: LyricScrollTargetOptions): number | null {
  if (lyrics.length === 0) {
    return null;
  }

  if (activeIndex < 0) {
    const firstLine = lyrics[0];
    const firstOffset = rowOffsets[getLineOffsetKey(firstLine, 0)];
    if (typeof firstOffset !== 'number') {
      return null;
    }

    const previewWindow = clamp(firstLine.startTime, 2.5, preRollSeconds);
    const previewProgress = firstLine.startTime <= 0
      ? 1
      : 1 - clamp((firstLine.startTime - currentTime) / previewWindow, 0, 1);
    const easedPreview = easeOutCubic(previewProgress);
    return Math.max(0, firstOffset - anchorY + (1 - easedPreview) * preRollTravel);
  }

  const currentLine = lyrics[activeIndex];
  const currentOffset = rowOffsets[getLineOffsetKey(currentLine, activeIndex)];
  if (typeof currentOffset !== 'number') {
    return null;
  }

  const nextLine = lyrics[activeIndex + 1];
  const previousLine = lyrics[activeIndex - 1];
  const nextOffset = nextLine
    ? rowOffsets[getLineOffsetKey(nextLine, activeIndex + 1)]
    : undefined;
  const previousOffset = previousLine
    ? rowOffsets[getLineOffsetKey(previousLine, activeIndex - 1)]
    : undefined;
  const easedProgress = easeInOutCubic(clamp(progress, 0, 1));

  let interpolatedOffset = currentOffset;
  if (typeof nextOffset === 'number') {
    interpolatedOffset = currentOffset + (nextOffset - currentOffset) * easedProgress;
  } else if (typeof previousOffset === 'number') {
    interpolatedOffset = previousOffset + (currentOffset - previousOffset) * easedProgress;
  }

  return Math.max(0, interpolatedOffset - anchorY);
}

export function useLyricSync(
  currentTime: number,
  lyrics: LyricLine[],
  options: UseLyricSyncOptions = {}
) {
  const { offsetSeconds = 0 } = options;
  const syncedTime = currentTime + offsetSeconds;

  const activeIndex = useMemo(
    () => findActiveLyricIndex(lyrics, syncedTime),
    [lyrics, syncedTime]
  );

  const progress = useMemo(
    () => getActiveLyricProgress(lyrics, activeIndex, syncedTime),
    [lyrics, activeIndex, syncedTime]
  );

  return { activeIndex, progress };
}
