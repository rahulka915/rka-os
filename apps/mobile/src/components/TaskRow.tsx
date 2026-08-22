import { memo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { ScaleDecorator, ShadowDecorator } from 'react-native-draggable-flatlist';
import { RiverStoneSurface } from './riverstone';
import { LacquerDiscControl } from './ui/LacquerDiscControl';
import { getBlockingTask } from '../db/database';
import { getThemeColors } from '../theme';
import { MoreHorizontal } from '../icons';
import { BlockedBadge } from './BlockedBadge';
import { DeadlineBadge } from './DeadlineBadge';
import { RepeatBadge } from './RepeatBadge';
import { DependencyConnector } from './DependencyConnector';
import { readChecklist, checklistProgress } from '../utils/checklist';
import type { Item } from '../db/types';

// Item-local, so it never makes a row's height depend on list position.
function checklistLabel(item: Item): string | null {
  const entries = readChecklist(item.metadata ? JSON.parse(item.metadata) : {});
  if (!entries.length) return null;
  const { done, total } = checklistProgress(entries);
  return `${done}/${total}`;
}

const CHECKBOX_CENTER_X = 32; // row paddingHorizontal(10) + half the 44pt disc touch target

// The single shared task-row look-and-feel — originally TasksScreen's own
// TaskRow, extracted so any other screen showing tasks (Home's Today card)
// renders the exact same component rather than a hand-copied lookalike that
// can drift out of sync. Anything that shows tasks in a drag-reorderable
// list should use this, not a bespoke row.
export const TaskRow = memo(function TaskRow({
  item,
  isDark,
  palette,
  projectTitle,
  showConnector,
  isCompleting,
  isActive,
  dragEnabled,
  drag,
  onComplete,
  onOpen,
  onMoreActions,
  onMoveUp,
  onMoveDown,
}: {
  item: Item;
  isDark: boolean;
  palette: ReturnType<typeof getThemeColors>;
  projectTitle: string | null;
  showConnector: boolean;
  isCompleting: boolean;
  isActive: boolean;
  dragEnabled: boolean;
  drag: () => void;
  onComplete: (item: Item) => void;
  onOpen: (item: Item) => void;
  onMoreActions: (item: Item) => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
}) {
  const blocker = getBlockingTask(item.id);
  return (
    <ScaleDecorator activeScale={1.015}>
      <ShadowDecorator elevation={8} opacity={0.3} radius={10} color="#000000">
        <View style={styles.cell}>
          {showConnector && <DependencyConnector isDark={isDark} leftOffset={CHECKBOX_CENTER_X} />}
          {/* Whole row lifts on a hold, matching Reminders/Things — the
              checkbox and "more" button are nested touch targets that claim
              their own taps first, so they never trigger the row's drag.
              Long-press is a no-op (not just visually disabled) whenever a
              non-manual sort is active, since sort order overrides drag. */}
          <TouchableOpacity
            activeOpacity={0.85}
            onPress={() => onOpen(item)}
            onLongPress={dragEnabled ? drag : undefined}
            delayLongPress={350}
            disabled={isActive}
          >
            <RiverStoneSurface
              variant="list"
              mode={isDark ? 'dark' : 'light'}
              shape="regular"
              style={styles.rowStone}
              contentStyle={styles.row}
            >
              <LacquerDiscControl
                isCompleted={isCompleting}
                accessibilityLabel={blocker ? `${item.title}, blocked by ${blocker.title}` : `Complete ${item.title}`}
                onToggle={() => onComplete(item)}
              />
              <View style={styles.rowContent}>
                <Text style={[styles.rowTitle, { color: blocker ? palette.textMuted : palette.ivory }]} numberOfLines={1}>{item.title}</Text>
                {/* Always rendered, even when empty — a row whose meta line
                    only appears for SOME items is exactly the variable-height
                    mix that desyncs the drag library's cached row offsets
                    (the cause of the overlap/gap glitches). Reserving this
                    slot unconditionally keeps every row's total height
                    identical regardless of content. */}
                <View style={styles.metaRow}>
                  {projectTitle && (
                    <Text style={[styles.rowSub, { color: palette.greige }]} numberOfLines={1}>{projectTitle}</Text>
                  )}
                  {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
                  {item.dueDate && <DeadlineBadge isDark={isDark} dueDate={item.dueDate} />}
                  {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
                  {checklistLabel(item) && (
                    <Text style={[styles.rowSub, { color: palette.greige }]}>{checklistLabel(item)}</Text>
                  )}
                </View>
              </View>
              <TouchableOpacity
                onPress={() => onMoreActions(item)}
                hitSlop={10}
                style={styles.moreButton}
                accessible
                accessibilityLabel="More actions"
                accessibilityHint={dragEnabled ? 'Opens actions for this task. Use the increment or decrement actions to reorder it.' : 'Opens actions for this task.'}
                accessibilityRole="button"
                accessibilityActions={dragEnabled ? [
                  { name: 'increment', label: 'Move up' },
                  { name: 'decrement', label: 'Move down' },
                ] : undefined}
                onAccessibilityAction={dragEnabled ? (event) => {
                  if (event.nativeEvent.actionName === 'increment') onMoveUp();
                  else if (event.nativeEvent.actionName === 'decrement') onMoveDown();
                } : undefined}
              >
                <MoreHorizontal size={20} color={palette.textMuted} strokeWidth={2} />
              </TouchableOpacity>
            </RiverStoneSurface>
          </TouchableOpacity>
        </View>
      </ShadowDecorator>
    </ScaleDecorator>
  );
});

const styles = StyleSheet.create({
  // Uniform gap on EVERY cell (was a conditional spacer) so row height never
  // depends on list order — the connector that used to occupy this space is
  // now a zero-layout overlay. position:relative anchors that overlay.
  cell: {
    position: 'relative',
    marginBottom: 6,
  },
  rowStone: {
    // RiverStoneSurface owns the clip/shape; this wrapper just carries the
    // ambient/contact shadow layers from `container` outward.
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  // Fixed, not minHeight — every row (title + metaRow, whether or not the
  // meta row has anything in it) must measure identically for the drag
  // library's cached row offsets to stay in sync. See the metaRow comment
  // at its usage site.
  rowContent: {
    flex: 1,
    height: 44,
    justifyContent: 'center',
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 16,
    overflow: 'hidden',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  moreButton: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
