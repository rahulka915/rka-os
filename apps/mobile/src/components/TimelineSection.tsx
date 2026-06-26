import { useState } from 'react';
import { View, StyleSheet, Text } from 'react-native';
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

  return (
    <View style={[styles.container, { backgroundColor: palette.bg }]}>
      <Text style={[styles.title, { color: palette.textTertiary }]}>TODAY'S TIMELINE</Text>

      {blocks.map((block) => (
        <View key={block.key}>
          {/* Time block header will go here */}
          {/* Items will render here when expanded */}
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
});
