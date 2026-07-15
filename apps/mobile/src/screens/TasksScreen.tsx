import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTasks, useProjects, useCompletedItems } from '../hooks/useDb';
import { deleteItem, updateItemStatus, setRelation, getRelation } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from '../components/ui/LacquerDiscControl';
import { groupCompletedByDay } from '../utils/completedGrouping';
import type { Item } from '../db/types';

type TasksTab = 'tasks' | 'logbook';

// No header "+" here — creating a plain task is identical to the dock FAB's
// default action (see App.tsx openQuickAdd, which defaults to status:
// 'active' when focused on this screen). A second create entry point here
// would just be a second button for the same underlying action.
export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { items: completedItems, refresh: refreshCompleted } = useCompletedItems();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [completingIds, setCompletingIds] = useState<Set<string>>(new Set());
  const [restoringIds, setRestoringIds] = useState<Set<string>>(new Set());
  const [activeTab, setActiveTab] = useState<TasksTab>('tasks');

  const active = tasks.filter(t => t.status !== 'someday');
  const someday = tasks.filter(t => t.status === 'someday');

  const getProjectTitle = (item: Item): string | null => {
    const id = getRelation(item.id, 'project');
    return id ? projects.find(p => p.id === id)?.title ?? null : null;
  };

  const promptSetProject = (item: Item) => {
    if (projects.length === 0) {
      Alert.alert('No projects yet', 'Create a project first, then assign tasks to it.');
      return;
    }
    const currentProjectId = getRelation(item.id, 'project');
    Alert.alert('Move to project', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(currentProjectId ? [{ text: 'Remove from project', onPress: () => { setRelation(item.id, 'project', null); refresh(); } }] : []),
      ...projects.map(p => ({
        text: p.title,
        onPress: () => {
          setRelation(item.id, 'project', p.id);
          refresh();
        },
      })),
    ]);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const moveLabel = item.status === 'someday' ? 'Move to Active' : 'Move to Someday';
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: moveLabel,
        onPress: () => {
          updateItemStatus(item.id, item.status === 'someday' ? 'active' : 'someday');
          refresh();
        },
      },
      { text: 'Move to Project...', onPress: () => promptSetProject(item) },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  const handleComplete = (item: Item) => {
    if (completingIds.has(item.id)) return;
    setCompletingIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'completed');
      refresh();
      refreshCompleted();
      setCompletingIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const handleRestore = (item: Item) => {
    if (restoringIds.has(item.id)) return;
    setRestoringIds((current) => new Set(current).add(item.id));
    setTimeout(() => {
      updateItemStatus(item.id, 'active');
      refresh();
      refreshCompleted();
      setRestoringIds((current) => {
        const next = new Set(current);
        next.delete(item.id);
        return next;
      });
    }, LACQUER_DISC_COMPLETION_DURATION);
  };

  const renderRow = (item: Item) => {
    const projectTitle = getProjectTitle(item);
    return (
      <View
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
      >
        <LacquerDiscControl
          isCompleted={completingIds.has(item.id)}
          accessibilityLabel={`Complete ${item.title}`}
          onToggle={() => handleComplete(item)}
        />
        <TouchableOpacity
          style={styles.rowContent}
          activeOpacity={0.7}
          onLongPress={() => handleLongPress(item)}
          delayLongPress={400}
        >
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
          {projectTitle && (
            <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>{projectTitle}</Text>
          )}
        </TouchableOpacity>
      </View>
    );
  };

  const renderCompletedRow = (item: Item) => {
    const projectTitle = getProjectTitle(item);
    return (
      <View
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
      >
        <LacquerDiscControl
          isCompleted={!restoringIds.has(item.id)}
          accessibilityLabel={`Restore ${item.title}`}
          onToggle={() => handleRestore(item)}
        />
        <View style={styles.rowContent}>
          <Text
            style={[styles.rowTitle, styles.rowTitleCompleted, { color: palette.textSecondary }]}
            numberOfLines={1}
          >
            {item.title}
          </Text>
          {projectTitle && (
            <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>{projectTitle}</Text>
          )}
        </View>
      </View>
    );
  };

  const completedGroups = groupCompletedByDay(completedItems);

  return (
    <LensSurface title="Tasks">
      <View style={[styles.segmentedControl, { backgroundColor: palette.fill }]}>
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'tasks' && { backgroundColor: palette.surface },
          ]}
          onPress={() => setActiveTab('tasks')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'tasks' ? palette.text : palette.textSecondary }]}>
            Tasks
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.segment,
            activeTab === 'logbook' && { backgroundColor: palette.surface },
          ]}
          onPress={() => setActiveTab('logbook')}
        >
          <Text style={[styles.segmentLabel, { color: activeTab === 'logbook' ? palette.text : palette.textSecondary }]}>
            Logbook
          </Text>
        </TouchableOpacity>
      </View>

      {activeTab === 'tasks' ? (
        tasks.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap the + in the dock to create one</Text>
          </View>
        ) : (
          <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
            {active.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ACTIVE</Text>
                <View style={styles.sectionRows}>{active.map(renderRow)}</View>
              </View>
            )}
            {someday.length > 0 && (
              <View style={styles.section}>
                <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>SOMEDAY</Text>
                <View style={styles.sectionRows}>{someday.map(renderRow)}</View>
              </View>
            )}
          </ScrollView>
        )
      ) : completedGroups.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing completed yet</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {completedGroups.map((group) => (
            <View key={group.label} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.label}</Text>
              <View style={styles.sectionRows}>{group.items.map(renderCompletedRow)}</View>
            </View>
          ))}
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
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionRows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    borderRadius: 14,
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
  },
  segmentedControl: {
    flexDirection: 'row',
    borderRadius: 10,
    padding: 3,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  segment: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: 8,
    alignItems: 'center',
  },
  segmentLabel: {
    fontSize: 13,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowTitleCompleted: {
    textDecorationLine: 'line-through',
  },
});
