import { View, Text, StyleSheet } from 'react-native';
import { Flag } from '../icons';
import { getThemeColors } from '../theme';
import { formatDate } from '../db/database';
import { deadlineStatus } from '../utils/deadline';

interface DeadlineBadgeProps {
  isDark: boolean;
  dueDate: string;
}

// Deadline indicator for a task row. Derived only from the item's own dueDate,
// so a row's height never depends on its position in the list (required by
// drag-to-reorder — see useHapticReorder).
export function DeadlineBadge({ isDark, dueDate }: DeadlineBadgeProps) {
  const palette = getThemeColors(isDark);
  const status = deadlineStatus(dueDate, formatDate(new Date()));
  if (!status) return null;

  const color = status.tone === 'overdue' || status.tone === 'today' ? palette.red : palette.textTertiary;

  return (
    <View style={styles.row}>
      <Flag size={11} color={color} strokeWidth={2} />
      <Text style={[styles.text, { color }]} numberOfLines={1}>{status.label}</Text>
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
    fontWeight: '500',
    flexShrink: 1,
  },
});
