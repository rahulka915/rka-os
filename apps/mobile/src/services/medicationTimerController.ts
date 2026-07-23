import * as Notifications from 'expo-notifications';
import {
  completeMedicationTimer,
  getPersistentMedicationTimers,
  pauseMedicationTimer,
  resetMedicationTimer,
  resumeMedicationTimer,
  setMedicationTimerNotificationId,
  type MedicationTimerDetails,
} from '../db/database';
import { getAutoStopState, getRunningAutoStopAt, resolveAutoStopAfterMs } from '../domain/medicationTimer/timerMath';
import { presentMedicationTimer, type PresentedMedicationTimer } from '../utils/timerPresentation';
import { endMedicationLiveActivity, updateMedicationLiveActivity } from './medicationLiveActivity';
import { publishMedicationTimerChange } from './medicationTimerEvents';

function liveActivityStateFor(timer: PresentedMedicationTimer) {
  const accumulatedMs = timer.details.accumulatedMs ?? 0;
  const anchor = timer.details.pausedAt ?? timer.details.startedAt ?? timer.log.timestamp;
  return {
    medicationName: timer.med.title,
    displayStartedAt: anchor - accumulatedMs,
    pausedAt: timer.details.pausedAt,
  };
}

function findTimer(logId: string, now = Date.now()) {
  const timer = getPersistentMedicationTimers().find(({ log }) => log.id === logId);
  return timer ? presentMedicationTimer(timer, now) : null;
}

async function cancelScheduled(details: MedicationTimerDetails) {
  if (!details.autoStopNotificationId) return;
  await Notifications.cancelScheduledNotificationAsync(details.autoStopNotificationId).catch(() => {});
}

export async function ensureMedicationTimerAutoStop(timer: PresentedMedicationTimer, now = Date.now()) {
  if (!timer.isRunning || timer.details.autoStopNotificationId) return;
  const autoStopAt = getRunningAutoStopAt(timer.details, now);
  if (autoStopAt == null) return;
  const seconds = Math.max(1, Math.ceil((autoStopAt - now) / 1000));
  const hours = (timer.details.autoStopAfterMs ?? resolveAutoStopAfterMs(undefined)) / 3_600_000;
  const notificationId = await Notifications.scheduleNotificationAsync({
    content: {
      title: `${timer.title} stopwatch ended`,
      body: `The stopwatch reached its ${Number.isInteger(hours) ? hours : hours.toFixed(1)} hour limit.`,
      sound: true,
      data: { type: 'medication-timer-auto-stop', logId: timer.log.id },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds },
  });
  setMedicationTimerNotificationId(timer.log.id, notificationId);
}

export async function pauseTimer(logId: string) {
  const before = findTimer(logId);
  if (!before || before.isPaused) return;
  await cancelScheduled(before.details);
  pauseMedicationTimer(logId, before.med.id);
  setMedicationTimerNotificationId(logId);
  const after = findTimer(logId);
  if (after) updateMedicationLiveActivity(logId, liveActivityStateFor(after));
  publishMedicationTimerChange();
}

export async function resumeTimer(logId: string) {
  const before = findTimer(logId);
  if (!before || before.isRunning) return;
  resumeMedicationTimer(logId, before.med.id);
  const after = findTimer(logId);
  if (after) {
    await ensureMedicationTimerAutoStop(after).catch(() => {});
    updateMedicationLiveActivity(logId, liveActivityStateFor(after));
  }
  publishMedicationTimerChange();
}

export async function resetTimer(logId: string) {
  const before = findTimer(logId);
  if (!before) return;
  await cancelScheduled(before.details);
  resetMedicationTimer(logId, before.med.id);
  setMedicationTimerNotificationId(logId);
  const after = findTimer(logId);
  if (after) {
    await ensureMedicationTimerAutoStop(after).catch(() => {});
    updateMedicationLiveActivity(logId, liveActivityStateFor(after));
  }
  publishMedicationTimerChange();
}

export async function stopTimer(logId: string, reason: 'manual' | 'automatic' = 'manual', now = Date.now()) {
  const timer = findTimer(logId, now);
  if (!timer) return;
  await cancelScheduled(timer.details);
  const autoState = getAutoStopState(timer.details, now);
  const completedElapsedMs = reason === 'automatic'
    ? (autoState.completedElapsedMs ?? timer.details.autoStopAfterMs ?? autoState.elapsedMs)
    : autoState.elapsedMs;
  completeMedicationTimer(logId, timer.med.id, completedElapsedMs, reason);
  endMedicationLiveActivity(logId, liveActivityStateFor(timer));
  publishMedicationTimerChange();
}

export async function reconcileMedicationTimers(now = Date.now()) {
  const timers = getPersistentMedicationTimers().map((timer) => presentMedicationTimer(timer, now));
  for (const timer of timers) {
    const state = getAutoStopState(timer.details, now);
    if (state.expired) await stopTimer(timer.log.id, 'automatic', now);
    else await ensureMedicationTimerAutoStop(timer, now).catch(() => {});
  }
}
