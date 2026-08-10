import { useCallback, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getAllAchievements, getAreaForAchievement, getItemsByType, createAchievement, formatDate, deleteAchievement, setAchievementContributesToScore } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { RiverStoneSurface } from '../components/riverstone';
import { showActionSheet } from '../utils/actionSheet';
import { Sparkles, Plus, Trophy } from '../icons';
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
    const id = createAchievement({ title, areaId, earnedAt, source: 'manual', contributesToScore });
    // createAchievement only stores the contributesToScore flag — it never
    // inserts the domainContributions row itself (completeMission does that
    // separately for Mission-sourced trophies). This is what actually makes
    // "contributes to score" do something for a manually-added achievement.
    if (contributesToScore) setAchievementContributesToScore(id, true);
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

  const handleLongPress = (row: AchievementRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(row.item.title, [
      {
        label: row.contributesToScore ? 'Turn off: contributes to score' : 'Turn on: contributes to score',
        onPress: () => {
          setAchievementContributesToScore(row.item.id, !row.contributesToScore);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          load();
        },
      },
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          deleteAchievement(row.item.id);
          load();
        },
      },
    ]);
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
        <View style={styles.emptyContent}>
          <RiverStoneSurface variant="hero" mode={isDark ? 'dark' : 'light'} contentStyle={styles.emptyHero}>
            <View style={[styles.trophyDisc, { borderColor: palette.antiqueBrass }]}>
              <Trophy size={30} color={palette.antiqueBrass} strokeWidth={1.5} />
            </View>
            <Text style={[styles.emptyTitle, { color: palette.ivory }]}>Your collection begins here</Text>
            <Text style={[styles.emptySub, { color: palette.greige }]}>Completed milestone-worthy Missions appear automatically. You can also add a past achievement with +.</Text>
          </RiverStoneSurface>
          <Text style={[styles.collectionLabel, { color: palette.antiqueBrass }]}>YOUR COLLECTION</Text>
          <View style={styles.shelf}>
            {[0, 1, 2].map((slot) => (
              <View key={slot} style={[styles.emptySlot, { borderColor: palette.separatorStrong }]}>
                <Sparkles size={18} color={palette.textTertiary} strokeWidth={1.4} />
              </View>
            ))}
          </View>
          <Text style={[styles.shelfCaption, { color: palette.textSecondary }]}>Each milestone becomes a reflection of who you are becoming.</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {rows.map((row) => (
              <TouchableOpacity
                key={row.item.id}
                style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}
                activeOpacity={0.75}
                onLongPress={() => handleLongPress(row)}
                delayLongPress={400}
              >
                <View style={[styles.rowMedallion, { borderColor: row.contributesToScore ? palette.antiqueBrass : cardBorder }]}>
                  <Trophy size={19} color={row.contributesToScore ? palette.antiqueBrass : palette.textTertiary} strokeWidth={1.6} />
                </View>
                <View style={styles.rowCopy}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{row.item.title}</Text>
                  <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>
                    {row.domainTitle ?? 'No Domain'} · {row.earnedAt}{!row.contributesToScore ? ' · Display only' : ''}
                  </Text>
                </View>
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
  emptyContent: { paddingHorizontal: 16, paddingTop: 8, gap: 18 },
  emptyHero: { alignItems: 'center', paddingHorizontal: 24, paddingVertical: 28, gap: 10 },
  trophyDisc: { width: 62, height: 62, borderRadius: 31, borderWidth: 1, alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
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
    lineHeight: 20,
  },
  collectionLabel: { fontSize: 10, fontFamily: 'Inter_800ExtraBold', fontWeight: '800', letterSpacing: 1 },
  shelf: { flexDirection: 'row', justifyContent: 'space-between' },
  emptySlot: { width: '31%', aspectRatio: 1, borderRadius: 18, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
  shelfCaption: { fontSize: 13, lineHeight: 19, textAlign: 'center', fontFamily: 'Newsreader_600SemiBold' },
  rowMedallion: { width: 38, height: 38, borderRadius: 19, borderWidth: StyleSheet.hairlineWidth, alignItems: 'center', justifyContent: 'center' },
});
