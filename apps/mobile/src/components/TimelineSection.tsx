import { useCallback, useEffect, useState, memo } from 'react';
import { Alert, View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { NestedReorderableList } from 'react-native-reorderable-list';
import { useVerticalDragGesture } from './ui/dragFeel';
import { SwipeableItem } from './SwipeableItem';
import { ContextMenu } from './ContextMenu';
import type { Item } from '../db/types';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors, type ThemeColors } from '../theme';
import { TimeIcon } from './icons/TimeIcon';
import { RiverStoneSurface } from './riverstone';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from './ui/LacquerDiscControl';
import { DragHandleButton } from './ui/DragHandleButton';
import { BlockedBadge } from './BlockedBadge';
import { RepeatBadge } from './RepeatBadge';
import { getBlockingTask, applyManualOrder } from '../db/database';
import { promptSetDependency } from '../utils/dependencyPrompt';
import { useHapticReorder } from '../hooks/useHapticReorder';


// Bold palette — richer saturation than the muted/sunrise options explored
// during design review, picked for max contrast between time blocks. Dark
// variants are brightened per-color (not just alpha'd) to stay legible on
// the dark bg rather than reusing the light-mode hex.
const timeBlockColors = {
  light: { anytime: '#6E6E6E', morning: '#E0A73D', afternoon: '#D65A2E', evening: '#2A2A72' },
  dark: { anytime: '#a8a8a8', morning: '#F0BE5E', afternoon: '#F07850', evening: '#6D6DD6' },
};

export interface TimelineSectionProps {
  todayItems: Item[];
  anytime: Item[];
  morning: Item[];
  afternoon: Item[];
  evening: Item[];
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemActivate?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  // Re-fetches Home's item data — needed after setting/clearing a task
  // dependency, since TimelineSection only renders whatever items/anytime/
  // morning/etc. props Home last passed down, it doesn't own that data.
  onDependencyChanged?: () => void;
  onTimeBlockAction?: (block: TimeBlockType, action: string) => void;
  // Lets Home shrink/grow each collapsed row (and its icon) to exactly fill
  // whatever space is left between the header and the bottom tray on the
  // current device, so the page fits without scrolling. Undefined falls
  // back to the natural/default size.
  rowHeight?: number;
}

export const TIMELINE_ROW_COUNT = 4;
export const NATURAL_ROW_HEIGHT = 72; // icon(40) + blockHeader paddingVertical(16)*2
export const MIN_ROW_HEIGHT = 56;
export const MAX_ROW_HEIGHT = 140;
export const ROW_GAP = 8; // blockHeaderWrap marginBottom
const MIN_ICON_SIZE = 28;
const ICON_ROW_MARGIN = 4;
const ICON_ASPECT_RATIO = 1.5;

export type TimeBlockType = 'anytime' | 'morning' | 'afternoon' | 'evening';

interface TimeBlockData {
  key: TimeBlockType;
  label: string;
  period: 'anytime' | 'morning' | 'afternoon' | 'evening';
  color: string;
  items: Item[];
}

function TimeBlockCompletionControl({
  item,
  blockedByTitle,
  onComplete,
}: {
  item: Item;
  blockedByTitle?: string;
  onComplete?: (id: string) => void;
}) {
  const [isCompleted, setIsCompleted] = useState(false);

  return (
    <LacquerDiscControl
      isCompleted={isCompleted}
      accessibilityLabel={blockedByTitle ? `${item.title}, blocked by ${blockedByTitle}` : `Complete ${item.title}`}
      onToggle={() => {
        if (isCompleted) return;
        if (blockedByTitle) {
          onComplete?.(item.id);
          return;
        }
        setIsCompleted(true);
        setTimeout(() => onComplete?.(item.id), LACQUER_DISC_COMPLETION_DURATION);
      }}
    />
  );
}

// Alpha-blends a hex color for chip/row tints — RN has no native rgba(#hex, a).
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

// Extracted to its own memo'd component because useReorderableDrag (inside
// DragHandleButton) only works within a list item component. Memoising also
// means unrelated parent re-renders (the usePersistentTimerState `now` tick)
// no longer reach every row mid-drag.
//
// Every row here is exactly uniform height (fixed row + an always-present
// bottom hairline; the "blocked" badge is keyed to the item's own blocker,
// not adjacency), so drag-reorder never changes a cell's measured box. The
// inter-row dependency-connector line is intentionally omitted in this
// dense, gap-less timeline list (it needs gap space to live in that the
// list doesn't have); the badge carries the "blocked" signal here.
const TimelineTaskRow = memo(function TimelineTaskRow({
  item,
  isDark,
  palette,
  onItemTap,
  onItemComplete,
  onItemActivate,
  onItemArchive,
  onLongPress,
}: {
  item: Item;
  isDark: boolean;
  palette: ThemeColors;
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemActivate?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onLongPress: (item: Item) => void;
}) {
  const blocker = getBlockingTask(item.id);

  return (
    <View>
      <SwipeableItem
        onActivate={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onItemActivate?.(item.id);
        }}
        onArchive={() => {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
          onItemArchive?.(item.id);
        }}
      >
        <View>
          <View style={[styles.itemRow, { paddingHorizontal: 10, paddingVertical: 6 }]}>
            <TimeBlockCompletionControl item={item} blockedByTitle={blocker?.title} onComplete={onItemComplete} />
            <TouchableOpacity
              style={styles.itemContent}
              onPress={() => onItemTap?.(item)}
              onLongPress={() => onLongPress(item)}
              delayLongPress={400}
              activeOpacity={0.5}
            >
              <View style={styles.itemContent}>
                <Text style={[styles.itemTitle, { color: blocker ? palette.textMuted : palette.text }]} numberOfLines={2}>
                  {item.title}
                </Text>
                {item.notes && (
                  <Text style={[styles.itemNotes, { color: palette.textMuted }]} numberOfLines={1}>
                    {item.notes}
                  </Text>
                )}
                {blocker && <BlockedBadge isDark={isDark} title={blocker.title} />}
                {item.rrule && <RepeatBadge isDark={isDark} rrule={item.rrule} />}
              </View>
            </TouchableOpacity>
            <DragHandleButton color={palette.textMuted} />
          </View>

          <View
            style={[
              styles.hairline,
              {
                backgroundColor: palette.separator,
                marginLeft: 54,
              },
            ]}
          />
        </View>
      </SwipeableItem>
    </View>
  );
});

// Hoisted OUT of TimelineSection (was previously a nested function
// declaration defined fresh on every render) — a nested component's
// function identity changes every time its parent re-renders, so React
// treated every row as a brand-new component type and fully unmounted +
// remounted it each time. Since usePersistentTimerState ticks a `now`
// state every second (unconditionally, even with no active timers), that
// meant every row — icon, gradients, swipe handler — was being torn down
// and rebuilt once a second, which read as a constant flash. A stable,
// module-level component just re-renders (updates props) instead.
function TimeBlockItems({
  items,
  color,
  isDark,
  palette,
  onDragStart,
  onIndexChange,
  onReorder,
  onItemTap,
  onItemComplete,
  onItemActivate,
  onItemArchive,
  onItemDelete,
  onDependencyChanged,
}: {
  items: Item[];
  color: string;
  isDark: boolean;
  palette: ThemeColors;
  onDragStart: () => void;
  onIndexChange: () => void;
  onReorder: (params: { from: number; to: number }) => void;
  onItemTap?: (item: Item) => void;
  onItemComplete?: (id: string) => void;
  onItemActivate?: (id: string) => void;
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onDependencyChanged?: () => void;
}) {
  // Reorder drags are vertical while each row's SwipeableItem is horizontal
  // — both are pan recognizers, so constrain the reorder pan to the Y axis
  // so it no longer fights the swipe gesture.
  const panGesture = useVerticalDragGesture();

  if (items.length === 0) {
    return null;
  }

  // Memoised because it is a prop of the memoised row: recreated every render
  // it would defeat that memo, and Home re-renders once a second (see the
  // useCallback block in HomeScreen), so rows would re-render and re-measure
  // mid-drag.
  const handleLongPress = useCallback((item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => onItemTap?.(item) },
      { text: 'Complete', onPress: () => onItemComplete?.(item.id) },
      { text: 'Depends on...', onPress: () => promptSetDependency(item, items, () => onDependencyChanged?.()) },
      { text: 'Delete', style: 'destructive', onPress: () => onItemDelete?.(item.id) },
    ]);
  }, [items, onItemTap, onItemComplete, onItemDelete, onDependencyChanged]);

  const renderRow = ({ item }: { item: Item }) => (
    <TimelineTaskRow
      item={item}
      isDark={isDark}
      palette={palette}
      onItemTap={onItemTap}
      onItemComplete={onItemComplete}
      onItemActivate={onItemActivate}
      onItemArchive={onItemArchive}
      onLongPress={handleLongPress}
    />
  );

  return (
    <View style={[styles.itemsContainer, { backgroundColor: hexToRgba(color, isDark ? 0.08 : 0.06) }]}>
      <NestedReorderableList
        data={items}
        keyExtractor={(item) => item.id}
        renderItem={renderRow}
        onDragStart={onDragStart}
        onIndexChange={onIndexChange}
        onReorder={onReorder}
        panGesture={panGesture}
        scrollable={false}
      />
    </View>
  );
}

// Also hoisted out for the same reason as TimeBlockItems above.
function TimeBlockHeader({
  label,
  period,
  color,
  count,
  isExpanded,
  isDark,
  palette,
  rowHeight,
  iconSize,
  onToggle,
  onLongPressAction,
}: {
  block: TimeBlockType;
  label: string;
  period: 'anytime' | 'morning' | 'afternoon' | 'evening';
  color: string;
  count: number;
  isExpanded: boolean;
  isDark: boolean;
  palette: ThemeColors;
  rowHeight: number;
  iconSize: number;
  onToggle: () => void;
  onLongPressAction: (action: string) => void;
}) {
  const contextItems = [
    { label: 'Add item', onPress: () => onLongPressAction('addItem') },
    { label: 'Move items here', onPress: () => onLongPressAction('moveItems') },
    { label: 'Sort', onPress: () => onLongPressAction('sort') },
    { label: 'Expand all', onPress: () => onLongPressAction('expandAll') },
    { label: 'Collapse all', onPress: () => onLongPressAction('collapseAll') },
  ];
  const iconWidth = iconSize * ICON_ASPECT_RATIO;

  return (
    <ContextMenu items={contextItems}>
      <TouchableOpacity onPress={onToggle} activeOpacity={0.6}>
        <RiverStoneSurface
          variant="list"
          mode={isDark ? 'dark' : 'light'}
          style={styles.blockHeaderWrap}
          background={
            <View
              pointerEvents="none"
              style={[StyleSheet.absoluteFill, { backgroundColor: hexToRgba(color, isDark ? 0.1 : 0.07) }]}
            />
          }
        >
          <View style={[styles.blockHeader, { minHeight: rowHeight, paddingVertical: 0 }]}>
            {/* No chip surface — the illustration already carries its own
                color/depth, so icon + label sit directly on the row with
                no separate pill/border/fill competing with it. */}
            <View style={styles.headerChip}>
              <View style={[styles.timeIconFrame, { width: iconWidth, height: iconSize }]}>
                <View
                  pointerEvents="none"
                  style={[
                    styles.timeIconGlow,
                    {
                      backgroundColor: hexToRgba(color, isDark ? 0.26 : 0.18),
                      shadowColor: color,
                    },
                  ]}
                />
                <TimeIcon period={period} size={iconSize} style={{ width: iconWidth }} />
              </View>
              <Text style={[styles.headerLabel, { color: palette.text }]}>{label}</Text>
            </View>
            <View style={styles.headerRight}>
              <Text style={[styles.headerCount, { color }]}>{count}</Text>
              <Text style={[styles.headerArrow, { color: palette.textMuted }]}>
                {isExpanded ? '↑' : '→'}
              </Text>
            </View>
          </View>
        </RiverStoneSurface>
      </TouchableOpacity>
    </ContextMenu>
  );
}

export function TimelineSection({
  todayItems,
  anytime,
  morning,
  afternoon,
  evening,
  onItemTap,
  onItemComplete,
  onItemActivate,
  onItemArchive,
  onItemDelete,
  onDependencyChanged,
  onTimeBlockAction,
  rowHeight,
}: TimelineSectionProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  // Icon fills as much of the row as it can — sized directly off the row
  // height (minus a fixed top/bottom margin) rather than scaled off a
  // fixed "natural" ratio, so it grows right along with any extra space
  // Home has to give it, not just shrink when space is tight.
  const effectiveRowHeight = rowHeight != null ? Math.max(MIN_ROW_HEIGHT, rowHeight) : NATURAL_ROW_HEIGHT;
  const iconSize = Math.max(MIN_ICON_SIZE, effectiveRowHeight - ICON_ROW_MARGIN);

  // Local, manually-orderable copies of each time block — re-derived from
  // Home's props whenever they change, then drag-reordered in place via
  // useHapticReorder, same pattern as ProjectDetailScreen/TasksScreen. One
  // hook call per block (not a loop) since the four blocks are fixed and
  // hooks can't be called conditionally/dynamically.
  const [orderedBlocks, setOrderedBlocks] = useState<Record<TimeBlockType, Item[]>>({
    anytime: [],
    morning: [],
    afternoon: [],
    evening: [],
  });

  useEffect(() => {
    setOrderedBlocks({
      anytime: applyManualOrder('home:anytime', anytime),
      morning: applyManualOrder('home:morning', morning),
      afternoon: applyManualOrder('home:afternoon', afternoon),
      evening: applyManualOrder('home:evening', evening),
    });
  }, [anytime, morning, afternoon, evening]);

  const anytimeReorder = useHapticReorder<Item>('home:anytime', orderedBlocks.anytime, (data) => setOrderedBlocks((o) => ({ ...o, anytime: data })));
  const morningReorder = useHapticReorder<Item>('home:morning', orderedBlocks.morning, (data) => setOrderedBlocks((o) => ({ ...o, morning: data })));
  const afternoonReorder = useHapticReorder<Item>('home:afternoon', orderedBlocks.afternoon, (data) => setOrderedBlocks((o) => ({ ...o, afternoon: data })));
  const eveningReorder = useHapticReorder<Item>('home:evening', orderedBlocks.evening, (data) => setOrderedBlocks((o) => ({ ...o, evening: data })));
  const reorderByBlock: Record<TimeBlockType, ReturnType<typeof useHapticReorder<Item>>> = {
    anytime: anytimeReorder,
    morning: morningReorder,
    afternoon: afternoonReorder,
    evening: eveningReorder,
  };

  const blockColors = isDark ? timeBlockColors.dark : timeBlockColors.light;
  const blocks: TimeBlockData[] = [
    { key: 'anytime', label: 'Anytime', period: 'anytime', color: blockColors.anytime, items: orderedBlocks.anytime },
    { key: 'morning', label: 'Morning', period: 'morning', color: blockColors.morning, items: orderedBlocks.morning },
    { key: 'afternoon', label: 'Afternoon', period: 'afternoon', color: blockColors.afternoon, items: orderedBlocks.afternoon },
    { key: 'evening', label: 'Evening', period: 'evening', color: blockColors.evening, items: orderedBlocks.evening },
  ];

  const [expandedSections, setExpandedSections] = useState<Record<TimeBlockType, boolean>>({
    anytime: false,
    morning: false,
    afternoon: false,
    evening: false,
  });

  const toggleSection = (block: TimeBlockType) => {
    setExpandedSections((prev) => ({
      ...prev,
      [block]: !prev[block],
    }));
  };

  const handleTimeBlockAction = (block: TimeBlockType, action: string) => {
    if (action === 'expandAll') {
      setExpandedSections({ anytime: true, morning: true, afternoon: true, evening: true });
    } else if (action === 'collapseAll') {
      setExpandedSections({ anytime: false, morning: false, afternoon: false, evening: false });
    } else {
      onTimeBlockAction?.(block, action);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY</Text>

      {blocks.map((block) => (
        <SwipeableItem
          key={block.key}
          onActivate={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
            onTimeBlockAction?.(block.key, 'completeAll');
          }}
          onArchive={() => {
            Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            onTimeBlockAction?.(block.key, 'quickAdd');
          }}
        >
          <View>
            <TimeBlockHeader
              block={block.key}
              label={block.label}
              period={block.period}
              color={block.color}
              count={block.items.length}
              isExpanded={expandedSections[block.key]}
              isDark={isDark}
              palette={palette}
              rowHeight={effectiveRowHeight}
              iconSize={iconSize}
              onToggle={() => toggleSection(block.key)}
              onLongPressAction={(action) => handleTimeBlockAction(block.key, action)}
            />

            {expandedSections[block.key] && (
              <TimeBlockItems
                items={block.items}
                color={block.color}
                isDark={isDark}
                palette={palette}
                onDragStart={reorderByBlock[block.key].onDragStart}
                onIndexChange={reorderByBlock[block.key].onIndexChange}
                onReorder={reorderByBlock[block.key].onReorder}
                onItemTap={onItemTap}
                onItemComplete={onItemComplete}
                onItemActivate={onItemActivate}
                onItemArchive={onItemArchive}
                onItemDelete={onItemDelete}
                onDependencyChanged={onDependencyChanged}
              />
            )}
          </View>
        </SwipeableItem>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 16,
    // Tightened from the cards above — there's no need for the old
    // generous breathing room now that the section title itself reads as
    // a proper header instead of a small label.
    paddingTop: 4,
    paddingBottom: 16,
    gap: 0,
  },
  title: {
    // Sized up to act as a real section header — there's plenty of room
    // now that the timeline rows are taller, and a small uppercase label
    // read as an afterthought against them.
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 0.2,
    marginBottom: 14,
  },
  // River Stone "list" row — gap between stacked rows instead of the old
  // continuous hairline-separated stack, since each is now its own carved
  // surface rather than a shared flat block.
  blockHeaderWrap: {
    marginBottom: 8,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    // Roughly doubles row height — there's plenty of vertical room on Home
    // once the timeline is collapsed, and it lets the icon art read at a
    // size where the illustration detail actually shows.
    paddingVertical: 16,
  },
  // No chip surface anymore — just the icon+label row, sitting directly on
  // top of the block header's own background.
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  timeIconFrame: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  timeIconGlow: {
    position: 'absolute',
    width: '72%',
    height: '58%',
    borderRadius: 999,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.72,
    shadowRadius: 14,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLabel: {
    fontSize: 16,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCount: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  headerArrow: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  itemsContainer: {
    paddingVertical: 8,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  itemRowActive: {
    opacity: 0.9,
  },
  itemContent: {
    flex: 1,
  },
  itemTitle: {
    fontSize: 16,
    fontWeight: '400',
    lineHeight: 22,
  },
  itemNotes: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 18,
    marginTop: 2,
  },
  hairline: {
    height: StyleSheet.hairlineWidth,
  },
});
