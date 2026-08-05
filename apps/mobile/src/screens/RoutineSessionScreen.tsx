import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  getRoutineSteps,
  getItemWithMetadata,
  getActiveRoutineSession,
  startRoutineSession,
  advanceRoutineSession,
  pauseRoutineSession,
  resumeRoutineSession,
  addRoutineSessionStepTime,
  finishRoutineSession,
  cancelRoutineSession,
} from '../db/database';
import { parseRoutineStepMeta, parseRoutineSessionMeta, computeStepRemainingSeconds } from '../utils/routineMeta';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { showActionSheet } from '../utils/actionSheet';
import { Pause, PlayCircle, SkipForward, X } from '../icons';
import type { Item } from '../db/types';

interface RoutineSessionRouteParams {
  routineId: string;
  sessionId?: string;
}

function formatClock(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function RoutineSessionScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { routineId, sessionId: routeSessionId } = route.params as RoutineSessionRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  // Created (or resumed) synchronously on mount — the session row exists in
  // SQLite the instant this screen mounts, before any step completes, which
  // is what makes it durable across backgrounding: the DB write already
  // happened, independent of component lifecycle. Never creates a duplicate
  // session if one is already active for this routine.
  const [sessionId] = useState(() => routeSessionId ?? getActiveRoutineSession(routineId)?.id ?? startRoutineSession(routineId));
  const steps = useMemo(() => getRoutineSteps(routineId), [routineId]);
  const [session, setSession] = useState<Item | null>(() => getItemWithMetadata(sessionId));
  const [now, setNow] = useState(() => Date.now());

  const meta = session ? parseRoutineSessionMeta(session.metadata) : null;
  const currentStep = meta ? steps[meta.currentStepIndex] : undefined;
  const stepMeta = currentStep ? parseRoutineStepMeta(currentStep.metadata) : null;
  const remaining = meta && stepMeta ? computeStepRemainingSeconds(stepMeta.durationSeconds, meta, now) : null;

  const refreshSession = () => setSession(getItemWithMetadata(sessionId));

  // Ticks the display every second while mounted; correctness never depends
  // on this running continuously — computeStepRemainingSeconds is derived
  // from persisted timestamps, so it's exact the moment this effect resumes
  // after backgrounding or the screen remounts post-relaunch.
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (currentStep || !meta) return;
    if (steps.length > 0) {
      // Ran past the last step — the routine is done.
      finishRoutineSession(sessionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } else {
      // Routine has no steps (started before any were added, or every step
      // was deleted mid-session) — nothing to play, so there's nothing to
      // finish. Cancel rather than leaving an unresolvable 'active' session
      // behind that would otherwise stick around forever with a blank
      // screen and no way to complete it.
      cancelRoutineSession(sessionId);
    }
    navigation.goBack();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentStep, steps.length]);

  useEffect(() => {
    if (meta?.status === 'running' && stepMeta?.autoAdvance && remaining === 0) {
      advanceRoutineSession(sessionId);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refreshSession();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [remaining, meta?.status, stepMeta?.autoAdvance]);

  if (!currentStep || !meta) {
    return <LensSurface title="Routine"><View /></LensSurface>;
  }

  const handleComplete = () => {
    advanceRoutineSession(sessionId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refreshSession();
  };

  const handleSkip = () => {
    advanceRoutineSession(sessionId, { skipped: true });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshSession();
  };

  const handlePauseResume = () => {
    if (meta.status === 'running') {
      pauseRoutineSession(sessionId);
    } else {
      resumeRoutineSession(sessionId);
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    refreshSession();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet('End this routine?', [
      {
        label: 'End Routine',
        destructive: true,
        onPress: () => {
          cancelRoutineSession(sessionId);
          navigation.goBack();
        },
      },
    ]);
  };

  const handleAddTime = () => {
    addRoutineSessionStepTime(sessionId, 30);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    refreshSession();
  };

  return (
    <LensSurface
      title={`Step ${meta.currentStepIndex + 1} of ${steps.length}`}
      headerRight={
        <TouchableOpacity onPress={handleCancel} hitSlop={12} accessibilityLabel="End routine">
          <X size={22} color={palette.textMuted} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      <View style={styles.content}>
        <Text style={[styles.stepTitle, { color: palette.text }]}>{currentStep.title}</Text>
        {stepMeta?.instructions ? (
          <Text style={[styles.instructions, { color: palette.textSecondary }]}>{stepMeta.instructions}</Text>
        ) : null}

        {remaining !== null ? (
          <Text style={[styles.timer, { color: palette.text }]}>{formatClock(remaining)}</Text>
        ) : (
          <Text style={[styles.timer, { color: palette.textTertiary }]}>Manual step</Text>
        )}

        <View style={styles.controls}>
          {remaining !== null && (
            <TouchableOpacity onPress={handlePauseResume} style={styles.controlButton} hitSlop={12}>
              {meta.status === 'running' ? (
                <Pause size={32} color={palette.text} strokeWidth={1.8} />
              ) : (
                <PlayCircle size={32} color={palette.text} strokeWidth={1.8} />
              )}
            </TouchableOpacity>
          )}
          <TouchableOpacity onPress={handleSkip} style={styles.controlButton} hitSlop={12}>
            <SkipForward size={28} color={palette.textMuted} strokeWidth={1.8} />
          </TouchableOpacity>
        </View>

        {remaining !== null && (
          <TouchableOpacity onPress={handleAddTime} hitSlop={8}>
            <Text style={[styles.addTime, { color: palette.textSecondary }]}>+30s</Text>
          </TouchableOpacity>
        )}

        <TouchableOpacity
          style={[styles.completeButton, { backgroundColor: palette.text }]}
          onPress={handleComplete}
          activeOpacity={0.85}
        >
          <Text style={[styles.completeButtonText, { color: palette.bg }]}>Complete Step</Text>
        </TouchableOpacity>
      </View>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 32,
    alignItems: 'center',
    gap: 16,
  },
  stepTitle: {
    fontSize: 24,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    textAlign: 'center',
  },
  instructions: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    textAlign: 'center',
  },
  timer: {
    fontSize: 56,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
    marginTop: 24,
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 32,
    marginTop: 8,
  },
  controlButton: {
    padding: 8,
  },
  addTime: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  completeButton: {
    marginTop: 'auto',
    marginBottom: 32,
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 32,
    alignItems: 'center',
    alignSelf: 'stretch',
  },
  completeButtonText: {
    fontSize: 16,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});
