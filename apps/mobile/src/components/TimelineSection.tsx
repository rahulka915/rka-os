import { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
import * as Haptics from 'expo-haptics';
import { SwipeableItem } from './SwipeableItem';
import { ContextMenu } from './ContextMenu';
import type { Item } from '../db/types';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

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
  icon: string;
  items: Item[];
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

  const blocks: TimeBlockData[] = [
    { key: 'anytime', label: 'Anytime', icon: '⏰', items: anytime },
    { key: 'morning', label: 'Morning', icon: '☀', items: morning },
    { key: 'afternoon', label: 'Afternoon', icon: '☁', items: afternoon },
    { key: 'evening', label: 'Evening', icon: '🌙', items: evening },
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
    onItemTap,
    onItemComplete,
    onItemArchive,
  }: {
    items: Item[];
    onItemTap?: (item: Item) => void;
    onItemComplete?: (id: string) => void;
    onItemArchive?: (id: string) => void;
  }) {
    if (items.length === 0) {
      return null;
    }

    return (
      <View style={[styles.itemsContainer, { backgroundColor: isDark ? 'rgba(255,255,255,0.01)' : 'rgba(0,0,0,0.01)' }]}>
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
                <View style={[styles.itemRow, { paddingHorizontal: 16, paddingVertical: 12 }]}>
                  <View
                    style={[
                      styles.itemCircle,
                      {
                        borderColor: isDark ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.18)',
                      },
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
    count,
    isExpanded,
    onToggle,
    onLongPressAction,
  }: {
    block: TimeBlockType;
    label: string;
    icon: string;
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
          style={[
            styles.blockHeader,
            {
              backgroundColor: isDark ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.02)',
              borderBottomColor: palette.separator,
            },
          ]}
        >
          <View style={styles.headerLeft}>
            <Text style={styles.headerIcon}>{icon}</Text>
            <Text style={[styles.headerLabel, { color: palette.text }]}>{label}</Text>
          </View>
          <View style={styles.headerRight}>
            <Text style={[styles.headerCount, { color: palette.textSecondary }]}>{count}</Text>
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
      <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY'S TIMELINE</Text>

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
              count={block.items.length}
              isExpanded={expandedSections[block.key]}
              onToggle={() => toggleSection(block.key)}
              onLongPressAction={(action) => handleTimeBlockAction(block.key, action)}
            />

            {expandedSections[block.key] && (
              <TimeBlockItems
                items={block.items}
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
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 12,
  },
  blockHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIcon: {
    fontSize: 18,
  },
  headerLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerCount: {
    fontSize: 14,
    fontWeight: '600',
  },
  headerArrow: {
    fontSize: 12,
    fontWeight: '600',
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
