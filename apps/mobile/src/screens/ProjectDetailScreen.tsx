import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getRelatedItems, updateItemStatus, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import type { Item } from '../db/types';

interface ProjectDetailRouteParams {
  projectId: string;
  title: string;
}

// No header "+" here — adding a task to this project is the dock FAB's job
// (see App.tsx openQuickAdd, which detects this route by name and pre-fills
// the project relation + active status). A second create button here would
// just duplicate that same underlying action.
export function ProjectDetailScreen() {
  const route = useRoute();
  const { projectId, title } = route.params as ProjectDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [tasks, setTasks] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setTasks(getRelatedItems(projectId, 'project'));
  }, [projectId]);

  useFocusEffect(refresh);

  const handleComplete = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    updateItemStatus(item.id, 'completed');
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    deleteItem(item.id);
    refresh();
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  return (
    <LensSurface title={title}>
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap the + in the dock to add one here</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {tasks.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.75}
                onPress={() => handleComplete(item)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
                <View style={[styles.checkboxCircle, { borderColor: palette.textMuted }]} />
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    flex: 1,
  },
  checkboxCircle: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 1.75,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
});
