import { useEffect } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedProps,
  useReducedMotion,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, LinearGradient, Stop } from 'react-native-svg';
import { getThemeColors } from '../../theme';

const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);
const AnimatedHighlight = Reanimated.createAnimatedComponent(Circle);

const VIEWBOX_SIZE = 100;
const RADIUS = 40;
const STROKE_WIDTH = 8;
const CENTER = VIEWBOX_SIZE / 2;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;
// Starts the ring just short of a full loop, like a hand-drawn enso brush
// stroke that never quite closes — matches EnsoLoader's aesthetic.
const GAP_RATIO = 0.06;

export interface EnsoMeterProps {
  /** Current completion from 0 to 1. Values outside the range are clamped. */
  progress: number;
  isDark: boolean;
  /** Pixel diameter of the ring. */
  size?: number;
  /** Overrides the auto-generated "N%" text, e.g. "3 of 5". */
  label?: string;
  /** Small text under the percent, e.g. "Overall Potential". */
  caption?: string;
  fillColor?: string;
  trackColor?: string;
  animate?: boolean;
  duration?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Hero-moment ring progress: an ink-brush stroke that fills in from the same
// start point EnsoLoader spins from, sized for a single prominent reading
// (Overall Potential hero cards) rather than the app-wide default — use
// RiverStoneProgress for compact/list contexts.
export function EnsoMeter({
  progress,
  isDark,
  size = 148,
  label,
  caption,
  fillColor,
  trackColor,
  animate = true,
  duration = 620,
  accessibilityLabel = 'Overall potential',
  style,
  testID,
}: EnsoMeterProps) {
  const palette = getThemeColors(isDark);
  const resolvedFill = fillColor ?? palette.vermilion;
  const resolvedTrack = trackColor ?? palette.separatorStrong;
  const resolvedHighlight = palette.antiqueBrass;

  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const reduceMotion = useReducedMotion();
  const shouldAnimate = animate && !reduceMotion;
  const animatedProgress = useSharedValue(clamped);

  useEffect(() => {
    cancelAnimation(animatedProgress);
    if (shouldAnimate) {
      animatedProgress.value = withTiming(clamped, { duration: Math.max(0, duration), easing: Easing.out(Easing.cubic) });
    } else {
      animatedProgress.value = clamped;
    }
  }, [animatedProgress, clamped, duration, shouldAnimate]);

  const maxDash = CIRCUMFERENCE * (1 - GAP_RATIO);
  const trackProps = useAnimatedProps(() => ({
    strokeDasharray: `${maxDash}, ${CIRCUMFERENCE}`,
  }));
  const fillProps = useAnimatedProps(() => ({
    strokeDasharray: `${maxDash * animatedProgress.value}, ${CIRCUMFERENCE}`,
    opacity: animatedProgress.value <= 0.01 ? 0 : 1,
  }));

  const percentText = label ?? `${Math.round(clamped * 100)}%`;
  // Rotate so the stroke starts at the top and its gap lands at the bottom,
  // matching the enso's brush-stroke opening.
  const rotationDeg = -90 - (GAP_RATIO * 360) / 2;
  const rotationRad = (rotationDeg * Math.PI) / 180;

  // Warm-brass highlight riding the fill's leading edge, same motif as
  // RiverStoneProgress's highlight — computed by hand since Reanimated can't
  // derive cx/cy from a dasharray the way strokeDashoffset math would.
  const highlightProps = useAnimatedProps(() => {
    const sweepAngle = (maxDash * animatedProgress.value * 2 * Math.PI) / CIRCUMFERENCE;
    const angle = rotationRad + sweepAngle;
    return {
      cx: CENTER + RADIUS * Math.cos(angle),
      cy: CENTER + RADIUS * Math.sin(angle),
      opacity: animatedProgress.value <= 0.02 ? 0 : 1,
    };
  });

  return (
    <View
      style={[styles.wrap, { width: size, height: size }, style]}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100), text: percentText }}
      testID={testID}
    >
      <Svg width={size} height={size} viewBox={`0 0 ${VIEWBOX_SIZE} ${VIEWBOX_SIZE}`} accessibilityElementsHidden importantForAccessibility="no">
        <Defs>
          <LinearGradient id="ensoMeterFill" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0" stopColor={resolvedFill} stopOpacity={0.82} />
            <Stop offset="1" stopColor={resolvedFill} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <AnimatedCircle
          animatedProps={trackProps}
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke={resolvedTrack}
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          rotation={rotationDeg}
          origin={`${CENTER}, ${CENTER}`}
        />
        <AnimatedCircle
          animatedProps={fillProps}
          cx={CENTER}
          cy={CENTER}
          r={RADIUS}
          stroke="url(#ensoMeterFill)"
          strokeWidth={STROKE_WIDTH}
          strokeLinecap="round"
          fill="none"
          rotation={rotationDeg}
          origin={`${CENTER}, ${CENTER}`}
        />
        <AnimatedHighlight animatedProps={highlightProps} r={STROKE_WIDTH * 0.42} fill={resolvedHighlight} />
      </Svg>
      <View style={styles.centerCopy} pointerEvents="none">
        <Text style={[styles.percent, { color: palette.text }]} numberOfLines={1}>
          {percentText}
        </Text>
        {caption ? (
          <Text style={[styles.caption, { color: palette.textSecondary }]} numberOfLines={1}>
            {caption}
          </Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', justifyContent: 'center' },
  centerCopy: { position: 'absolute', alignItems: 'center', gap: 2 },
  percent: { fontSize: 26, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  caption: { fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
