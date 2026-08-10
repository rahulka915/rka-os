import { Fragment } from 'react';
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { getThemeColors } from '../../theme';

const NODE_COUNT = 4;
const VIEWBOX_W = 100;
const VIEWBOX_H = 34;
const CY = 15;
const NODE_R = 11;
const GLYPH_R = 5.6;
const PAD = 13;

type GlyphKey = 'mountain' | 'tree' | 'torii' | 'lotus';
const GLYPH_ORDER: GlyphKey[] = ['mountain', 'tree', 'torii', 'lotus'];

function Glyph({ kind, color, cx, cy }: { kind: GlyphKey; color: string; cx: number; cy: number }) {
  const r = GLYPH_R;
  switch (kind) {
    case 'mountain':
      return (
        <Path
          d={`M${cx - r} ${cy + r * 0.7} L${cx - r * 0.15} ${cy - r * 0.75} L${cx + r * 0.3} ${cy} L${cx + r * 0.55} ${cy - r * 0.35} L${cx + r} ${cy + r * 0.7} Z`}
          fill={color}
        />
      );
    case 'tree':
      return (
        <>
          <Path
            d={`M${cx} ${cy - r} L${cx + r * 0.75} ${cy - r * 0.05} L${cx + r * 0.45} ${cy - r * 0.05} L${cx + r * 0.85} ${cy + r * 0.55} L${cx - r * 0.85} ${cy + r * 0.55} L${cx - r * 0.45} ${cy - r * 0.05} L${cx - r * 0.75} ${cy - r * 0.05} Z`}
            fill={color}
          />
          <Path d={`M${cx - r * 0.16} ${cy + r * 0.55} L${cx + r * 0.16} ${cy + r * 0.55} L${cx + r * 0.12} ${cy + r} L${cx - r * 0.12} ${cy + r} Z`} fill={color} />
        </>
      );
    case 'torii':
      return (
        <>
          <Path d={`M${cx - r} ${cy - r * 0.65} L${cx + r} ${cy - r * 0.65} L${cx + r} ${cy - r * 0.15} L${cx - r} ${cy - r * 0.15} Z`} fill={color} />
          <Path d={`M${cx - r * 0.75} ${cy - r * 0.1} L${cx + r * 0.75} ${cy - r * 0.1} L${cx + r * 0.75} ${cy + r * 0.15} L${cx - r * 0.75} ${cy + r * 0.15} Z`} fill={color} />
          <Path d={`M${cx - r * 0.65} ${cy - r * 0.55} L${cx - r * 0.85} ${cy + r} L${cx - r * 0.42} ${cy + r} L${cx - r * 0.3} ${cy - r * 0.05} Z`} fill={color} />
          <Path d={`M${cx + r * 0.65} ${cy - r * 0.55} L${cx + r * 0.85} ${cy + r} L${cx + r * 0.42} ${cy + r} L${cx + r * 0.3} ${cy - r * 0.05} Z`} fill={color} />
        </>
      );
    case 'lotus':
    default:
      return (
        <>
          <Circle cx={cx} cy={cy - r * 0.3} r={r * 0.4} fill={color} />
          <Circle cx={cx - r * 0.65} cy={cy + r * 0.15} r={r * 0.38} fill={color} />
          <Circle cx={cx + r * 0.65} cy={cy + r * 0.15} r={r * 0.38} fill={color} />
          <Circle cx={cx} cy={cy + r * 0.3} r={r * 0.42} fill={color} />
        </>
      );
  }
}

export interface DailyTrailProps {
  /** Today's completion ratio, 0 to 1. */
  progress: number;
  isDark: boolean;
  label?: string;
  showLabel?: boolean;
  accessibilityLabel?: string;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

// Journey-scene-only progress: a trail of four milestone glyphs (mountain,
// tree, shrine, lotus) that light up as today's completion ratio crosses
// each 25% checkpoint. Purely decorative per-node meaning — reserved for the
// Journey scene, not a general-purpose stage indicator (use SteppingStones
// for that).
export function DailyTrail({
  progress,
  isDark,
  label,
  showLabel = true,
  accessibilityLabel = "Today's journey progress",
  style,
  testID,
}: DailyTrailProps) {
  const palette = getThemeColors(isDark);
  const clamped = Math.max(0, Math.min(1, Number.isFinite(progress) ? progress : 0));
  const percentText = label ?? `${Math.round(clamped * 100)}%`;

  const litColor = palette.vermilion;
  const dimColor = isDark ? palette.fillStrong : palette.separatorStrong;
  const lineColor = isDark ? palette.separatorStrong : palette.separator;
  const nodeBg = isDark ? palette.bg : palette.surface;

  const span = VIEWBOX_W - PAD * 2;
  const spacing = span / (NODE_COUNT - 1);
  const centers = GLYPH_ORDER.map((_, i) => PAD + i * spacing);
  const litUpTo = Math.floor(clamped * (NODE_COUNT - 1) + 1e-6);

  return (
    <View
      style={style}
      testID={testID}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100), text: percentText }}
    >
      <Svg width="100%" height={44} viewBox={`0 0 ${VIEWBOX_W} ${VIEWBOX_H}`} preserveAspectRatio="none" accessibilityElementsHidden importantForAccessibility="no">
        <Line x1={centers[0]} y1={CY} x2={centers[NODE_COUNT - 1]} y2={CY} stroke={lineColor} strokeWidth={1.4} />
        <Line
          x1={centers[0]}
          y1={CY}
          x2={centers[0] + (centers[NODE_COUNT - 1] - centers[0]) * clamped}
          y2={CY}
          stroke={litColor}
          strokeWidth={1.8}
        />
        {GLYPH_ORDER.map((kind, i) => {
          const lit = i <= litUpTo;
          const color = lit ? litColor : dimColor;
          return (
            <Fragment key={kind}>
              <Circle cx={centers[i]} cy={CY} r={NODE_R} fill={nodeBg} stroke={color} strokeWidth={lit ? 2 : 1.4} />
              <Glyph kind={kind} color={color} cx={centers[i]} cy={CY} />
            </Fragment>
          );
        })}
      </Svg>
      {showLabel && (
        <Text style={[styles.label, { color: palette.text }]} numberOfLines={1}>
          {percentText} · Path progress
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  label: { marginTop: 4, fontSize: 12, fontWeight: '700', fontFamily: 'Inter_700Bold', textAlign: 'center' },
});
