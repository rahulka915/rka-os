import { useEffect, useRef, useState } from 'react';
import { Text, View, Pressable, StyleSheet, Alert } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import { getThemeColors } from '../../theme';
import { Flame } from '../../icons';

const SIZE = 64;
const STROKE_WIDTH = 4;
const RADIUS = (SIZE - STROKE_WIDTH) / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
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

// Two deliberate steps, not an instant tap. Everything here — the ring
// fill, the hold duration, the haptic buzz — runs on plain JS timers/state
// (requestAnimationFrame + setState, setTimeout, setInterval), deliberately
// NOT react-native-reanimated: reanimated-driven fill techniques (SVG
// stroke-dashoffset via animatedProps, then a translateX transform) both
// failed to animate progressively on device, snapping straight to the end
// state instead — pointing at the reanimated UI-thread driver itself not
// running correctly in this build, not the specific technique. Plain state
// re-renders are heavier but can't be affected by that; the ring's
// strokeDashoffset is now a plain prop computed from fillPercent each
// render. Completing the hold opens a native confirm dialog — only
// accepting it actually calls onConfirm.
export function HabitHoldButton({ title, streak, isCompletedToday, isDark, onConfirm }: HabitHoldButtonProps) {
  const palette = getThemeColors(isDark);
  const [fillPercent, setFillPercent] = useState(isCompletedToday ? 1 : 0);
  const [pressed, setPressed] = useState(false);

  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tickTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const fillRaf = useRef<number | null>(null);
  const decayRaf = useRef<number | null>(null);
  const holdStartedAt = useRef(0);

  const clearTimers = () => {
    if (holdTimer.current) {
      clearTimeout(holdTimer.current);
      holdTimer.current = null;
    }
    if (tickTimer.current) {
      clearInterval(tickTimer.current);
      tickTimer.current = null;
    }
    if (fillRaf.current) {
      cancelAnimationFrame(fillRaf.current);
      fillRaf.current = null;
    }
    if (decayRaf.current) {
      cancelAnimationFrame(decayRaf.current);
      decayRaf.current = null;
    }
  };

  useEffect(() => clearTimers, []);

  const stepFill = () => {
    const elapsed = Date.now() - holdStartedAt.current;
    const pct = Math.min(1, elapsed / HOLD_DURATION);
    setFillPercent(pct);
    if (pct < 1) {
      fillRaf.current = requestAnimationFrame(stepFill);
    }
  };

  const decayFill = (from: number, startedAt: number) => {
    const elapsed = Date.now() - startedAt;
    const pct = Math.max(0, from * (1 - elapsed / CANCEL_DURATION));
    setFillPercent(pct);
    if (pct > 0) {
      decayRaf.current = requestAnimationFrame(() => decayFill(from, startedAt));
    }
  };

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
            setFillPercent(0);
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
    setPressed(true);
    holdStartedAt.current = Date.now();
    fillRaf.current = requestAnimationFrame(stepFill);
    tickTimer.current = setInterval(tickHaptic, TICK_INTERVAL);
    holdTimer.current = setTimeout(() => {
      clearTimers();
      setFillPercent(1);
      handleConfirmed();
    }, HOLD_DURATION);
  };

  const handlePressOut = () => {
    if (isCompletedToday) return;
    setPressed(false);
    // holdTimer is only still set if release happened before completion —
    // once handleConfirmed has fired, clearTimers() already nulled it out.
    if (holdTimer.current) {
      const from = fillPercent;
      clearTimers();
      cancelHaptic();
      decayRaf.current = requestAnimationFrame(() => decayFill(from, Date.now()));
    }
  };

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
        <View style={[{ width: SIZE, height: SIZE }, pressed && styles.pressed]}>
          <Svg width={SIZE} height={SIZE} viewBox={`0 0 ${SIZE} ${SIZE}`}>
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.fill}
              strokeWidth={STROKE_WIDTH}
              fill="none"
            />
            <Circle
              cx={SIZE / 2}
              cy={SIZE / 2}
              r={RADIUS}
              stroke={palette.red}
              strokeWidth={STROKE_WIDTH}
              fill="none"
              strokeLinecap="round"
              strokeDasharray={CIRCUMFERENCE}
              strokeDashoffset={CIRCUMFERENCE * (1 - fillPercent)}
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
  pressed: {
    transform: [{ scale: 0.92 }],
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
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    textAlign: 'center',
  },
  streak: {
    fontSize: 11,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
});
