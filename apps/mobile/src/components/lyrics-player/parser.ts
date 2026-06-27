import type { ParsedLyricDraft, ParsedLyricLine } from './types';

const TIMESTAMP_PATTERN = /^\[(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?\]\s*(.*)$/;

function padCentiseconds(value: string | undefined): number {
  if (!value) return 0;
  return Number(value.padEnd(2, '0').slice(0, 2));
}

function timestampToMs(minutes: number, seconds: number, centiseconds: number): number {
  return minutes * 60_000 + seconds * 1_000 + centiseconds * 10;
}

function buildId(startMs: number, index: number): string {
  return `lyric-${startMs}-${index}`;
}

export function parseTimestampToMs(rawTimestamp: string): number | null {
  const match = rawTimestamp.match(/^(\d{1,2}):(\d{2})(?:\.(\d{1,2}))?$/);
  if (!match) return null;
  return timestampToMs(Number(match[1]), Number(match[2]), padCentiseconds(match[3]));
}

export function parseLyrics(rawLyrics: string): ParsedLyricLine[] {
  const drafts: ParsedLyricDraft[] = rawLyrics
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line, index) => {
      const match = line.match(TIMESTAMP_PATTERN);
      if (!match) return null;

      const startMs = timestampToMs(
        Number(match[1]),
        Number(match[2]),
        padCentiseconds(match[3])
      );
      const [original = '', romanised = '', translation = ''] = match[4]
        .split('|')
        .map((part) => part.trim());

      return {
        id: buildId(startMs, index),
        original,
        romanised,
        translation,
        startMs,
      };
    })
    .filter((line): line is ParsedLyricDraft => line !== null)
    .sort((a, b) => a.startMs - b.startMs);

  return drafts.map((line, index, arr) => ({
    ...line,
    endMs: arr[index + 1]?.startMs ?? line.startMs + 4_000,
  }));
}
