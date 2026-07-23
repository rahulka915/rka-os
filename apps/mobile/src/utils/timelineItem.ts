import type { Item, ItemInstance } from '../db/types';
import type { TimeOfDay } from './time';

export type TimelineItemDensity = 'short' | 'standard' | 'long';

const DEFAULT_DURATION_MINUTES = 45;
const VALID_BUCKETS: TimeOfDay[] = ['anytime', 'morning', 'afternoon', 'evening'];

function formatMinutes(minutes: number): string {
  const safe = Math.max(0, Math.min(23 * 60 + 59, Math.floor(minutes)));
  return `${String(Math.floor(safe / 60)).padStart(2, '0')}:${String(safe % 60).padStart(2, '0')}`;
}

function parseMetadata(value?: string): Record<string, unknown> {
  if (!value) return {};
  try {
    return JSON.parse(value) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function positiveDuration(value: unknown): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value) || value <= 0) return null;
  return Math.max(5, Math.min(24 * 60, Math.round(value)));
}

export function getTimelineDurationMinutes(item: Item, instance?: ItemInstance): number {
  const instanceMetadata = parseMetadata(instance?.instanceMetadata);
  const itemMetadata = parseMetadata(item.metadata);
  return positiveDuration(instanceMetadata.durationMinutes)
    ?? positiveDuration(itemMetadata.durationMinutes)
    ?? DEFAULT_DURATION_MINUTES;
}

export function getTimelineItemDensity(durationMinutes: number): TimelineItemDensity {
  if (durationMinutes <= 30) return 'short';
  if (durationMinutes <= 90) return 'standard';
  return 'long';
}

export function getPreferredTimeBucket(item: Item, instance?: ItemInstance): TimeOfDay {
  const instanceMetadata = parseMetadata(instance?.instanceMetadata);
  const itemMetadata = parseMetadata(item.metadata);
  const value = instanceMetadata.preferredTimeBucket
    ?? itemMetadata.preferredTimeBucket
    ?? instanceMetadata.timeOfDay
    ?? itemMetadata.timeOfDay;
  return typeof value === 'string' && VALID_BUCKETS.includes(value as TimeOfDay)
    ? value as TimeOfDay
    : 'anytime';
}

export function formatTimelineTimeRange(startMinutes: number, durationMinutes: number): string {
  const safeStart = Math.max(0, Math.min(23 * 60 + 59, Math.round(startMinutes)));
  const end = Math.min(24 * 60, safeStart + Math.max(5, Math.round(durationMinutes)));
  const endLabel = end === 24 * 60 ? '24:00' : formatMinutes(end);
  return `${formatMinutes(safeStart)}–${endLabel}`;
}
