import { View, Text, StyleSheet } from 'react-native';
import { Lock } from '../icons';
import { getThemeColors } from '../theme';

interface BlockedBadgeProps {
  isDark: boolean;
  title: string;
}

// Small subtitle shown under a task row that's waiting on another task —
// the fallback indicator when the two rows aren't adjacent enough to draw
// a DependencyConnector between them.
export function BlockedBadge({ isDark, title }: BlockedBadgeProps) {
  const palette = getThemeColors(isDark);
  return (
    <View style={styles.row}>
      <Lock size={11} color={palette.textTertiary} strokeWidth={2} />
      <Text style={[styles.text, { color: palette.textTertiary }]} numberOfLines={1}>
        Blocked by {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 2,
  },
  text: {
    fontSize: 12,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
    flexShrink: 1,
  },
});
