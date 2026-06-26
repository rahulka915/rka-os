import { LyricLine, DraftLine } from './lyricTypes';

// FNV-1a hash for deterministic ID generation
function hashString(str: string): string {
  let hash = 2166136261;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = (hash * 16777619) >>> 0;
  }
  return `lyric-${Math.abs(hash).toString(16)}`;
}

export function generateId(index: number, text: string): string {
  return hashString(`${index}-${text}`);
}

export function parseTimestamp(value: string): number | null {
  const match = value.match(/^(\d+):(\d+(?:\.\d+)?)$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

export function formatTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const whole = Math.floor(seconds);
  const minutes = Math.floor(whole / 60);
  const remaining = whole % 60;
  return `${minutes}:${String(remaining).padStart(2, '0')}`;
}

export function round(n: number): number {
  return Math.round(n * 100) / 100;
}

export function normalizeLyricLines(lines: (LyricLine | DraftLine)[]): LyricLine[] {
  return lines.map((l, i) => {
    const base: LyricLine = {
      ...l,
      id: (l as any).id || generateId(i, (l as any).text || ''),
      text: (l as any).text || '',
      startTime: typeof (l as any).startTime === 'number' ? (l as any).startTime : 0,
      endTime: typeof (l as any).endTime === 'number' ? (l as any).endTime : 0,
    };

    // Detect instrumental
    if ((l as any).kind === 'instrumental' || base.text.startsWith('♪')) {
      base.kind = 'instrumental';
      if (!base.label && base.text.startsWith('♪')) {
        base.label = base.text.replace(/^♪\s*/, '').trim() || 'Instrumental';
      }
    } else {
      base.kind = 'lyric';
    }

    return base;
  });
}

export interface ParseResult {
  lines: DraftLine[];
  errors: string[];
}

export function parseRawLyrics(input: string): ParseResult {
  const lines: DraftLine[] = [];
  const errors: string[] = [];
  let prevTime: number | null = null;

  const rawLines = input.split('\n').map(l => l.trim()).filter(Boolean);

  rawLines.forEach((line, index) => {
    const match = line.match(/^\[(\d+):(\d+(?:\.\d+)?)\]\s*(.*)$/);
    const timeStr = match ? `${match[1]}:${match[2]}` : null;
    const time = timeStr ? parseTimestamp(timeStr) : null;
    const body = match ? match[3] : line;

    const [script = '', text = '', translation = ''] = body
      .split('|')
      .map(p => p.trim());

    if (!script && !text && !translation) {
      // Skip empty lines
      return;
    }

    // Validate timestamp order
    if (time !== null && prevTime !== null && time < prevTime) {
      errors.push(`Line ${index + 1}: timestamp ${formatTime(time)} is earlier than previous line ${formatTime(prevTime)}`);
    }

    lines.push({
      id: `draft-${Date.now()}-${index}`,
      script,
      text,
      translation,
      startTime: time,
    });

    if (time !== null) prevTime = time;
  });

  return { lines, errors };
}

export function inferEndTimes(lines: LyricLine[]): LyricLine[] {
  return lines.map((line, i) => {
    const endTime = i < lines.length - 1
      ? lines[i + 1].startTime
      : line.startTime + 4;
    return { ...line, endTime };
  });
}
