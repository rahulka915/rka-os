export const DEFAULT_AUTO_STOP_HOURS = 24;
const HOUR_MS = 60 * 60 * 1000;

export interface TimerClockState {
  timerActive?: boolean;
  startedAt?: number;
  pausedAt?: number;
  accumulatedMs?: number;
  autoStopAfterMs?: number;
}

export function resolveAutoStopAfterMs(hours?: number): number {
  const resolvedHours = Number.isFinite(hours) && hours! > 0 ? hours! : DEFAULT_AUTO_STOP_HOURS;
  return resolvedHours * HOUR_MS;
}

export function getActiveElapsedMs(timer: TimerClockState, now: number): number {
  const accumulatedMs = Math.max(0, timer.accumulatedMs ?? 0);
  if (!timer.timerActive || timer.startedAt == null) return accumulatedMs;
  return accumulatedMs + Math.max(0, now - timer.startedAt);
}

export function getAutoStopState(timer: TimerClockState, now: number) {
  const elapsedMs = getActiveElapsedMs(timer, now);
  const autoStopAfterMs = timer.autoStopAfterMs ?? resolveAutoStopAfterMs(undefined);
  const remainingMs = Math.max(0, autoStopAfterMs - elapsedMs);
  const expired = elapsedMs >= autoStopAfterMs;

  return {
    elapsedMs,
    remainingMs,
    expired,
    completedElapsedMs: expired ? autoStopAfterMs : undefined,
  };
}

export function getRunningAutoStopAt(timer: TimerClockState, now: number): number | null {
  if (!timer.timerActive) return null;
  const { remainingMs } = getAutoStopState(timer, now);
  return now + remainingMs;
}
