import { View, Text, StyleSheet } from 'react-native';
import { Repeat } from '../icons';
import { getThemeColors } from '../theme';
import { repeatLabel } from '../utils/repeat';

interface RepeatBadgeProps {
  isDark: boolean;
  rrule: string;
}

// Repeat indicator for a task row. Derived only from the item's own rrule, so
// row height stays a pure function of the item (required by drag-to-reorder —
// see useHapticReorder).
export function RepeatBadge({ isDark, rrule }: RepeatBadgeProps) {
  const palette = getThemeColors(isDark);
  const label = repeatLabel(rrule);
  if (!label) return null;
  return (
    <View style={styles.row}>
      <Repeat size={11} color={palette.textTertiary} strokeWidth={2} />
      <Text style={[styles.text, { color: palette.textTertiary }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  text: { fontFamily: 'Inter_500Medium', fontSize: 12, fontWeight: '500', flexShrink: 1 },
});
