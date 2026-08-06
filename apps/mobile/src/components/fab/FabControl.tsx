import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Pressable,
  StyleSheet,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  G,
  LinearGradient,
  Path,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

interface FabControlProps {
  size: number;
  onPress: () => void;
  onLongPress?: () => boolean | void;
  delayLongPress?: number;
  accessibilityLabel?: string;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
}

export function FabControl({
  size,
  onPress,
  onLongPress,
  delayLongPress = 400,
  accessibilityLabel = 'Create',
  hitSlop,
  style,
}: FabControlProps) {
  const [reduceMotion, setReduceMotion] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const running = useRef(false);
  const longPressed = useRef(false);
  const pressProgress = useSharedValue(0);
  const actionProgress = useSharedValue(0);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      clearTimers();
      subscription.remove();
    };
  }, []);

  const controlStyle = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(pressProgress.value, [0, 1], [1, 0.96]) }],
  }));

  const brushStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: interpolate(actionProgress.value, [0, 0.45, 1], [0, -2, 5]) },
      { translateY: interpolate(actionProgress.value, [0, 0.45, 1], [0, -7, 2]) },
      { rotateZ: `${interpolate(actionProgress.value, [0, 0.45, 1], [0, -9, 8])}deg` },
    ],
  }));

  const paperStyle = useAnimatedStyle(() => ({
    transform: [{ scaleX: interpolate(actionProgress.value, [0, 1], [0.96, 1.02]) }],
  }));

  const inkStyle = useAnimatedStyle(() => ({
    opacity: interpolate(actionProgress.value, [0, 0.32, 1], [0, 0, 1]),
    transform: [
      { translateX: interpolate(actionProgress.value, [0, 0.32, 1], [-12, -12, 0]) },
      { scaleX: interpolate(actionProgress.value, [0, 0.32, 1], [0.2, 0.2, 1]) },
    ],
  }));

  const activate = () => {
    if (running.current || longPressed.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (reduceMotion) {
      onPress();
      return;
    }

    clearTimers();
    running.current = true;
    actionProgress.value = 0;
    actionProgress.value = withSequence(
      withTiming(1, { duration: 190, easing: Easing.out(Easing.cubic) }),
      withDelay(45, withTiming(0, { duration: 180, easing: Easing.out(Easing.cubic) })),
    );
    timers.current.push(setTimeout(onPress, 70));
    timers.current.push(setTimeout(() => {
      running.current = false;
    }, 430));
  };

  const hold = () => {
    if (!onLongPress || running.current) return;
    const handled = onLongPress();
    if (handled === false) return;
    longPressed.current = true;
    actionProgress.value = withTiming(0.42, { duration: 150, easing: Easing.out(Easing.cubic) });
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  return (
    <Pressable
      onPress={activate}
      onLongPress={hold}
      delayLongPress={delayLongPress}
      onPressIn={() => {
        longPressed.current = false;
        pressProgress.value = withTiming(1, { duration: 110, easing: Easing.out(Easing.cubic) });
      }}
      onPressOut={() => {
        pressProgress.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
        if (!running.current) {
          actionProgress.value = withTiming(0, { duration: 170, easing: Easing.out(Easing.cubic) });
        }
        timers.current.push(setTimeout(() => {
          longPressed.current = false;
        }, 80));
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={[styles.control, { width: size, height: size }, style]}
    >
      <Animated.View style={[styles.artwork, controlStyle]}>
        <Svg width="100%" height="100%" viewBox="0 0 192 192">
          <Defs>
            <RadialGradient id="disc" cx="35%" cy="26%" rx="72%" ry="78%">
              <Stop offset="0" stopColor="#4269AC" />
              <Stop offset="0.58" stopColor="#274B8F" />
              <Stop offset="1" stopColor="#172E5C" />
            </RadialGradient>
            <LinearGradient id="rim" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#7896C8" />
              <Stop offset="0.42" stopColor="#294D90" />
              <Stop offset="1" stopColor="#10254B" />
            </LinearGradient>
          </Defs>
          <Circle cx="96" cy="99" r="72" fill="#0B1730" opacity="0.42" />
          <Circle cx="96" cy="94" r="72" fill="url(#rim)" />
          <Circle cx="96" cy="94" r="67" fill="url(#disc)" />
          <Path d="M52 53C69 34 117 25 140 46" stroke="#FFFFFF" strokeWidth="3" strokeLinecap="round" opacity="0.18" />
        </Svg>

        <Animated.View pointerEvents="none" style={[styles.layer, paperStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 192 192">
            <Defs>
              <LinearGradient id="paper" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#FFF9EA" />
                <Stop offset="1" stopColor="#D9C8A7" />
              </LinearGradient>
            </Defs>
            <G transform="rotate(-8 96 98)">
              <Rect x="49" y="68" width="96" height="61" rx="10" fill="#162A52" opacity="0.25" />
              <Rect x="47" y="64" width="96" height="61" rx="10" fill="url(#paper)" />
              <Path d="M55 75C75 70 111 70 135 75M55 116C78 121 113 121 135 115" stroke="#8E7955" strokeWidth="1.5" opacity="0.25" />
            </G>
          </Svg>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layer, inkStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 192 192">
            <Path
              d="M68 102C78 92 91 111 101 99C110 89 119 93 127 101"
              fill="none"
              stroke="#171A20"
              strokeWidth="8"
              strokeLinecap="round"
            />
          </Svg>
        </Animated.View>

        <Animated.View pointerEvents="none" style={[styles.layer, brushStyle]}>
          <Svg width="100%" height="100%" viewBox="0 0 192 192">
            <Defs>
              <LinearGradient id="bamboo" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#8B552B" />
                <Stop offset="0.5" stopColor="#D9A760" />
                <Stop offset="1" stopColor="#70401F" />
              </LinearGradient>
              <LinearGradient id="ferrule" x1="0" y1="0" x2="1" y2="0">
                <Stop offset="0" stopColor="#6E161C" />
                <Stop offset="0.5" stopColor="#C44545" />
                <Stop offset="1" stopColor="#541016" />
              </LinearGradient>
            </Defs>
            <G transform="rotate(43 96 96)">
              <Rect x="88" y="28" width="17" height="79" rx="8.5" fill="url(#bamboo)" />
              <Path d="M91 35C94 32 99 32 102 35" stroke="#F4D391" strokeWidth="2" strokeLinecap="round" opacity="0.7" />
              <Rect x="86" y="99" width="21" height="24" rx="5" fill="url(#ferrule)" />
              <Path d="M89 104H104" stroke="#F28A7C" strokeWidth="2" opacity="0.6" />
              <Path d="M88 119C88 119 84 139 96 157C108 139 105 119 105 119Z" fill="#16191E" />
              <Path d="M94 123C93 133 94 143 97 151" stroke="#59616C" strokeWidth="2" strokeLinecap="round" opacity="0.65" />
            </G>
          </Svg>
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  artwork: {
    width: '100%',
    height: '100%',
  },
  layer: {
    position: 'absolute',
    inset: 0,
  },
});
