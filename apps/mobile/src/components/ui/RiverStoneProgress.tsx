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
import Svg, { Circle, Defs, LinearGradient, Rect, Stop } from 'react-native-svg';
import { getThemeColors } from '../../theme';

const AnimatedRect = Reanimated.createAnimatedComponent(Rect);
const AnimatedCircle = Reanimated.createAnimatedComponent(Circle);

// Track units are relative (0-100 wide) so the bar stretches to fill
// whatever width its parent gives it; TRACK_HEIGHT_UNITS controls how
// "thick" the rounded ends look relative to that width, independent of the
// pixel height set via the `height` prop.
const TRACK_HEIGHT_UNITS = 8;

export interface RiverStoneProgressMilestone {
  /** 0-1 position along the track. */
  at: number;
  reached?: boolean;
}

export interface RiverStoneProgressProps {
  /** Current completion from 0 to 1. Values outside the range are clamped. */
  progress: number;
  isDark: boolean;
  /** Pixel height of the track. */
  height?: number;
  /** Overrides the auto-generated "N%" text, e.g. "3 of 5". */
  label?: string;
  /** Set false to hide the trailing percentage/label text entirely. */
  showLabel?: boolean;
  /** Small tick markers along the track, e.g. weekly targets. */
  milestones?: RiverStoneProgressMilestone[];
  fillColor?: string;
  trackColor?: string;
  highlightColor?: string;
  animate?: boolean;
  duration?: number;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// The standard RKA progress indicator: a recessed River Stone track with a
// restrained vermilion fill and a warm-brass highlight riding the fill's
// leading edge. Use this for Overall Potential, Domain/Pillar scores,
// habits, and any other measurable value — the katana blade (KatanaProgress)
// is reserved for rare Journey milestones, major achievements, or completion
// celebrations where its symbolism is deliberate, not a default progress bar.
export function RiverStoneProgress({
  progress,
  isDark,
  height = 10,
  label,
  showLabel = true,
  milestones,
  fillColor,
  trackColor,
  highlightColor,
  animate = true,
  duration = 420,
  accessibilityLabel = 'Progress',
  style,
  testID,
}: RiverStoneProgressProps) {
  const palette = getThemeColors(isDark);
  const resolvedFill = fillColor ?? palette.vermilion;
  const resolvedTrack = trackColor ?? (isDark ? palette.stoneSurface : palette.separator);
  const resolvedHighlight = highlightColor ?? palette.antiqueBrass;

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

  const fillProps = useAnimatedProps(() => ({
    width: Math.max(TRACK_HEIGHT_UNITS, animatedProgress.value * 100),
  }));
  const highlightProps = useAnimatedProps(() => ({
    cx: Math.max(TRACK_HEIGHT_UNITS / 2, animatedProgress.value * 100),
    opacity: animatedProgress.value <= 0.02 ? 0 : 1,
  }));

  const percentText = label ?? `${Math.round(clamped * 100)}%`;
  const radius = TRACK_HEIGHT_UNITS / 2;

  return (
    <View style={[styles.row, style]} testID={testID}>
      <View
        accessible
        accessibilityRole="progressbar"
        accessibilityLabel={accessibilityLabel}
        accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100), text: percentText }}
        style={[styles.track, { height }]}
      >
        <Svg
          width="100%"
          height="100%"
          viewBox={`0 0 100 ${TRACK_HEIGHT_UNITS}`}
          preserveAspectRatio="none"
          accessibilityElementsHidden
          importantForAccessibility="no"
        >
          <Defs>
            <LinearGradient id="riverStoneFill" x1="0" y1="0" x2="1" y2="0">
              <Stop offset="0" stopColor={resolvedFill} stopOpacity={0.86} />
              <Stop offset="1" stopColor={resolvedFill} stopOpacity={1} />
            </LinearGradient>
          </Defs>

          {/* Recessed track — a base fill plus a thin darker top edge and lighter
              bottom edge fake an inset/concave groove without native inner shadows. */}
          <Rect x={0} y={0} width={100} height={TRACK_HEIGHT_UNITS} rx={radius} fill={resolvedTrack} />
          <Rect x={0.5} y={0.4} width={99} height={1} rx={0.5} fill="rgba(0,0,0,0.22)" />
          <Rect x={0.5} y={TRACK_HEIGHT_UNITS - 1.2} width={99} height={0.9} rx={0.45} fill="rgba(255,255,255,0.06)" />

          <AnimatedRect
            animatedProps={fillProps}
            x={0}
            y={0}
            height={TRACK_HEIGHT_UNITS}
            rx={radius}
            fill="url(#riverStoneFill)"
          />

          {milestones?.map((m, i) => {
            const x = Math.max(0.5, Math.min(99.5, m.at * 100));
            return (
              <Rect
                key={i}
                x={x - 0.5}
                y={1}
                width={1}
                height={TRACK_HEIGHT_UNITS - 2}
                fill={m.reached ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.22)'}
              />
            );
          })}

          {/* Warm-brass highlight riding the fill's leading edge. */}
          <AnimatedCircle animatedProps={highlightProps} cy={TRACK_HEIGHT_UNITS / 2} r={radius * 0.72} fill={resolvedHighlight} />
        </Svg>
      </View>
      {showLabel && (
        <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
          {percentText}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  track: {
    flex: 1,
    justifyContent: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
});
