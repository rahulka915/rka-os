import { useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Plus } from 'lucide-react-native';
import { useAreas, useProjects } from '../hooks/useDb';
import {
  createItem,
  setRelation,
  getRelation,
  getRelatedItems,
  getAreaProjectCount,
  getProjectItemCount,
  updateItemStatus,
} from '../db/database';
import { DetailPanel } from './DetailPanel';
import { ItemDetailForm } from './ItemDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item } from '../db/types';

export interface AreasProjectsScreenProps {
  selectedAreaId: string | null;
  selectedProjectId: string | null;
  onSelectArea: (id: string) => void;
  onSelectProject: (id: string) => void;
}

export function AreasProjectsScreen({
  selectedAreaId,
  selectedProjectId,
  onSelectArea,
  onSelectProject,
}: AreasProjectsScreenProps) {
  const { areas } = useAreas();
  const { projects, refresh: refreshProjects } = useProjects();
  const [captureText, setCaptureText] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  const selectedArea = areas.find((a) => a.id === selectedAreaId) ?? null;
  const selectedProject = projects.find((p) => p.id === selectedProjectId) ?? null;

  if (selectedProject) {
    const areaId = getRelation(selectedProject.id, 'area');
    const areaName = areaId ? areas.find((a) => a.id === areaId)?.title : null;
    const tasks = getRelatedItems(selectedProject.id, 'project');
    const selectedTask = tasks.find((t) => t.id === selectedTaskId) ?? null;

    const submitTask = () => {
      const trimmed = captureText.trim();
      if (!trimmed) return;
      const id = createItem('task', trimmed, 'active');
      setRelation(id, 'project', selectedProject.id);
      setCaptureText('');
      refreshProjects();
    };

    const toggleComplete = (item: Item) => {
      updateItemStatus(item.id, item.status === 'completed' ? 'active' : 'completed');
      refreshProjects();
    };

    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{selectedProject.title}</Text>
            <Text style={styles.subtitle}>{areaName ?? 'No domain'}</Text>
          </View>

          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submitTask}
              placeholder="New task..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          {tasks.length === 0 ? (
            <Text style={styles.empty}>No tasks in this mission yet.</Text>
          ) : (
            <FlatList
              data={tasks}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => {
                const completed = item.status === 'completed';
                return (
                  <Pressable style={styles.row} onPress={() => setSelectedTaskId(item.id)}>
                    <Pressable
                      onPress={(event) => {
                        event.stopPropagation();
                        toggleComplete(item);
                      }}
                      style={[styles.checkbox, completed && styles.checkboxDone]}
                    >
                      {completed ? <Check size={13} color={webColors.card} strokeWidth={2.5} /> : null}
                    </Pressable>
                    <Text style={[styles.rowTitle, completed && styles.rowTitleDone]} numberOfLines={1}>
                      {item.title}
                    </Text>
                  </Pressable>
                );
              }}
            />
          )}
        </View>

        <DetailPanel visible={!!selectedTask} onClose={() => setSelectedTaskId(null)} title="Task">
          {selectedTask ? (
            <ItemDetailForm
              item={selectedTask}
              onChanged={refreshProjects}
              onDeleted={() => {
                setSelectedTaskId(null);
                refreshProjects();
              }}
            />
          ) : null}
        </DetailPanel>
      </View>
    );
  }

  if (selectedArea) {
    const areaProjects = projects.filter((p) => getRelation(p.id, 'area') === selectedArea.id);

    const submitProject = () => {
      const trimmed = captureText.trim();
      if (!trimmed) return;
      const id = createItem('project', trimmed, 'active');
      setRelation(id, 'area', selectedArea.id);
      setCaptureText('');
      refreshProjects();
    };

    return (
      <View style={styles.container}>
        <View style={styles.scrollContent}>
          <View style={styles.header}>
            <Text style={styles.title}>{selectedArea.title}</Text>
          </View>

          <View style={styles.captureRow}>
            <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
            <TextInput
              value={captureText}
              onChangeText={setCaptureText}
              onSubmitEditing={submitProject}
              placeholder="New mission..."
              placeholderTextColor={webColors.mutedForeground}
              style={styles.captureInput}
            />
          </View>

          {areaProjects.length === 0 ? (
            <Text style={styles.empty}>No missions in this domain yet.</Text>
          ) : (
            <FlatList
              data={areaProjects}
              keyExtractor={(item) => item.id}
              contentContainerStyle={styles.listContent}
              renderItem={({ item }) => (
                <Pressable style={styles.row} onPress={() => onSelectProject(item.id)}>
                  <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                  <Text style={styles.rowCount}>{getProjectItemCount(item.id)}</Text>
                </Pressable>
              )}
            />
          )}
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>Domains & Missions</Text>
        </View>

        {areas.length === 0 ? (
          <Text style={styles.empty}>No domains yet. Add one from the sidebar.</Text>
        ) : (
          <FlatList
            data={areas}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={({ item }) => (
              <Pressable style={styles.row} onPress={() => onSelectArea(item.id)}>
                <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                <Text style={styles.rowCount}>{getAreaProjectCount(item.id)}</Text>
              </Pressable>
            )}
          />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[4],
    flex: 1,
  },
  header: {
    gap: webSpacing[1],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  subtitle: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  listContent: {
    gap: webSpacing[2],
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  rowCount: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  checkbox: {
    width: 18,
    height: 18,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  rowTitleDone: {
    color: webColors.mutedForeground,
    textDecorationLine: 'line-through',
  },
});
