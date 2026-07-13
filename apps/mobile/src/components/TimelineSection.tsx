import { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SwipeableItem } from './SwipeableItem';
import { ContextMenu } from './ContextMenu';
import type { Item } from '../db/types';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { StoneIcon, SunriseIcon, FanIcon, MoonStarIcon } from './icons/TimeBlockIcons';

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
  onItemArchive?: (id: string) => void;
  onItemDelete?: (id: string) => void;
  onTimeBlockAction?: (block: TimeBlockType, action: string) => void;
}

export type TimeBlockType = 'anytime' | 'morning' | 'afternoon' | 'evening';

interface TimeBlockData {
  key: TimeBlockType;
  label: string;
  icon: React.ReactElement;
  color: string;
  items: Item[];
}

// Alpha-blends a hex color for chip/row tints — RN has no native rgba(#hex, a).
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TimelineSection({
  todayItems,
  anytime,
  morning,
  afternoon,
  evening,
  onItemTap,
  onItemComplete,
  onItemArchive,
  onItemDelete,
  onTimeBlockAction,
}: TimelineSectionProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const blockColors = isDark ? timeBlockColors.dark : timeBlockColors.light;
  const blocks: TimeBlockData[] = [
    { key: 'anytime', label: 'Anytime', color: blockColors.anytime, icon: <StoneIcon size={13} color={blockColors.anytime} />, items: anytime },
    { key: 'morning', label: 'Morning', color: blockColors.morning, icon: <SunriseIcon size={13} color={blockColors.morning} />, items: morning },
    { key: 'afternoon', label: 'Afternoon', color: blockColors.afternoon, icon: <FanIcon size={13} color={blockColors.afternoon} />, items: afternoon },
    { key: 'evening', label: 'Evening', color: blockColors.evening, icon: <MoonStarIcon size={13} color={blockColors.evening} />, items: evening },
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

  function TimeBlockItems({
    items,
    color,
    onItemTap,
    onItemComplete,
    onItemArchive,
  }: {
    items: Item[];
    color: string;
    onItemTap?: (item: Item) => void;
    onItemComplete?: (id: string) => void;
    onItemArchive?: (id: string) => void;
  }) {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={[styles.itemsContainer, { backgroundColor: hexToRgba(color, isDark ? 0.08 : 0.06) }]}>
        {items.map((item, index) => (
          <SwipeableItem
            key={item.id}
            onActivate={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onItemComplete?.(item.id);
            }}
            onArchive={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onItemArchive?.(item.id);
            }}
          >
            <TouchableOpacity
              onPress={() => onItemTap?.(item)}
              activeOpacity={0.5}
            >
              <View>
                <View style={[styles.itemRow, { paddingHorizontal: 16, paddingVertical: 10 }]}>
                  <View
                    style={[
                      styles.itemCircle,
                      { borderColor: color },
                    ]}
                  />
                  <View style={styles.itemContent}>
                    <Text style={[styles.itemTitle, { color: palette.text }]} numberOfLines={2}>
                      {item.title}
                    </Text>
                    {item.notes && (
                      <Text style={[styles.itemNotes, { color: palette.textMuted }]} numberOfLines={1}>
                        {item.notes}
                      </Text>
                    )}
                  </View>
                </View>

                {index < items.length - 1 && (
                  <View
                    style={[
                      styles.hairline,
                      {
                        backgroundColor: palette.separator,
                        marginLeft: 56,
                      },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          </SwipeableItem>
        ))}
      </View>
    );
  }

  function TimeBlockHeader({
    block,
    label,
    icon,
    color,
    count,
    isExpanded,
    onToggle,
    onLongPressAction,
  }: {
    block: TimeBlockType;
    label: string;
    icon: React.ReactElement;
    color: string;
    count: number;
    isExpanded: boolean;
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

    return (
      <ContextMenu items={contextItems}>
        <TouchableOpacity
          onPress={onToggle}
          activeOpacity={0.6}
          style={[styles.blockHeader, { backgroundColor: hexToRgba(color, isDark ? 0.08 : 0.06), borderBottomColor: palette.separator }]}
        >
          <View
            style={[
              styles.headerChip,
              { backgroundColor: hexToRgba(color, isDark ? 0.22 : 0.15) },
            ]}
          >
            {icon}
            <Text style={[styles.headerLabel, { color: palette.text }]}>{label}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.headerCount, { color }]}>{count}</Text>
            <Text style={[styles.headerArrow, { color: palette.textMuted }]}>
              {isExpanded ? '↑' : '→'}
            </Text>
          </View>
        </TouchableOpacity>
      </ContextMenu>
    );
  }

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
              icon={block.icon}
              color={block.color}
              count={block.items.length}
              isExpanded={expandedSections[block.key]}
              onToggle={() => toggleSection(block.key)}
              onLongPressAction={(action) => handleTimeBlockAction(block.key, action)}
            />

            {expandedSections[block.key] && (
              <TimeBlockItems
                items={block.items}
                color={block.color}
                onItemTap={onItemTap}
                onItemComplete={onItemComplete}
                onItemArchive={onItemArchive}
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
    paddingVertical: 16,
    gap: 0,
  },
  title: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 20,
    paddingHorizontal: 10,
    paddingVertical: 4,
    alignSelf: 'flex-start',
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerLabel: {
    fontSize: 14,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCount: {
    fontSize: 14,
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
  itemCircle: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    flexShrink: 0,
    marginTop: 2,
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
