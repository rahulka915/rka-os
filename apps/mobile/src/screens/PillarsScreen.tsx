import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  getPotentialStats,
  getAreaForPotentialStat,
  createPotentialStat,
  setPotentialStatArea,
  updateItem,
  deleteItem,
  getItemsByType,
  getCompletedOccurrenceDates,
  formatDate,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { RiverStoneSurface } from '../components/riverstone';
import { RiverStoneProgress } from '../components/ui/RiverStoneProgress';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { showActionSheet } from '../utils/actionSheet';
import { SUGGESTED_PILLARS, computePotentialStats, type PotentialStatResult } from '../utils/potential';
import type { Item } from '../db/types';

interface PillarRow {
  stat: Item;
  result: PotentialStatResult;
  domainTitle: string | null;
}

export function PillarsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [rows, setRows] = useState<PillarRow[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  const refresh = useCallback(() => {
    const stats = getPotentialStats();
    const habits = getItemsByType('habit');
    const today = formatDate(new Date());
    const completedDatesByHabitId: Record<string, Set<string>> = {};
    for (const h of habits) {
      completedDatesByHabitId[h.id] = getCompletedOccurrenceDates(h.id);
    }
    const statItems = stats.map((s) => ({ id: s.id, title: s.title }));
    const results = computePotentialStats(habits, statItems, completedDatesByHabitId, today);
    const areas = getItemsByType('area');
    const areaById = new Map<string, string>(areas.map((a) => [a.id, a.title]));
    const nextRows: PillarRow[] = stats.map((stat) => {
      const areaId = getAreaForPotentialStat(stat.id);
      return {
        stat,
        result: results[stat.id] ?? { stat: stat.id, percent: 0, contributions: [] },
        domainTitle: areaId ? (areaById.get(areaId) ?? null) : null,
      };
    });
    setRows(nextRows);
  }, []);

  useFocusEffect(refresh);

  const handleSave = (title: string) => {
    if (editTarget) {
      updateItem(editTarget.id, { title });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      return;
    }
    createPotentialStat(title);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const promptAdd = () => {
    const existingTitles = new Set(rows.map((r) => r.stat.title.toLowerCase()));
    const suggestions = SUGGESTED_PILLARS.flatMap((g) => g.pillars).filter(
      (t) => !existingTitles.has(t.toLowerCase()),
    );
    showActionSheet('Add Pillar', [
      {
        label: 'New Pillar...',
        onPress: () => { setEditTarget(null); setCreateOpen(true); },
      },
      ...suggestions.map((title) => ({
        label: `Suggested: ${title}`,
        onPress: () => {
          createPotentialStat(title);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refresh();
        },
      })),
    ]);
  };

  const promptLongPress = (row: PillarRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    const areas = getItemsByType('area');
    showActionSheet(row.stat.title, [
      {
        label: 'Rename',
        onPress: () => { setEditTarget(row.stat); setCreateOpen(true); },
      },
      {
        label: row.domainTitle ? 'Change Domain...' : 'Link to Domain...',
        onPress: () => promptLinkDomain(row),
      },
      ...(row.domainTitle
        ? [{
            label: 'Unlink from Domain',
            onPress: () => { setPotentialStatArea(row.stat.id, null); refresh(); },
          }]
        : []),
      {
        label: 'Delete',
        onPress: () => {
          Alert.alert(`Delete ${row.stat.title}?`, 'This cannot be undone.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => { deleteItem(row.stat.id); refresh(); },
            },
          ]);
        },
        destructive: true,
      },
    ]);
  };

  const promptLinkDomain = (row: PillarRow) => {
    const areas = getItemsByType('area');
    showActionSheet('Link to Domain', [
      { text: 'Cancel', style: 'cancel' } as any,
      ...areas.map((area) => ({
        label: area.title,
        onPress: () => { setPotentialStatArea(row.stat.id, area.id); refresh(); },
      })),
    ]);
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  return (
    <RiverStoneSurface style={styles.root}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: palette.text }]}>Pillars</Text>
          <TouchableOpacity
            onPress={promptAdd}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityLabel="Add a Pillar"
          >
            <Text style={[styles.addLink, { color: palette.vermilion }]}>+ Add</Text>
          </TouchableOpacity>
        </View>

        {rows.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={[styles.emptyTitle, { color: palette.text }]}>No Pillars yet</Text>
            <Text style={[styles.emptyBody, { color: palette.textSecondary }]}>
              Pillars are optional maintenance areas (mostly Health & Fitness) like Sleep, Hydration, Strength.
            </Text>
          </View>
        ) : (
          <View style={styles.list}>
            {rows.map((row) => {
              const percent = Math.round(row.result.percent);
              const expanded = expandedId === row.stat.id;
              return (
                <TouchableOpacity
                  key={row.stat.id}
                  style={[styles.card, { backgroundColor: cardBg, borderColor: cardBorder }]}
                  activeOpacity={0.78}
                  onPress={() => setExpandedId(expanded ? null : row.stat.id)}
                  onLongPress={() => promptLongPress(row)}
                  delayLongPress={400}
                  accessibilityRole="button"
                  accessibilityLabel={`${row.stat.title}, ${percent}% maintenance`}
                >
                  <View style={styles.cardHeader}>
                    <View style={styles.cardMeta}>
                      <Text style={[styles.cardTitle, { color: palette.text }]} numberOfLines={1}>
                        {row.stat.title}
                      </Text>
                      <Text style={[styles.cardDomain, { color: palette.textTertiary }]}>
                        {row.domainTitle ?? 'Unlinked'}
                      </Text>
                    </View>
                    <View style={styles.cardRight}>
                      <Text style={[styles.cardPercent, { color: palette.textSecondary }]}>{percent}%</Text>
                      <Text style={[styles.cardHabitCount, { color: palette.textTertiary }]}>
                        {row.result.contributions.length} {row.result.contributions.length === 1 ? 'habit' : 'habits'}
                      </Text>
                    </View>
                  </View>
                  <RiverStoneProgress
                    progress={percent / 100}
                    isDark={isDark}
                    height={8}
                    showLabel={false}
                    accessibilityLabel={`${row.stat.title} maintenance`}
                    style={styles.progress}
                  />
                  {expanded && row.result.contributions.length > 0 && (
                    <View style={styles.contributions}>
                      {row.result.contributions.map((c) => (
                        <View key={c.habitId} style={styles.contributionRow}>
                          <Text style={[styles.contributionTitle, { color: palette.textSecondary }]} numberOfLines={1}>
                            {c.habitTitle}
                          </Text>
                          <Text style={[styles.contributionPercent, { color: palette.textTertiary }]}>
                            {Math.round(c.percent)}%
                          </Text>
                        </View>
                      ))}
                    </View>
                  )}
                  {expanded && row.result.contributions.length === 0 && (
                    <Text style={[styles.noContributions, { color: palette.textTertiary }]}>
                      No habits assigned to this Pillar yet.
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        )}
      </ScrollView>

      <QuickCreateSheet
        visible={createOpen}
        title={editTarget ? 'Rename Pillar' : 'New Pillar'}
        placeholder={editTarget ? 'Rename Pillar' : 'New Pillar name'}
        initialValue={editTarget?.title ?? ''}
        onSubmit={handleSave}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
      />
    </RiverStoneSurface>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  content: { padding: 16, paddingBottom: 48 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  heading: { fontSize: 28, fontWeight: '700', letterSpacing: -0.5 },
  addLink: { fontSize: 16, fontWeight: '600' },
  emptyState: { paddingTop: 48, paddingHorizontal: 8, alignItems: 'center' },
  emptyTitle: { fontSize: 18, fontWeight: '600', marginBottom: 8, textAlign: 'center' },
  emptyBody: { fontSize: 14, lineHeight: 20, textAlign: 'center' },
  list: { gap: 8 },
  card: {
    borderRadius: 14,
    padding: 14,
    borderWidth: StyleSheet.hairlineWidth,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  cardMeta: { flex: 1, marginRight: 8 },
  cardTitle: { fontSize: 16, fontWeight: '600', marginBottom: 2 },
  cardDomain: { fontSize: 12 },
  cardRight: { alignItems: 'flex-end' },
  cardPercent: { fontSize: 15, fontWeight: '600' },
  cardHabitCount: { fontSize: 12, marginTop: 2 },
  progress: { marginBottom: 0 },
  contributions: { marginTop: 10, gap: 4 },
  contributionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  contributionTitle: { fontSize: 13, flex: 1, marginRight: 8 },
  contributionPercent: { fontSize: 13 },
  noContributions: { marginTop: 8, fontSize: 13, fontStyle: 'italic' },
});
