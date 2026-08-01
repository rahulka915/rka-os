import { Text, View, Pressable, StyleSheet } from 'react-native';
import {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedReaction,
  useSharedValue,
  withTiming,
  runOnJS,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';
import { Flame } from '../../icons';

const AnimatedCircle = createAnimatedComponent(Circle);

const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
const HOLD_DURATION = 600;
const CANCEL_DURATION = 150;

interface HabitHoldButtonProps {
  title: string;
  streak: number;
  isCompletedToday: boolean;
  isDark: boolean;
  onConfirm: () => void;
}

function tickHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function cancelHaptic() {
  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

function confirmHaptic() {
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
}

// Press-and-hold confirmation, not an instant tap — the ring fills over
// HOLD_DURATION with a haptic tick at each fifth crossed; releasing early
// interrupts the fill (withTiming reassignment makes the pending completion
// callback fire with finished:false, so onConfirm never runs) and springs
// back with a light "cancelled" tick instead of failing silently.
export function HabitHoldButton({ title, streak, isCompletedToday, isDark, onConfirm }: HabitHoldButtonProps) {
  const palette = getThemeColors(isDark);
  const progress = useSharedValue(isCompletedToday ? 1 : 0);

  useAnimatedReaction(
    () => Math.floor(progress.value * 5),
    (bucket, previousBucket) => {
      if (bucket > 0 && bucket !== previousBucket) {
        runOnJS(tickHaptic)();
      }
    },
  );

  const handleConfirmed = () => {
    confirmHaptic();
    onConfirm();
  };

  const handlePressIn = () => {
    if (isCompletedToday) return;
    progress.value = withTiming(
      1,
      { duration: HOLD_DURATION, easing: Easing.linear },
      (finished) => {
        if (finished) runOnJS(handleConfirmed)();
      },
    );
  };

  const handlePressOut = () => {
    if (isCompletedToday || progress.value >= 1) return;
    progress.value = withTiming(0, { duration: CANCEL_DURATION });
    runOnJS(cancelHaptic)();
  };

  const ringProps = useAnimatedProps(() => ({
    strokeDashoffset: CIRCUMFERENCE * (1 - progress.value),
  }));

  const flameColor = isCompletedToday ? palette.red : palette.textTertiary;

  return (
    <View style={styles.wrap}>
      <Pressable
        onPressIn={handlePressIn}
        onPressOut={handlePressOut}
        disabled={isCompletedToday}
        accessibilityRole="button"
        accessibilityLabel={isCompletedToday ? `${title}, already checked in today` : `Hold to check in ${title}`}
      >
        <View style={{ width: SIZE, height: SIZE }}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.fill}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <AnimatedCircle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.red}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              animatedProps={ringProps}
              rotation={-90}
              origin={`${SIZE / 2}, ${SIZE / 2}`}
            />
          </Svg>
          <View style={styles.iconOverlay} pointerEvents="none">
            <Flame size={24} color={flameColor} />
          </View>
        </View>
      </Pressable>
      <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>{title}</Text>
      {streak > 0 && (
        <Text style={[styles.streak, { color: palette.textTertiary }]}>{streak}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    width: SIZE + 16,
    gap: 4,
  },
  iconOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
  },
  streak: {
    fontSize: 11,
    fontWeight: '600',
  },
});
