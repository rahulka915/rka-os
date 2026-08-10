import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Line, LinearGradient, Path, Rect, Stop } from 'react-native-svg';
import { getThemeColors, type ThemeColors } from '../theme';
import { focusCurveMidpoints, formatClockTime, type FocusState } from '../utils/focusCurve';

const VIEW_W = 300;
const VIEW_H = 110;
const BASE_Y = 92;
const PEAK_Y = 18;

// Approximates the same hill the SVG path draws, so the "now" dot sits on
// the curve rather than floating above/below it — doesn't need to match the
// bezier exactly, just read as the same shape.
function curveY(elapsedHours: number, peakHours: number, fadeEndHours: number): number {
  if (elapsedHours <= peakHours) {
    const t = peakHours > 0 ? Math.min(1, elapsedHours / peakHours) : 1;
    return BASE_Y - (BASE_Y - PEAK_Y) * (1 - (1 - t) ** 2);
  }
  const t = Math.min(1, (elapsedHours - peakHours) / Math.max(fadeEndHours - peakHours, 0.01));
  return PEAK_Y + (BASE_Y - PEAK_Y) * t ** 1.4;
}

function buildCurvePath(peakHours: number, fadeEndHours: number): string {
  const peakX = (peakHours / fadeEndHours) * VIEW_W;
  const risingCtrl1X = peakX * 0.4;
  const risingCtrl2X = peakX * 0.72;
  const fallingCtrl1X = peakX + (VIEW_W - peakX) * 0.28;
  const fallingCtrl2X = peakX + (VIEW_W - peakX) * 0.62;
  return `M 0 ${BASE_Y} C ${risingCtrl1X} ${BASE_Y} ${risingCtrl2X} ${PEAK_Y} ${peakX} ${PEAK_Y} C ${fallingCtrl1X} ${PEAK_Y} ${fallingCtrl2X} ${BASE_Y} ${VIEW_W} ${BASE_Y}`;
}

const PHASE_LABEL: Record<FocusState['phase'], string> = {
  building: 'Building',
  peak: 'Peak',
  fading: 'Fading',
};

interface FocusTimelineCardProps {
  states: FocusState[];
  isDark: boolean;
}

// One card per currently-active focus-tracked medication (usually just one)
// — an onset/peak/fade curve with a live "now" marker plus a plain-language
// summary, the visual the user referenced from another app's medication
// timeline. Peak and fade-off are real ranges (onset/peak/wear-off vary dose
// to dose), so both are shown as shaded uncertainty bands rather than single
// instants. Renders nothing when no medication currently has an active,
// focus-curve-enabled dose (see `computeFocusState`).
export function FocusTimelineCard({ states, isDark }: FocusTimelineCardProps) {
  const palette = getThemeColors(isDark);
  const [, setTick] = useState(0);

  // Phase and the "now" marker's position both drift purely with wall-clock
  // time — no DB write changes them — so a slow tick keeps the card live
  // while it's on screen instead of freezing at mount time.
  useEffect(() => {
    const id = setInterval(() => setTick((t) => t + 1), 60000);
    return () => clearInterval(id);
  }, []);

  if (states.length === 0) return null;

  return (
    <View style={s.section}>
      <Text style={[s.sectionLabel, { color: palette.textTertiary }]}>FOCUS TIMELINE</Text>
      <View style={s.rows}>
        {states.map((state) => (
          <FocusCurveRow key={state.itemId} state={state} isDark={isDark} palette={palette} />
        ))}
      </View>
    </View>
  );
}

function FocusCurveRow({ state, isDark, palette }: { state: FocusState; isDark: boolean; palette: ThemeColors }) {
  const { medName, dose, phase, elapsedHours, peakMinAt, peakMaxAt, fadeEndMinAt, fadeEndMaxAt, peakMinHours, peakMaxHours, fadeEndMinHours, fadeEndMaxHours } = state;
  const { peakHours, fadeEndHours } = focusCurveMidpoints(state);
  const nowX = (Math.min(elapsedHours, fadeEndHours) / fadeEndHours) * VIEW_W;
  const nowY = curveY(elapsedHours, peakHours, fadeEndHours);
  const gradientId = `focusCurveFill-${state.itemId}`;
  const curvePath = buildCurvePath(peakHours, fadeEndHours);

  const peakMinX = (peakMinHours / fadeEndHours) * VIEW_W;
  const peakMaxX = (peakMaxHours / fadeEndHours) * VIEW_W;
  const fadeMinX = (fadeEndMinHours / fadeEndHours) * VIEW_W;
  const fadeMaxX = (fadeEndMaxHours / fadeEndHours) * VIEW_W;

  const summary =
    phase === 'building'
      ? `Building — peak between ${formatClockTime(peakMinAt)} and ${formatClockTime(peakMaxAt)}`
      : phase === 'peak'
        ? `At peak — fading anytime between ${formatClockTime(fadeEndMinAt)} and ${formatClockTime(fadeEndMaxAt)}`
        : `Fading — should be worn off by ${formatClockTime(fadeEndMaxAt)}`;

  const accent = phase === 'fading' ? palette.textSecondary : palette.vermilion;

  return (
    <View style={[s.card, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: palette.separatorStrong }]}>
      <View style={s.cardHeader}>
        <Text style={[s.medName, { color: palette.text }]} numberOfLines={1}>
          {medName}{dose ? ` · ${dose}` : ''}
        </Text>
        <View style={[s.phaseBadge, { backgroundColor: isDark ? palette.fill : palette.antiqueBrassSoft }]}>
          <Text style={[s.phaseBadgeText, { color: accent }]}>{PHASE_LABEL[phase]}</Text>
        </View>
      </View>
      <Text style={[s.summary, { color: palette.textSecondary }]}>{summary}</Text>

      <Svg width="100%" height={VIEW_H} viewBox={`0 0 ${VIEW_W} ${VIEW_H}`} style={s.svg}>
        <Defs>
          <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={palette.vermilion} stopOpacity={0.32} />
            <Stop offset="1" stopColor={palette.vermilion} stopOpacity={0} />
          </LinearGradient>
        </Defs>
        {/* Peak and fade-off are ranges, not instants — shaded bands show where each could land. */}
        <Rect x={peakMinX} y={0} width={Math.max(peakMaxX - peakMinX, 1)} height={VIEW_H} fill={palette.vermilion} opacity={0.1} />
        <Rect x={fadeMinX} y={0} width={Math.max(fadeMaxX - fadeMinX, 1)} height={VIEW_H} fill={palette.antiqueBrass} opacity={0.12} />
        <Path d={`${curvePath} L ${VIEW_W} ${VIEW_H} L 0 ${VIEW_H} Z`} fill={`url(#${gradientId})`} />
        <Path d={curvePath} fill="none" stroke={palette.antiqueBrass} strokeWidth={2} strokeLinecap="round" />
        <Line x1={nowX} y1={0} x2={nowX} y2={VIEW_H} stroke={palette.separatorStrong} strokeWidth={1} strokeDasharray="2,4" />
        <Circle cx={nowX} cy={nowY} r={4.5} fill={palette.vermilion} stroke={isDark ? palette.bg : palette.surface} strokeWidth={2} />
      </Svg>
    </View>
  );
}

const s = StyleSheet.create({
  section: { marginBottom: 24 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  rows: { gap: 8 },
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 14,
    gap: 4,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  medName: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  phaseBadge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  phaseBadgeText: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  summary: {
    fontSize: 13,
    fontFamily: 'Inter_400Regular',
  },
  svg: {
    marginTop: 6,
  },
});
