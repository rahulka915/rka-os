import { useEffect } from 'react';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import {
  ENSO_RADIUS,
  ENSO_STROKE_WIDTH,
  ENSO_VIEWBOX_SIZE,
  ensoCircumference,
  ensoDashOffset,
  ensoRotationDegrees,
} from './ensoLoaderMath';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const CIRCUMFERENCE = ensoCircumference(ENSO_RADIUS);
const CYCLE_DURATION_MS = 1600;
const CENTER = ENSO_VIEWBOX_SIZE / 2;

export interface EnsoLoaderProps {
  size?: number;
  color?: string;
}

export function EnsoLoader({ size = 56, color = '#4E9E86' }: EnsoLoaderProps) {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.inOut(Easing.cubic) }),
      -1,
      false
    );
    return () => cancelAnimation(phase);
  }, [phase]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: ensoDashOffset(phase.value, CIRCUMFERENCE),
    rotation: ensoRotationDegrees(phase.value),
  }));

  return (
    <Svg width={size} height={size} viewBox={`0 0 ${ENSO_VIEWBOX_SIZE} ${ENSO_VIEWBOX_SIZE}`}>
      <AnimatedCircle
        cx={CENTER}
        cy={CENTER}
        r={ENSO_RADIUS}
        stroke={color}
        strokeWidth={ENSO_STROKE_WIDTH}
        strokeLinecap="round"
        fill="none"
        strokeDasharray={CIRCUMFERENCE}
        origin={`${CENTER}, ${CENTER}`}
        animatedProps={animatedProps}
      />
    </Svg>
  );
}
