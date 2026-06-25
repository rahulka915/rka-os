import type { ActivityLog, Item } from '../db/types';
import type { MedicationMeta, MedicationTimerDetails } from '../db/database';

export interface PresentedMedicationTimer {
  log: ActivityLog;
  med: Item;
  details: MedicationTimerDetails;
  startedAt: number;
  elapsedMinutes: number;
  elapsedLabel: string;
  compactElapsedLabel: string;
  readyAt: number | null;
  isReady: boolean;
  isPaused: boolean;
  isRunning: boolean;
  title: string;
  subtitle: string;
  statusLabel: string;
}

export function parseMedicationMeta(med: Item): MedicationMeta {
  if (!med.metadata) return {};
  try {
    return JSON.parse(med.metadata) as MedicationMeta;
  } catch {
    return {};
  }
}

export function formatElapsedLabel(startedAt: number, now: number) {
  const elapsedMs = Math.max(0, now - startedAt);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;

  return {
    elapsedMinutes,
    compact: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    full: hours > 0 ? `${hours}h ${minutes}m elapsed` : `${minutes}m elapsed`,
  };
}

function getElapsedMs(timer: { details: MedicationTimerDetails; log: ActivityLog }, now: number) {
  const accumulated = timer.details.accumulatedMs ?? 0;
  if (timer.details.timerActive && timer.details.startedAt) {
    return accumulated + Math.max(0, now - timer.details.startedAt);
  }
  if (timer.details.pausedAt) {
    return accumulated;
  }
  return accumulated;
}

export function presentMedicationTimer(
  timer: { log: ActivityLog; med: Item; details: MedicationTimerDetails },
  now: number
): PresentedMedicationTimer {
  const startedAt = timer.details.startedAt ?? timer.log.timestamp;
  const meta = parseMedicationMeta(timer.med);
  const elapsedMs = getElapsedMs(timer, now);
  const elapsedMinutes = Math.floor(elapsedMs / 60000);
  const hours = Math.floor(elapsedMinutes / 60);
  const minutes = elapsedMinutes % 60;
  const elapsed = {
    elapsedMinutes,
    compact: hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`,
    full: hours > 0 ? `${hours}h ${minutes}m elapsed` : `${minutes}m elapsed`,
  };
  const readyAt = meta.minHoursBetweenDoses
    ? startedAt + meta.minHoursBetweenDoses * 60 * 60 * 1000
    : null;
  const isReady = readyAt !== null && now >= readyAt;
  const isPaused = Boolean(timer.details.pausedAt && !timer.details.timerActive);
  const isRunning = Boolean(timer.details.timerActive);

  return {
    ...timer,
    startedAt,
    elapsedMinutes,
    elapsedLabel: elapsed.full,
    compactElapsedLabel: elapsed.compact,
    readyAt,
    isReady,
    isPaused,
    isRunning,
    title: timer.med.title,
    subtitle: isPaused ? `Paused at ${elapsed.full}` : isReady ? 'Ready for next dose' : `Active for ${elapsed.full}`,
    statusLabel: isPaused ? 'Paused' : isReady ? 'Ready now' : elapsed.full,
  };
}

export function summarizeTimers(timers: PresentedMedicationTimer[]) {
  const first = timers[0];
  if (!first) {
    return {
      headline: '',
      subheadline: '',
    };
  }

  if (timers.length === 1) {
    return {
      headline: first.isPaused ? 'Paused' : first.isReady ? 'Ready for next dose' : first.compactElapsedLabel,
      subheadline: first.title,
    };
  }

  const readyCount = timers.filter((timer) => timer.isReady).length;
  const pausedCount = timers.filter((timer) => timer.isPaused).length;
  return {
    headline: readyCount > 0 ? `${readyCount} ready now` : pausedCount > 0 ? `${pausedCount} paused` : `${timers.length} timers running`,
    subheadline: readyCount > 0
      ? `${timers.length - readyCount} still counting down`
      : pausedCount > 0
        ? `${timers.length - pausedCount} running`
        : `${first.title} +${timers.length - 1} more`,
  };
}
