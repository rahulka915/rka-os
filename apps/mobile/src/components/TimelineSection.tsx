import { useState } from 'react';
import { View, StyleSheet, Text, TouchableOpacity } from 'react-native';
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

  function TimeBlockHeader({
    block,
    label,
    icon,
    count,
    isExpanded,
    onToggle,
  }: {
    block: TimeBlockType;
    label: string;
    icon: string;
    count: number;
    isExpanded: boolean;
    onToggle: () => void;
  }) {
    return (
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
    );
  }

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY'S TIMELINE</Text>

      {blocks.map((block) => (
        <View key={block.key}>
          <TimeBlockHeader
            block={block.key}
            label={block.label}
            icon={block.icon}
            count={block.items.length}
            isExpanded={expandedSections[block.key]}
            onToggle={() => toggleSection(block.key)}
          />
        </View>
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
});
