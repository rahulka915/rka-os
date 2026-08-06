import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  getProjectsForArea,
  getProjectItemCount,
  createItem,
  deleteItem,
  updateItem,
  updateItemStatus,
  setRelation,
  computeDomainScore,
  getPotentialStatsForArea,
  getPotentialStatResultsForArea,
  getPotentialStats,
  createPotentialStat,
  setPotentialStatArea,
  getAchievementsForArea,
  formatDate,
} from '../db/database';
import { useAreas } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { KatanaProgress } from '../components/ui/KatanaProgress';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import type { Item } from '../db/types';
import type { PotentialStatResult } from '../utils/potential';
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
  const [domainScore, setDomainScore] = useState(0);
  const [stats, setStats] = useState<Item[]>([]);
  const [statResults, setStatResults] = useState<Record<string, PotentialStatResult>>({});
  const [achievements, setAchievements] = useState<Item[]>([]);

  const refresh = useCallback(() => {
    setProjects(getProjectsForArea(areaId));
    setDomainScore(computeDomainScore(areaId));
    setStats(getPotentialStatsForArea(areaId));
    setStatResults(getPotentialStatResultsForArea(areaId, formatDate(new Date())));
    setAchievements(getAchievementsForArea(areaId));
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

  const [statCreateOpen, setStatCreateOpen] = useState(false);
  const [statEditTarget, setStatEditTarget] = useState<Item | null>(null);

  const handleSaveStat = (statTitle: string) => {
    if (statEditTarget) {
      updateItem(statEditTarget.id, { title: statTitle });
      refresh();
      return;
    }
    createPotentialStat(statTitle, areaId);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const promptAddStat = () => {
    const linkedIds = new Set(stats.map((s) => s.id));
    const unlinked = getPotentialStats().filter((s) => !linkedIds.has(s.id));
    showActionSheet('Add Potential Stat', [
      { label: 'New Stat...', onPress: () => { setStatEditTarget(null); setStatCreateOpen(true); } },
      ...unlinked.map((s) => ({
        label: `Link "${s.title}"`,
        onPress: () => { setPotentialStatArea(s.id, areaId); refresh(); },
      })),
    ]);
  };

  const handleStatLongPress = (stat: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(stat.title, [
      { label: 'Rename', onPress: () => { setStatEditTarget(stat); setStatCreateOpen(true); } },
      { label: 'Unlink from this Domain', onPress: () => { setPotentialStatArea(stat.id, null); refresh(); } },
      {
        label: 'Delete Stat',
        onPress: () => {
          Alert.alert(`Delete ${stat.title}?`, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Delete', style: 'destructive', onPress: () => { deleteItem(stat.id); refresh(); } },
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
      <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
        <View style={styles.scoreSection}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>DOMAIN SCORE</Text>
            <Text style={[styles.scorePercent, { color: palette.text }]}>{Math.round(domainScore)}%</Text>
          </View>
          <KatanaProgress progress={domainScore / 100} size={16} accessibilityLabel={`${title} domain score`} />
        </View>

        {projects.length === 0 ? (
          <View style={styles.empty}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No missions yet</Text>
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to add one to this domain</Text>
          </View>
        ) : (
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
        )}

        <View style={styles.statsSection}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>POTENTIAL STATS</Text>
            <TouchableOpacity onPress={promptAddStat} hitSlop={10}>
              <Text style={[styles.addLink, { color: palette.red }]}>+ Add</Text>
            </TouchableOpacity>
          </View>
          {stats.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No stats linked yet — add one to feed this Domain's maintenance score.</Text>
          ) : (
            <View style={styles.rows}>
              {stats.map((stat) => {
                const percent = Math.round(statResults[stat.id]?.percent ?? 0);
                return (
                  <TouchableOpacity
                    key={stat.id}
                    style={[styles.statRow, { backgroundColor: cardBg, borderColor: cardBorder }]}
                    activeOpacity={0.75}
                    onLongPress={() => handleStatLongPress(stat)}
                    delayLongPress={400}
                  >
                    <View style={styles.statRowHeader}>
                      <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{stat.title}</Text>
                      <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{percent}%</Text>
                    </View>
                    <KatanaProgress progress={percent / 100} size={16} accessibilityLabel={`${stat.title} potential`} />
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        {achievements.length > 0 && (
          <View style={styles.statsSection}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ACHIEVEMENTS</Text>
            <View style={styles.rows}>
              {achievements.map((achievement) => {
                const meta = achievement.metadata ? JSON.parse(achievement.metadata) : {};
                return (
                  <View key={achievement.id} style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                    <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{achievement.title}</Text>
                    <Text style={[styles.rowCount, { color: palette.textTertiary }]}>
                      {meta.earnedAt}{meta.contributesToScore === false ? ' · display only' : ''}
                    </Text>
                  </View>
                );
              })}
            </View>
          </View>
        )}
      </ScrollView>

      <QuickCreateSheet
        visible={createOpen}
        title="New Mission"
        placeholder="Mission name..."
        icon={<ProjectPortfolioIcon size={38} />}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />

      <QuickCreateSheet
        visible={statCreateOpen}
        title={statEditTarget ? 'Rename Stat' : 'New Potential Stat'}
        placeholder="Stat name..."
        initialValue={statEditTarget?.title}
        onClose={() => { setStatCreateOpen(false); setStatEditTarget(null); }}
        onSubmit={handleSaveStat}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  scoreSection: {
    gap: 8,
    marginBottom: 20,
  },
  statsSection: {
    gap: 8,
    marginTop: 20,
  },
  scoreHeaderRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: 1,
  },
  scorePercent: {
    fontSize: 20,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  addLink: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  statRow: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 8,
  },
  statRowHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
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
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
