import { useEffect } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, { FadeIn, FadeOut, useReducedMotion } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';

// Sits above the floating tab tray (which is itself `insets.bottom` + its own
// body height above the true bottom edge) rather than tracking the tray's
// exact layout — a fixed clearance is simpler and the tray's height is
// stable across the app.
const TRAY_CLEARANCE = 76;

export interface UndoToastState {
  message: string;
  onUndo: () => void;
}

interface UndoToastProps {
  state: UndoToastState | null;
  isDark: boolean;
}

// Backs every "completed / deleted / moved" action on Home — the action
// commits to the DB only after this toast's own grace window elapses (see
// HomeScreen's scheduleUndoableAction), so Undo here is a real cancel, not a
// second write undoing the first.
export function UndoToast({ state, isDark }: UndoToastProps) {
  const palette = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const reducedMotion = useReducedMotion();

  useEffect(() => {
    if (state) Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  }, [state]);

  if (!state) return null;

  const enter = reducedMotion ? FadeIn.duration(120) : FadeIn.duration(220);
  const exit = reducedMotion ? FadeOut.duration(120) : FadeOut.duration(180);

  return (
    <Animated.View
      entering={enter}
      exiting={exit}
      pointerEvents="box-none"
      style={[styles.wrap, { bottom: insets.bottom + TRAY_CLEARANCE }]}
    >
      <View
        style={[styles.pill, { backgroundColor: isDark ? '#2a2a3a' : '#26203c' }]}
        accessibilityRole="alert"
      >
        <Text style={styles.message} numberOfLines={1}>{state.message}</Text>
        <TouchableOpacity
          onPress={state.onUndo}
          style={styles.undoButton}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel="Undo"
        >
          <Text style={[styles.undoLabel, { color: palette.antiqueBrass }]}>Undo</Text>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    paddingLeft: 16,
    paddingRight: 8,
    height: 48,
    borderRadius: 24,
    width: '100%',
    maxWidth: 480,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 6,
  },
  message: {
    flex: 1,
    color: '#f5efe4',
    fontSize: 14,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  undoButton: {
    height: 44,
    minWidth: 44,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
  },
  undoLabel: {
    fontSize: 14,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
