import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useTasks, useProjects } from '../hooks/useDb';
import { createItem, deleteItem, updateItemStatus, setRelation, getRelation } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { LensFAB } from '../components/LensFAB';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import type { Item } from '../db/types';

export function TasksScreen() {
  const { tasks, refresh } = useTasks();
  const { projects } = useProjects();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);

  const active = tasks.filter(t => t.status !== 'someday');
  const someday = tasks.filter(t => t.status === 'someday');

  const getProjectTitle = (item: Item): string | null => {
    const id = getRelation(item.id, 'project');
    return id ? projects.find(p => p.id === id)?.title ?? null : null;
  };

  const handleCreate = (title: string) => {
    createItem('task', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
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
      { text: 'Complete', onPress: () => { updateItemStatus(item.id, 'completed'); refresh(); } },
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

  const renderRow = (item: Item) => {
    const projectTitle = getProjectTitle(item);
    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
        activeOpacity={0.7}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        <View style={styles.rowContent}>
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
          {projectTitle && (
            <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>{projectTitle}</Text>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <LensSurface title="Tasks" headerRight={<LensFAB onPress={() => setCreateOpen(true)} />}>
      {tasks.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No tasks yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Tap + to create one</Text>
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
      )}

      <QuickCreateSheet
        visible={createOpen}
        title="New Task"
        placeholder="Task name..."
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
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
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionRows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowContent: {
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
  },
  rowSub: {
    fontSize: 12,
    fontWeight: '500',
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
