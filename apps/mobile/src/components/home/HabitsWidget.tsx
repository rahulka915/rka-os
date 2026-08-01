import { ScrollView, StyleSheet } from 'react-native';
import { updateItemStatus } from '../../db/database';
import { HabitHoldButton } from './HabitHoldButton';
import type { HabitRowData } from '../../utils/habits';

interface HabitsWidgetProps {
  habits: HabitRowData[];
  refresh: () => void;
  isDark: boolean;
}

// Renders nothing at all — no header, no empty state — when there's
// nothing scheduled for today, so Home stays uncluttered on quiet days.
export function HabitsWidget({ habits, refresh, isDark }: HabitsWidgetProps) {
  if (habits.length === 0) return null;

  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.content}
    >
      {habits.map((row) => (
        <HabitHoldButton
          key={row.item.id}
          title={row.item.title}
          streak={row.streak}
          isCompletedToday={row.isCompletedToday}
          isDark={isDark}
          onConfirm={() => {
            updateItemStatus(row.item.id, 'completed');
            refresh();
          }}
        />
      ))}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 12,
    gap: 12,
  },
});
