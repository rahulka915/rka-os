import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getThemeColors } from '../../theme';
import { KatanaProgress } from '../ui/KatanaProgress';
import { Flag } from '../../icons';

interface JourneySummaryStripProps {
  isDark: boolean;
  potentialPercent: number;
  focusLabel: string | null;
  onPress: () => void;
}

// Compact Overall Potential + Current Focus readout below the Journey hero
// card — the piece of the Journey overview that the hero card itself
// intentionally doesn't carry (it's about today's task completion, not
// Domain scoring). Tapping opens Potential, same destination as the Menu
// tile, so this is a shortcut rather than a new data source.
export function JourneySummaryStrip({ isDark, potentialPercent, focusLabel, onPress }: JourneySummaryStripProps) {
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      style={[styles.row, { backgroundColor: isDark ? palette.fillStrong : palette.surface, borderColor: palette.separatorStrong }]}
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Overall Potential ${Math.round(potentialPercent)}%${focusLabel ? `, focused on ${focusLabel}` : ''}. Open Potential`}
    >
      <View style={styles.potentialCopy}>
        <Text style={[styles.label, { color: palette.textTertiary }]}>OVERALL POTENTIAL</Text>
        <View style={styles.percentRow}>
          <Text style={[styles.percent, { color: palette.text }]}>{Math.round(potentialPercent)}%</Text>
          <KatanaProgress progress={potentialPercent / 100} size={14} accessibilityLabel="Overall potential" style={styles.progress} />
        </View>
      </View>
      <View style={[styles.divider, { backgroundColor: palette.separatorStrong }]} />
      <View style={styles.focusCopy}>
        <Flag size={14} color={palette.vermilion} strokeWidth={2} />
        <Text style={[styles.focusText, { color: palette.textSecondary }]} numberOfLines={1}>
          {focusLabel ?? 'No focus set'}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 12,
    marginTop: 8,
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 44,
    gap: 12,
  },
  potentialCopy: { flex: 1.3, gap: 4 },
  label: { fontSize: 9, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.8 },
  percentRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  percent: { fontSize: 16, fontWeight: '700', fontFamily: 'Inter_700Bold' },
  progress: { flex: 1 },
  divider: { width: StyleSheet.hairlineWidth, alignSelf: 'stretch' },
  focusCopy: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 6 },
  focusText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
});
