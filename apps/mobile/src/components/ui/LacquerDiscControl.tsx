import { useEffect, useRef } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, {
  Easing,
  createAnimatedComponent,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  Defs,
  LinearGradient,
  Path,
  RadialGradient,
  Stop,
} from 'react-native-svg';
import * as Haptics from 'expo-haptics';

const AnimatedPath = createAnimatedComponent(Path);

const TOUCH_TARGET = 44;
const CHECK_LENGTH = 18;
const PRESS_DURATION = 100;
const DRAW_DURATION = 180;
const SETTLE_DELAY = 180;
export const LACQUER_DISC_COMPLETION_DURATION = 380;

export interface LacquerDiscControlProps {
  isCompleted: boolean;
  isEnabled?: boolean;
  onToggle: () => void;
  size?: number;
  accessibilityLabel?: string;
}

export function LacquerDiscControl({
  isCompleted,
  isEnabled = true,
  onToggle,
  size = 24,
  accessibilityLabel,
}: LacquerDiscControlProps) {
  const scale = useSharedValue(1);
  const pressedDepth = useSharedValue(0);
  const checkProgress = useSharedValue(isCompleted ? 1 : 0);
  const glowProgress = useSharedValue(isCompleted && isEnabled ? 1 : 0);
  const requestedToggle = useRef(false);
  const previousCompleted = useRef(isCompleted);

  useEffect(() => {
    const changed = previousCompleted.current !== isCompleted;
    previousCompleted.current = isCompleted;

    if (!isEnabled) {
      glowProgress.value = withTiming(0, { duration: DRAW_DURATION });
      checkProgress.value = withTiming(isCompleted ? 1 : 0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      scale.value = withTiming(1, { duration: PRESS_DURATION });
      pressedDepth.value = withTiming(0, { duration: PRESS_DURATION });
      requestedToggle.current = false;
      return;
    }

    if (isCompleted) {
      checkProgress.value = withTiming(1, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      glowProgress.value = withTiming(1, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.quad),
      });
      scale.value = withDelay(
        SETTLE_DELAY,
        withSpring(1, {
          stiffness: 270,
          damping: 30,
          mass: 0.7,
          overshootClamping: true,
        })
      );
      pressedDepth.value = withDelay(
        SETTLE_DELAY,
        withTiming(0, { duration: 200, easing: Easing.out(Easing.cubic) })
      );

      if (changed && requestedToggle.current) {
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    } else {
      checkProgress.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      glowProgress.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.quad),
      });
      scale.value = withTiming(1, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      pressedDepth.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }

    requestedToggle.current = false;
  }, [isCompleted, isEnabled]);

  const discStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }, { translateY: pressedDepth.value * 0.7 }],
  }));

  const innerShadowStyle = useAnimatedStyle(() => ({
    opacity: pressedDepth.value * 0.78,
  }));

  const rimShadeStyle = useAnimatedStyle(() => ({
    opacity: pressedDepth.value * 0.58,
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowProgress.value * 0.18,
    transform: [{ scale: 0.88 + glowProgress.value * 0.12 }],
  }));

  const checkProps = useAnimatedProps(() => ({
    strokeDashoffset: CHECK_LENGTH * (1 - checkProgress.value),
  }));

  const handlePressIn = () => {
    if (!isEnabled) return;
    void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    scale.value = withTiming(0.92, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    pressedDepth.value = withTiming(1, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handlePressOut = () => {
    if (!isEnabled || requestedToggle.current) return;
    scale.value = withTiming(1, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
    });
    pressedDepth.value = withTiming(0, {
      duration: PRESS_DURATION,
      easing: Easing.out(Easing.cubic),
    });
  };

  const handlePress = () => {
    if (!isEnabled) return;
    requestedToggle.current = true;
    if (!isCompleted) {
      scale.value = 0.92;
      pressedDepth.value = 1;
    }
    onToggle();

    // Undo uses the press haptic already emitted on finger-down. Completion
    // receives its distinct success haptic once the controlled value updates.
    if (isCompleted) {
      checkProgress.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      glowProgress.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.quad),
      });
      scale.value = withTiming(1, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
      pressedDepth.value = withTiming(0, {
        duration: DRAW_DURATION,
        easing: Easing.out(Easing.cubic),
      });
    }
  };

  const radius = size / 2;
  const glowSize = size + 24;
  const svgScale = size / 24;

  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={accessibilityLabel ?? (isCompleted ? 'Mark incomplete' : 'Mark complete')}
      accessibilityState={{ checked: isCompleted, disabled: !isEnabled }}
      disabled={!isEnabled}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      onPress={handlePress}
      style={[
        styles.touchTarget,
        { opacity: isEnabled ? 1 : 0.42 },
      ]}
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.glow,
          {
            width: glowSize,
            height: glowSize,
            borderRadius: glowSize / 2,
            marginLeft: -glowSize / 2,
            marginTop: -glowSize / 2,
          },
          glowStyle,
        ]}
      />

      <Animated.View
        pointerEvents="none"
        style={[{ width: size, height: size }, discStyle]}
      >
        <Svg width={size} height={size} viewBox="0 0 24 24">
          <Defs>
            <RadialGradient id="lacquerFill" cx="36%" cy="28%" rx="72%" ry="74%">
              <Stop offset="0" stopColor="#151517" />
              <Stop offset="0.58" stopColor="#0D0D0F" />
              <Stop offset="1" stopColor="#151517" />
            </RadialGradient>
            <LinearGradient id="innerBevel" x1="0" y1="0" x2="1" y2="1">
              <Stop offset="0" stopColor="#FFFFFF" stopOpacity="0.09" />
              <Stop offset="0.42" stopColor="#FFFFFF" stopOpacity="0" />
              <Stop offset="1" stopColor="#000000" stopOpacity="0.54" />
            </LinearGradient>
          </Defs>

          <Circle
            cx="12"
            cy="12"
            r="11.35"
            fill="url(#lacquerFill)"
            stroke="#C9C2B8"
            strokeWidth="1"
          />
          <Circle
            cx="12"
            cy="12"
            r="10.35"
            fill="none"
            stroke="url(#innerBevel)"
            strokeWidth="0.75"
          />
          {isEnabled ? (
            <Path
              d="M5.4 6.9 C7.2 4.6 9.2 3.7 11.2 3.55"
              fill="none"
              stroke="#FFFFFF"
              strokeOpacity="0.055"
              strokeWidth="0.7"
              strokeLinecap="round"
            />
          ) : null}
          <AnimatedPath
            animatedProps={checkProps}
            d="M6.7 12.4 L10.15 15.7 L17.55 8.25"
            fill="none"
            stroke="#E6E1D6"
            strokeWidth={2 / svgScale}
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray={CHECK_LENGTH}
          />
        </Svg>

        <Animated.View
          style={[
            styles.innerShadow,
            {
              borderRadius: radius,
              borderWidth: Math.max(1, size * 0.09),
            },
            innerShadowStyle,
          ]}
        />
        <Animated.View
          style={[
            styles.rimShade,
            { borderRadius: radius },
            rimShadeStyle,
          ]}
        />
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    width: TOUCH_TARGET,
    height: TOUCH_TARGET,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glow: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    backgroundColor: '#3A6BFF',
    shadowColor: '#3A6BFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 12,
  },
  innerShadow: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderColor: '#000000',
  },
  rimShade: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderWidth: 1,
    borderColor: '#09090A',
  },
});
