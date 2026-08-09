import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { getThemeColors } from '../../theme';
import { RiverStoneSurface } from '../riverstone';
import { EnsoMeter } from '../ui/EnsoMeter';
import { Flag } from '../../icons';

interface JourneySummaryStripProps {
  isDark: boolean;
  potentialPercent: number;
  focusLabel: string | null;
  onPress: () => void;
}

// Compact Overall Potential + Current Focus readout, the first thing on
// Home's Today view now that the Journey hero has been pulled off (see
// git history). Uses EnsoMeter — the same ring the Potential screen's hero
// and the Harada wheel center already use for this exact metric — instead
// of the DailyTrail line this replaced, so "Overall Potential" reads as one
// consistent motif everywhere it appears, not a different shape per screen.
// Sits in RiverStoneSurface (list depth, same tier TasksScreen's rows use)
// rather than a flat backgroundColor+hairline card — this row had the same
// "flat next to the rest of the app" gap already fixed on the Potential/
// Areas/Skills screens.
export function JourneySummaryStrip({ isDark, potentialPercent, focusLabel, onPress }: JourneySummaryStripProps) {
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.75}
      accessibilityRole="button"
      accessibilityLabel={`Overall Potential ${Math.round(potentialPercent)}%${focusLabel ? `, focused on ${focusLabel}` : ''}. Open Potential`}
    >
      <RiverStoneSurface variant="list" mode={isDark ? 'dark' : 'light'} style={styles.wrap} contentStyle={styles.row}>
        <EnsoMeter
          progress={potentialPercent / 100}
          isDark={isDark}
          size={48}
          accessibilityLabel="Overall potential"
        />
        <View style={styles.potentialCopy}>
          <Text style={[styles.label, { color: palette.textTertiary }]}>OVERALL POTENTIAL</Text>
          <View style={styles.focusCopy}>
            <Flag size={13} color={palette.vermilion} strokeWidth={2} />
            <Text style={[styles.focusText, { color: palette.textSecondary }]} numberOfLines={1}>
              {focusLabel ?? 'No focus set'}
            </Text>
          </View>
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrap: {
    marginHorizontal: 12,
    marginTop: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    minHeight: 44,
    gap: 12,
  },
  potentialCopy: { flex: 1, gap: 4 },
  label: { fontSize: 9, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.8 },
  focusCopy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  focusText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold', flexShrink: 1 },
});
