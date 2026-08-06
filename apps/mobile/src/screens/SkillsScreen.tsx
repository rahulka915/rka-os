import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getSkills, createSkill, deleteItem, getPrimaryAreaForSkill, getItemsByType } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { RiverStoneSurface } from '../components/ui/RiverStoneSurface';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { showActionSheet } from '../utils/actionSheet';
import { PuzzlePiece } from '../icons';
import type { Item } from '../db/types';

interface SkillRow {
  item: Item;
  proficiency: number;
  primaryAreaTitle: string | null;
}

// Skills are a distinct capability layer from Domains: "Domains = areas of
// life you maintain, Skills = capabilities you develop" — a Skill links to
// one primary Domain (+ optional secondary Domains) for context but is
// otherwise its own list/detail flow, never merged into the Domains grid.
export function SkillsScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [rows, setRows] = useState<SkillRow[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const load = useCallback(() => {
    const areasById = new Map(getItemsByType('area').map((a) => [a.id, a.title]));
    const skills = getSkills();
    setRows(
      skills.map((item) => {
        const meta = item.metadata ? JSON.parse(item.metadata) : {};
        const primaryAreaId = getPrimaryAreaForSkill(item.id);
        return {
          item,
          proficiency: typeof meta.proficiency === 'number' ? meta.proficiency : 0,
          primaryAreaTitle: primaryAreaId ? areasById.get(primaryAreaId) ?? null : null,
        };
      }),
    );
  }, []);

  useFocusEffect(load);

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (title: string) => {
    const id = createSkill(title);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCreateOpen(false);
    load();
    (navigation as any).navigate('SkillDetail', { skillId: id, title });
  };

  const handleLongPress = (row: SkillRow) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(row.item.title, [
      {
        label: 'Delete',
        destructive: true,
        onPress: () => {
          deleteItem(row.item.id);
          load();
        },
      },
    ]);
  };

  return (
    <LensSurface title="Skills">
      {rows.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No skills yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            A Skill is a capability you develop — Guitar, App Development, Strength Training. Hold the + in the dock to add one.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.grid} showsVerticalScrollIndicator={false}>
          {rows.map((row) => (
            <TouchableOpacity
              key={row.item.id}
              style={styles.cardWrap}
              activeOpacity={0.82}
              onPress={() => (navigation as any).navigate('SkillDetail', { skillId: row.item.id, title: row.item.title })}
              onLongPress={() => handleLongPress(row)}
              delayLongPress={400}
              accessibilityRole="button"
              accessibilityLabel={`${row.item.title}, ${row.proficiency}% proficiency${row.primaryAreaTitle ? `, ${row.primaryAreaTitle}` : ''}`}
            >
              <RiverStoneSurface variant="card" isDark={isDark} style={styles.card} stretchToFill>
                <View style={styles.cardContent}>
                  <PuzzlePiece size={26} color={palette.antiqueBrass} strokeWidth={1.6} />
                  <Text style={[styles.cardTitle, { color: palette.ivory }]} numberOfLines={2}>{row.item.title}</Text>
                  <View style={styles.cardFooter}>
                    <Text style={[styles.cardProficiency, { color: palette.vermilion }]}>{row.proficiency}%</Text>
                    {row.primaryAreaTitle && (
                      <Text style={[styles.cardArea, { color: palette.greige }]} numberOfLines={1}>{row.primaryAreaTitle}</Text>
                    )}
                  </View>
                </View>
              </RiverStoneSurface>
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title="New Skill"
        placeholder="Skill name..."
        icon={<PuzzlePiece size={38} color={palette.red} />}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  grid: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cardWrap: {
    width: '31%',
    minHeight: 44,
  },
  card: {
    aspectRatio: 0.92,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 13,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
  },
  cardFooter: { gap: 2 },
  cardProficiency: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  cardArea: {
    fontSize: 10,
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
    lineHeight: 20,
  },
});
