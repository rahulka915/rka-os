import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { LacquerDiscControl } from '../ui/LacquerDiscControl';
import { BlockedBadge } from '../BlockedBadge';
import { DeadlineBadge } from '../DeadlineBadge';
import { RepeatBadge } from '../RepeatBadge';
import { getBlockingTask } from '../../db/database';
import { getThemeColors } from '../../theme';
import { readChecklist, checklistProgress } from '../../utils/checklist';
import type { Item } from '../../db/types';

interface HomeTaskRowProps {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  projectTitle: string | null;
  isCompleting: boolean;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onLongPress: (item: Item) => void;
}

function checklistLabel(item: Item): string | null {
  const entries = readChecklist(item.metadata ? JSON.parse(item.metadata) : {});
  if (!entries.length) return null;
  const { done, total } = checklistProgress(entries);
  return `${done}/${total}`;
}

// Same visual language as TasksScreen's TaskRow (checkbox, project subtitle,
// blocked/deadline/repeat badges) so Home's Anytime/Upcoming/Someday tabs
// are a real substitute for opening the full Tasks/Upcoming screens, not a
// stripped-down preview. Deliberately without the drag-handle and
// dependency-connector overlay — those are reorder-specific to the dedicated
// Tasks screen and don't apply to a read-mostly Home tab.
export function HomeTaskRow({ item, isDark, palette, projectTitle, isCompleting, onComplete, onOpen, onLongPress }: HomeTaskRowProps) {
  const blocker = getBlockingTask(item.id);
  return (
    <View style={[styles.row, { backgroundColor: palette.surface }]}>
      <LacquerDiscControl
        isCompleted={isCompleting}
        accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
        onToggle={() => onComplete(item)}
      />
      <TouchableOpacity
        style={styles.rowContent}
        activeOpacity={0.7}
        onPress={() => onOpen(item)}
        onLongPress={() => onLongPress(item)}
        delayLongPress={400}
      >
        <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.text }]} numberOfLines={1}>
          {item.title}
        </Text>
        {projectTitle && (
          <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>{projectTitle}</Text>
        )}
        {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
        {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
        {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
        {checklistLabel(item) && (
          <Text style={[styles.rowSub, { color: palette.textTertiary }]}>{checklistLabel(item)}</Text>
        )}
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  rowContent: {
    flex: 1,
    minHeight: 44,
    justifyContent: 'center',
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
});
