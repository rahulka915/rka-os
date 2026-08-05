import { useEffect, useState } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { getActiveRoutineSession, getRoutineForSession, getItemWithMetadata } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { navigateTo } from '../navigation/rootNavigation';
import { PlayCircle } from '../icons';

// Closes the same relaunch-recovery gap that exists for workout sessions
// today (see WorkoutSessionScreen — no equivalent banner there yet): if the
// app is killed mid-routine, there is otherwise no path back to the
// in-progress session. Checked once on mount; RoutineSessionScreen itself
// re-checks getActiveRoutineSession before ever creating a new session, so
// this banner is purely a discovery affordance, not the source of the
// recovery guarantee.
export function RoutineResumeBanner() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const insets = useSafeAreaInsets();
  const [session, setSession] = useState<{ sessionId: string; routineId: string; title: string } | null>(null);

  useEffect(() => {
    const active = getActiveRoutineSession();
    if (!active) return;
    const routineId = getRoutineForSession(active.id);
    if (!routineId) return;
    const routine = getItemWithMetadata(routineId);
    setSession({ sessionId: active.id, routineId, title: routine?.title ?? 'Routine' });
  }, []);

  if (!session) return null;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigateTo('RoutineSession', { routineId: session.routineId, sessionId: session.sessionId });
    setSession(null);
  };

  return (
    <View pointerEvents="box-none" style={[styles.anchor, { top: insets.top + 52 }]}>
      <TouchableOpacity
        style={[styles.capsule, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: palette.separator }]}
        onPress={handlePress}
        activeOpacity={0.85}
      >
        <PlayCircle size={18} color={palette.red} strokeWidth={2} />
        <Text style={[styles.text, { color: palette.text }]} numberOfLines={1}>
          {session.title} — Resume
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  anchor: { position: 'absolute', left: 0, right: 0, zIndex: 999, alignItems: 'center' },
  capsule: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 20,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  text: {
    fontSize: 13,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
