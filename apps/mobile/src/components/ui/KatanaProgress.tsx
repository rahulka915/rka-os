import { useEffect, useId, useMemo, useRef } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  G,
  LinearGradient,
  Path,
  Polygon,
  RadialGradient,
  Rect,
  Stop,
} from 'react-native-svg';

import {
  clampKatanaProgress,
  resolveKatanaHeight,
  resolveKatanaWidth,
  type KatanaProgressSize,
} from './katanaProgressMath';

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

const VIEWBOX_WIDTH = 320;
const VIEWBOX_HEIGHT = 64;
const BLADE_START = 102;
const BLADE_TIP = 310;
const POLISH_WIDTH = 54;

const BLADE_PATH = [
  `M ${BLADE_START} 22`,
  'C 154 21.5 222 22 294 21.5',
  'C 302 21.4 307 19.4 312 16.5',
  'C 309 24.5 303 29 294 30.5',
  `L ${BLADE_START} 32`,
  'Z',
].join(' ');

export interface KatanaProgressProps {
  /** Current completion from 0 to 1. Values outside the range are clamped. */
  progress: number;
  /** Fixed height token, or `hero` to fill the parent width at 48pt high. */
  size?: KatanaProgressSize;
  /** Animates progress changes unless the system Reduce Motion setting is active. */
  animate?: boolean;
  /** Duration of progress updates in milliseconds. */
  duration?: number;
  /** Total fade duration of the one-time completion glint in milliseconds. */
  glintDuration?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

export function KatanaProgress({
  progress,
  size = 24,
  animate = true,
  duration = 320,
  glintDuration = 460,
  accessibilityLabel = 'Progress',
  style,
  testID,
}: KatanaProgressProps) {
  const clamped = clampKatanaProgress(progress);
  const height = resolveKatanaHeight(size);
  const width = resolveKatanaWidth(size);
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animate && !reduceMotion;
  const animatedProgress = useSharedValue(clamped);
  const glintOpacity = useSharedValue(0);
  const previousProgress = useRef(clamped);
  const id = useId().replace(/:/g, '');

  const ids = useMemo(
    () => ({
      blade: `katana-blade-${id}`,
      bladeClip: `katana-blade-clip-${id}`,
      collar: `katana-collar-${id}`,
      guard: `katana-guard-${id}`,
      handle: `katana-handle-${id}`,
      polish: `katana-polish-${id}`,
      tipGlint: `katana-tip-glint-${id}`,
    }),
    [id]
  );

  useEffect(() => {
    cancelAnimation(animatedProgress);
    cancelAnimation(glintOpacity);

    if (shouldAnimate) {
      animatedProgress.value = withTiming(clamped, {
        duration: Math.max(0, duration),
        easing: Easing.out(Easing.cubic),
      });
    } else {
      animatedProgress.value = clamped;
    }

    const reachedCompletion = previousProgress.current < 1 && clamped === 1;
    if (shouldAnimate && reachedCompletion) {
      const riseDuration = Math.round(glintDuration * 0.3);
      const fadeDuration = Math.max(0, glintDuration - riseDuration);
      glintOpacity.value = withDelay(
        Math.max(0, duration),
        withSequence(
          withTiming(1, {
            duration: riseDuration,
            easing: Easing.out(Easing.cubic),
          }),
          withTiming(0, {
            duration: fadeDuration,
            easing: Easing.out(Easing.cubic),
          })
        )
      );
    } else {
      glintOpacity.value = 0;
    }

    previousProgress.current = clamped;
  }, [animatedProgress, clamped, duration, glintDuration, glintOpacity, shouldAnimate]);

  const polishProps = useAnimatedProps(() => {
    const travel = BLADE_TIP - BLADE_START;
    return {
      x: BLADE_START + travel * animatedProgress.value - POLISH_WIDTH / 2,
      opacity: animatedProgress.value <= 0.001 ? 0 : 1,
    };
  });

  const glintProps = useAnimatedProps(() => ({
    opacity: glintOpacity.value,
  }));

  const percentage = Math.round(clamped * 100);

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: percentage, text: `${percentage}%` }}
      style={[styles.container, { width, height }, style]}
      testID={testID}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${VIEWBOX_WIDTH} ${VIEWBOX_HEIGHT}`}
        preserveAspectRatio="xMidYMid meet"
        accessibilityElementsHidden
        importantForAccessibility="no"
      >
        <Defs>
          <LinearGradient id={ids.handle} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#242425" />
            <Stop offset="0.46" stopColor="#0e0f10" />
            <Stop offset="1" stopColor="#050607" />
          </LinearGradient>
          <LinearGradient id={ids.blade} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor="#faf9f6" />
            <Stop offset="0.24" stopColor="#c9c9c6" />
            <Stop offset="0.52" stopColor="#f0efeb" />
            <Stop offset="0.78" stopColor="#a8aaab" />
            <Stop offset="1" stopColor="#e2e1dd" />
          </LinearGradient>
          <LinearGradient id={ids.collar} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor="#f3f1ec" />
            <Stop offset="0.42" stopColor="#949698" />
            <Stop offset="0.7" stopColor="#d7d6d2" />
            <Stop offset="1" stopColor="#747779" />
          </LinearGradient>
          <LinearGradient id={ids.guard} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#77797a" />
            <Stop offset="0.5" stopColor="#e7e5df" />
            <Stop offset="1" stopColor="#77797a" />
          </LinearGradient>
          <LinearGradient id={ids.polish} x1="0" y1="0" x2="1" y2="0">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0} />
            <Stop offset="0.33" stopColor="#dce8f4" stopOpacity={0.12} />
            <Stop offset="0.5" stopColor="#f9fbfc" stopOpacity={0.78} />
            <Stop offset="0.61" stopColor="#8fc8ff" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
          </LinearGradient>
          <RadialGradient id={ids.tipGlint} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#ffffff" stopOpacity={0.96} />
            <Stop offset="0.26" stopColor="#d8edff" stopOpacity={0.76} />
            <Stop offset="0.62" stopColor="#2f8fff" stopOpacity={0.24} />
            <Stop offset="1" stopColor="#2f8fff" stopOpacity={0} />
          </RadialGradient>
          <ClipPath id={ids.bladeClip}>
            <Path d={BLADE_PATH} />
          </ClipPath>
        </Defs>

        <G>
          <Rect x={6} y={22} width={84} height={20} rx={5} fill={`url(#${ids.handle})`} />
          <Rect x={4} y={23.5} width={8} height={17} rx={4} fill={`url(#${ids.collar})`} />
          <Path d="M 11 25.5 H 87" stroke="rgba(255,255,255,0.12)" strokeWidth={1} />
          {[26, 39, 52, 65, 78].map((centerX) => (
            <Polygon
              key={centerX}
              points={`${centerX},26 ${centerX + 4},32 ${centerX},38 ${centerX - 4},32`}
              fill="#e8e2d8"
              opacity={0.92}
            />
          ))}
          <Rect x={87} y={21.5} width={11} height={21} rx={2} fill={`url(#${ids.collar})`} />
          <Rect x={98} y={13} width={4.5} height={38} rx={2.25} fill={`url(#${ids.guard})`} />
          <Rect x={96.5} y={14} width={1} height={36} rx={0.5} fill="rgba(255,255,255,0.24)" />
        </G>

        <Path d={BLADE_PATH} fill={`url(#${ids.blade})`} />
        <Path
          d="M 104 24 C 166 23.5 235 24 298 23.2"
          stroke="rgba(255,255,255,0.50)"
          strokeWidth={0.8}
          fill="none"
        />
        <Path
          d="M 104 30.6 C 172 30.2 235 30.3 294 29.2"
          stroke="rgba(58,63,68,0.36)"
          strokeWidth={0.8}
          fill="none"
        />

        <AnimatedRect
          animatedProps={polishProps}
          y={17}
          width={POLISH_WIDTH}
          height={20}
          fill={`url(#${ids.polish})`}
          clipPath={`url(#${ids.bladeClip})`}
        />

        <AnimatedCircle
          animatedProps={glintProps}
          cx={307}
          cy={22.5}
          r={9}
          fill={`url(#${ids.tipGlint})`}
        />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignSelf: 'center',
    justifyContent: 'center',
  },
});
