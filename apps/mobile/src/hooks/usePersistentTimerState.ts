import { AppState } from 'react-native';
import { useEffect, useMemo, useState } from 'react';
import {
  type TimerWidgetPresentation,
  type VisibleTimerWidgetPresentation,
  getPersistentMedicationTimers,
  getTimerWidgetPreferences,
  markMedicationTimerNotified,
  setTimerWidgetPreferences,
} from '../db/database';
import { presentMedicationTimer, summarizeTimers } from '../utils/timerPresentation';

export function usePersistentTimerState() {
  const [now, setNow] = useState(() => Date.now());
  const [presentation, setPresentation] = useState<TimerWidgetPresentation>(() => getTimerWidgetPreferences().presentation);
  const [resumePresentation, setResumePresentationState] = useState<VisibleTimerWidgetPresentation | undefined>(() => getTimerWidgetPreferences().resumePresentation);
  const [position, setPositionState] = useState<{ x: number; y: number } | undefined>(() => getTimerWidgetPreferences().position);
  const [pinned, setPinnedState] = useState<boolean>(() => Boolean(getTimerWidgetPreferences().pinned));
  const [soundEnabled, setSoundEnabledState] = useState<boolean>(() => getTimerWidgetPreferences().soundEnabled ?? true);
  const [notificationsEnabled, setNotificationsEnabledState] = useState<boolean>(() => getTimerWidgetPreferences().notificationsEnabled ?? true);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setNow(Date.now());
      }
    });
    return () => subscription.remove();
  }, []);

  const timers = useMemo(
    () => getPersistentMedicationTimers().map((timer) => presentMedicationTimer(timer, now)),
    [now]
  );

  useEffect(() => {
    timers.forEach((timer) => {
      if (timer.isReady && !timer.details.notified) {
        markMedicationTimerNotified(timer.log.id);
      }
    });
  }, [timers]);

  useEffect(() => {
    if (timers.length === 0 && presentation !== 'compact' && presentation !== 'hidden') {
      setPresentation('compact');
    }
  }, [presentation, timers.length]);

  const summary = useMemo(() => summarizeTimers(timers), [timers]);

  const persistPresentation = (nextPresentation: TimerWidgetPresentation) => {
    const nextResumePresentation =
      nextPresentation === 'hidden'
        ? (presentation === 'hidden' ? resumePresentation : presentation)
        : undefined;

    setPresentation(nextPresentation);
    setResumePresentationState(nextResumePresentation);
    setTimerWidgetPreferences({
      presentation: nextPresentation,
      resumePresentation: nextResumePresentation,
      position,
      pinned,
    });
  };

  const restorePresentation = () => {
    const nextPresentation = resumePresentation ?? 'compact';
    setPresentation(nextPresentation);
    setResumePresentationState(undefined);
    setTimerWidgetPreferences({
      presentation: nextPresentation,
      resumePresentation: undefined,
      position,
      pinned,
      soundEnabled,
      notificationsEnabled,
    });
  };

  const persistPosition = (nextPosition: { x: number; y: number }) => {
    setPositionState(nextPosition);
    setTimerWidgetPreferences({ presentation, position: nextPosition, pinned });
  };

  const persistPinned = (nextPinned: boolean) => {
    setPinnedState(nextPinned);
    setTimerWidgetPreferences({ presentation, position, pinned: nextPinned, soundEnabled, notificationsEnabled });
  };

  const persistSoundEnabled = (nextSoundEnabled: boolean) => {
    setSoundEnabledState(nextSoundEnabled);
    setTimerWidgetPreferences({ presentation, position, pinned, soundEnabled: nextSoundEnabled, notificationsEnabled });
  };

  const persistNotificationsEnabled = (nextNotificationsEnabled: boolean) => {
    setNotificationsEnabledState(nextNotificationsEnabled);
    setTimerWidgetPreferences({ presentation, position, pinned, soundEnabled, notificationsEnabled: nextNotificationsEnabled });
  };

  return {
    now,
    timers,
    summary,
    presentation,
    isExpanded: presentation === 'expanded',
    isMinimized: presentation === 'minimized',
    isHidden: presentation === 'hidden',
    setPresentation: persistPresentation,
    restorePresentation,
    position,
    setPosition: persistPosition,
    pinned,
    setPinned: persistPinned,
    soundEnabled,
    notificationsEnabled,
    setSoundEnabled: persistSoundEnabled,
    setNotificationsEnabled: persistNotificationsEnabled,
    refresh: () => setNow(Date.now()),
  };
}
