import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getProjectsForArea, getProjectItemCount, createItem, deleteItem, updateItemStatus, setRelation } from '../db/database';
import { useAreas } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import type { Item } from '../db/types';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
import { showActionSheet } from '../utils/actionSheet';

interface AreaDetailRouteParams {
  areaId: string;
  title: string;
}

// No header "+" — holding the dock FAB while this screen is focused opens
// New Project (pre-assigned to this area) instead of a separate button.
export function AreaDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { areaId, title } = route.params as AreaDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { areas } = useAreas();
  const [projects, setProjects] = useState<Item[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(() => {
    setProjects(getProjectsForArea(areaId));
  }, [areaId]);

  useFocusEffect(refresh);

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (projectTitle: string) => {
    const id = createItem('project', projectTitle, 'active');
    setRelation(id, 'area', areaId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const promptMoveDomain = (item: Item) => {
    const otherAreas = areas.filter(a => a.id !== areaId);
    Alert.alert('Move to domain', undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove from this domain', onPress: () => { setRelation(item.id, 'area', null); refresh(); } },
      ...otherAreas.map(area => ({
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
      { label: 'Move to Domain...', onPress: () => promptMoveDomain(item) },
      {
        label: 'Delete',
        onPress: () => {
          Alert.alert(`Delete ${item.title}?`, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteItem(item.id);
                refresh();
              },
            },
          ]);
        },
        destructive: true,
      },
    ]);
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  return (
    <LensSurface title={title}>
      {projects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No missions yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to add one to this domain</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {projects.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.75}
                onPress={() => (navigation as any).navigate('ProjectDetail', { projectId: item.id, title: item.title })}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
                <ProjectPortfolioIcon size={32} />
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{getProjectItemCount(item.id)}</Text>
              </TouchableOpacity>
            ))}
          </View>
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
  rows: {
    gap: 8,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowTitle: {
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
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
    fontWeight: '400',
  },
});
