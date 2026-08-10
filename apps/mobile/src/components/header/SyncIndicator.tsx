import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  useReducedMotion,
  cancelAnimation,
} from 'react-native-reanimated';
import { useSyncStatus } from '../../hooks/useSyncStatus';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';

// Subtle, non-blocking "background sync is catching up" cue for the header —
// a small dot that gently pulses while the initial post-cold-start sync runs,
// then unmounts. Never intercepts touches (no pointer events), never blocks
// anything: it only tells the user that briefly-stale data is expected, not a
// bug. Under Reduce Motion it holds a steady dim dot instead of pulsing.
export function SyncIndicator() {
  const syncing = useSyncStatus();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const reducedMotion = useReducedMotion();
  const opacity = useSharedValue(0.35);

  useEffect(() => {
    if (!syncing || reducedMotion) {
      cancelAnimation(opacity);
      opacity.value = 0.4;
      return;
    }
    opacity.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 650 }),
        withTiming(0.3, { duration: 650 }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(opacity);
  }, [syncing, reducedMotion, opacity]);

  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));

  if (!syncing) return null;

  return (
    <Animated.View
      pointerEvents="none"
      accessibilityLabel="Syncing"
      style={[styles.dot, { backgroundColor: palette.textTertiary }, animatedStyle]}
    />
  );
}

const styles = StyleSheet.create({
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 6,
  },
});
