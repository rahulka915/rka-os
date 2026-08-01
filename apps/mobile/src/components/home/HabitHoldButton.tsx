import { useEffect, useRef } from 'react';
import { Text, View, Pressable, StyleSheet, Alert } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';
import { Flame } from '../../icons';

const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const BAR_WIDTH = SIZE;
const BAR_HEIGHT = 4;
const HOLD_DURATION = 1500;
const CANCEL_DURATION = 150;
const TICK_INTERVAL = 80; // dense continuous buzz, not sparse discrete ticks

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

// Two deliberate steps, not an instant tap. The progress bar fill (via
// reanimated) is purely cosmetic — the actual HOLD_DURATION timing and the
// haptic buzz run on plain JS timers (setTimeout/setInterval), not on the
// reanimated completion callback, since that path proved unreliable in
// practice (completed early, no haptics felt). Completing the hold opens a
// native confirm dialog — only accepting it actually calls onConfirm.
export function HabitHoldButton({ title, streak, isCompletedToday, isDark, onConfirm }: HabitHoldButtonProps) {
  const palette = getThemeColors(isDark);
  const progress = useSharedValue(isCompletedToday ? 1 : 0);
  const pressScale = useSharedValue(1);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const handleConfirmed = () => {
    Alert.alert(
      'Check in?',
      `Mark "${title}" complete for today?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => {
            cancelHaptic();
            progress.value = withTiming(0, { duration: CANCEL_DURATION });
          },
        },
        {
          text: 'Confirm',
          onPress: () => {
            confirmHaptic();
            onConfirm();
          },
        },
      ],
    );
  };

  const handlePressIn = () => {
    if (isCompletedToday) return;
    clearTimers();
    progress.value = withTiming(1, { duration: HOLD_DURATION, easing: Easing.linear });
    pressScale.value = withTiming(0.92, { duration: 120 });
    tickTimer.current = setInterval(tickHaptic, TICK_INTERVAL);
    holdTimer.current = setTimeout(() => {
      clearTimers();
      handleConfirmed();
    }, HOLD_DURATION);
  };

  const handlePressOut = () => {
    if (isCompletedToday) return;
    pressScale.value = withTiming(1, { duration: 150 });
    // holdTimer is only still set if release happened before completion —
    // once handleConfirmed has fired, clearTimers() already nulled it out.
    if (holdTimer.current) {
      clearTimers();
      progress.value = withTiming(0, { duration: CANCEL_DURATION });
      cancelHaptic();
    }
  };

  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: pressScale.value }],
  }));

  // Reveal via translateX inside an overflow:hidden track, not a width or
  // SVG stroke-dashoffset animation — the most reliably smooth transform in
  // this app (matches how every other reanimated animation here is driven).
  // At progress 0 the fill sits fully off to the left; at 1 it's flush.
  const barFillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: (progress.value - 1) * BAR_WIDTH }],
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
        <Animated.View style={[{ width: SIZE, height: SIZE }, pressStyle]}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.fill}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
          </Svg>
          <View style={styles.iconOverlay} pointerEvents="none">
            <Flame size={24} color={flameColor} />
          </View>
        </Animated.View>
      </Pressable>
      <View style={[styles.barTrack, { backgroundColor: palette.fill }]}>
        <Animated.View style={[styles.barFill, { backgroundColor: palette.red }, barFillStyle]} />
      </View>
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
  barTrack: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
    overflow: 'hidden',
  },
  barFill: {
    width: BAR_WIDTH,
    height: BAR_HEIGHT,
    borderRadius: BAR_HEIGHT / 2,
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
