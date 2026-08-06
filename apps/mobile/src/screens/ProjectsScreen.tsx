import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useProjects, useAreas } from '../hooks/useDb';
import { createItem, deleteItem, updateItemStatus, setRelation, getRelation, getProjectItemCount } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import type { Item } from '../db/types';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
import { ProjectPlaceholderIcon } from '../components/icons/ProjectPlaceholderIcon';
import { showActionSheet } from '../utils/actionSheet';

// No header "+" — holding the dock FAB while this screen is focused opens
// New Project instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function ProjectsScreen() {
  const navigation = useNavigation();
  const { projects, refresh } = useProjects();
  const { areas } = useAreas();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);
  const areaTitleById = new Map(areas.map(area => [area.id, area.title]));

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const active = projects.filter(p => p.status !== 'someday');
  const someday = projects.filter(p => p.status === 'someday');

  const handleCreate = (title: string) => {
    createItem('project', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const promptSetArea = (item: Item) => {
    if (areas.length === 0) {
      Alert.alert('No domains yet', 'Create a domain first, then assign missions to it.');
      return;
    }
    const currentAreaId = getRelation(item.id, 'area');
    Alert.alert('Move to domain', undefined, [
      { text: 'Cancel', style: 'cancel' },
      ...(currentAreaId ? [{ text: 'Remove from domain', onPress: () => { setRelation(item.id, 'area', null); refresh(); } }] : []),
      ...areas.map(area => ({
        text: area.title,
        onPress: () => {
          setRelation(item.id, 'area', area.id);
          refresh();
        },
      })),
    ]);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const moveLabel = item.status === 'someday' ? 'Move to Active' : 'Move to Someday';
    showActionSheet(item.title, [
      {
        label: moveLabel,
        onPress: () => {
          updateItemStatus(item.id, item.status === 'someday' ? 'active' : 'someday');
          refresh();
        },
      },
      { label: 'Move to Domain...', onPress: () => promptSetArea(item) },
      {
        label: 'Delete',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
        destructive: true,
      },
    ]);
  };

  const renderRow = (item: Item) => {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    const icon: string | undefined = typeof meta.icon === 'string' ? meta.icon : undefined;
    const areaId = getRelation(item.id, 'area');
    const areaTitle = areaId ? areaTitleById.get(areaId) : undefined;

    return (
      <TouchableOpacity
        key={item.id}
        style={[styles.row, { backgroundColor: palette.surface }]}
        activeOpacity={0.7}
        onPress={() => (navigation as any).navigate('ProjectDetail', { projectId: item.id, title: item.title })}
        onLongPress={() => handleLongPress(item)}
        delayLongPress={400}
      >
        {icon ? <Text style={styles.rowIconEmoji}>{icon}</Text> : <ProjectPlaceholderIcon size={34} />}
        <View style={styles.rowTitleGroup}>
          <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
          {areaTitle ? (
            <View style={[styles.areaBadge, { backgroundColor: palette.fill }]}>
              <Text style={[styles.areaBadgeText, { color: palette.textSecondary }]} numberOfLines={1}>
                {areaTitle}
              </Text>
            </View>
          ) : null}
        </View>
        <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{getProjectItemCount(item.id)}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <LensSurface title="Missions">
      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No missions yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to create one</Text>
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
        title="New Mission"
        placeholder="Mission name..."
        icon={<ProjectPortfolioIcon size={38} />}
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
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitleGroup: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowIconEmoji: {
    fontSize: 28,
    width: 34,
    textAlign: 'center',
  },
  areaBadge: {
    alignSelf: 'flex-start',
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  areaBadgeText: {
    fontSize: 11,
    fontFamily: 'Inter_500Medium',
    fontWeight: '500',
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 12,
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
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
