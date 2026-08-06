import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getAllAchievements, getAreaForAchievement, getItemsByType, createAchievement, formatDate } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { showActionSheet } from '../utils/actionSheet';
import { Sparkles, Plus } from '../icons';
import type { Item } from '../db/types';

interface AchievementRow {
  item: Item;
  earnedAt: string;
  contributesToScore: boolean;
  domainTitle: string | null;
}

export function AchievementsScreen() {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [rows, setRows] = useState<AchievementRow[]>([]);

  const load = useCallback(() => {
    const achievements = getAllAchievements();
    const areasById = new Map(getItemsByType('area').map((a) => [a.id, a.title]));
    const built = achievements.map((item) => {
      const meta = item.metadata ? JSON.parse(item.metadata) : {};
      const areaId = getAreaForAchievement(item.id);
      return {
        item,
        earnedAt: meta.earnedAt ?? formatDate(new Date(item.createdAt)),
        contributesToScore: meta.contributesToScore !== false,
        domainTitle: areaId ? areasById.get(areaId) ?? null : null,
      };
    });
    built.sort((a, b) => b.earnedAt.localeCompare(a.earnedAt));
    setRows(built);
  }, []);

  useFocusEffect(load);

  const finishAdd = (title: string, areaId: string | null, earnedAt: string, contributesToScore: boolean) => {
    createAchievement({ title, areaId, earnedAt, source: 'manual', contributesToScore });
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    load();
  };

  const promptContributes = (title: string, areaId: string | null, earnedAt: string) => {
    showActionSheet('Contributes to Potential?', [
      { label: 'Yes — contributes to score', onPress: () => finishAdd(title, areaId, earnedAt, true) },
      { label: 'No — display only', onPress: () => finishAdd(title, areaId, earnedAt, false) },
    ]);
  };

  const promptDate = (title: string, areaId: string | null) => {
    Alert.prompt(
      'Earned Date',
      'YYYY-MM-DD (leave as-is for today)',
      (dateStr) => {
        const earnedAt = dateStr && /^\d{4}-\d{2}-\d{2}$/.test(dateStr) ? dateStr : formatDate(new Date());
        promptContributes(title, areaId, earnedAt);
      },
      'plain-text',
      formatDate(new Date()),
    );
  };

  const promptDomain = (title: string) => {
    const areas = getItemsByType('area');
    showActionSheet('Domain', [
      { label: 'No Domain', onPress: () => promptDate(title, null) },
      ...areas.map((area) => ({ label: area.title, onPress: () => promptDate(title, area.id) })),
    ]);
  };

  const handleAdd = () => {
    Alert.prompt('New Achievement', 'What did you accomplish?', (title) => {
      const trimmed = title?.trim();
      if (!trimmed) return;
      promptDomain(trimmed);
    });
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;

  return (
    <LensSurface
      title="Achievements"
      headerRight={
        <TouchableOpacity onPress={handleAdd} accessibilityRole="button" accessibilityLabel="Add achievement" hitSlop={10}>
          <Plus size={22} color={palette.text} strokeWidth={1.8} />
        </TouchableOpacity>
      }
    >
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Sparkles size={36} color={palette.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No achievements yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            Completed achievement-worthy Missions land here automatically — or tap + to add one retrospectively.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {rows.map(({ item, earnedAt, contributesToScore, domainTitle }) => (
              <View key={item.id} style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
                <Sparkles size={22} color={palette.red} strokeWidth={1.75} />
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                  <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>
                    {domainTitle ?? 'No Domain'} · {earnedAt}{!contributesToScore ? ' · Display only' : ''}
                  </Text>
                </View>
              </View>
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
  rows: { gap: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  rowCopy: { flex: 1, gap: 2 },
  rowTitle: {
    fontSize: 15,
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
    paddingHorizontal: 32,
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
    textAlign: 'center',
  },
});
