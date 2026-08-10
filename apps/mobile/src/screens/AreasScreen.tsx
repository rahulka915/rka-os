import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAreas } from '../hooks/useDb';
import {
  createItem,
  updateItem,
  deleteItem,
  getAreaProjectCount,
  computeAllDomainScores,
  convertAreaToSkill,
  mergeAreaIntoArea,
  getFocus,
  getSkillsForArea,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { RiverStoneSurface } from '../components/riverstone';
import { RiverStoneProgress } from '../components/ui/RiverStoneProgress';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { showActionSheet } from '../utils/actionSheet';
import { Heart } from '../icons';
import type { Item } from '../db/types';
import type { FocusData } from '../db/database';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { getDomainIcon } from '../utils/domainIcons';

const NUMBER_WORDS: Record<number, string> = {
  1: 'One', 2: 'Two', 3: 'Three', 4: 'Four', 5: 'Five', 6: 'Six', 7: 'Seven', 8: 'Eight',
  9: 'Nine', 10: 'Ten', 11: 'Eleven', 12: 'Twelve',
};

// No header "+" — holding the dock FAB while this screen is focused opens
// New Area instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function AreasScreen() {
  const navigation = useNavigation();
  const { areas, refresh } = useAreas();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});
  const [skillCounts, setSkillCounts] = useState<Record<string, number>>({});
  const [projectCounts, setProjectCounts] = useState<Record<string, number>>({});
  const [overall, setOverall] = useState(0);
  const [focus, setFocus] = useState<FocusData | null>(null);

  useFocusEffect(
    useCallback(() => {
      const nextSkillCounts: Record<string, number> = {};
      const nextProjectCounts: Record<string, number> = {};
      for (const area of areas) {
        nextSkillCounts[area.id] = getSkillsForArea(area.id).length;
        // Precomputed here (once on focus) rather than in the grid's render
        // map, where it ran a COUNT query per Domain on every re-render.
        nextProjectCounts[area.id] = getAreaProjectCount(area.id);
      }
      const { scores, overall: nextOverall } = computeAllDomainScores();
      setScores(scores);
      setSkillCounts(nextSkillCounts);
      setProjectCounts(nextProjectCounts);
      setOverall(nextOverall);
      setFocus(getFocus());
    }, [areas]),
  );

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (title: string) => {
    if (editTarget) {
      updateItem(editTarget.id, { title });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      return;
    }
    createItem('area', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const isCanonicalDomain = (item: Item) => {
    const meta = item.metadata ? JSON.parse(item.metadata) : {};
    return meta.canonical === true;
  };

  const promptConvertToSkill = (item: Item) => {
    const otherAreas = areas.filter((a) => a.id !== item.id);
    if (otherAreas.length === 0) {
      Alert.alert('No other Domain to move into', 'Convert to Skill re-homes this Domain’s Missions and Potential Stats onto another real Domain — create one first.');
      return;
    }
    showActionSheet(`Convert "${item.title}" to a Skill — pick its primary Domain`, [
      ...otherAreas.map((area) => ({
        label: area.title,
        onPress: () => {
          const skillId = convertAreaToSkill(item.id, area.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refresh();
          (navigation as any).navigate('SkillDetail', { skillId, title: item.title });
        },
      })),
    ]);
  };

  // "Merge into..." is available on every Domain, including canonical ones —
  // it's how duplicate baseline Domains (e.g. two "Career" from repeated
  // onboarding runs) get consolidated back down to one. Re-homes everything
  // (Missions, Stats, Achievements, Skill links, historical scoring) onto
  // the chosen target, transfers the canonical flag if the source had one,
  // then deletes the source — a deliberate exception to the "canonical
  // Domains can't be deleted" rule, since the target absorbs its identity.
  const promptMergeInto = (item: Item) => {
    const otherAreas = areas.filter((a) => a.id !== item.id);
    if (otherAreas.length === 0) return;
    showActionSheet(`Merge "${item.title}" into...`, [
      ...otherAreas.map((area) => ({
        label: area.title,
        onPress: () => {
          Alert.alert(
            `Merge "${item.title}" into "${area.title}"?`,
            'Its Missions, Stats, Achievements, and Skill links move to the target Domain, and this Domain is deleted. This cannot be undone.',
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Merge',
                style: 'destructive',
                onPress: () => {
                  mergeAreaIntoArea(item.id, area.id);
                  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
                  refresh();
                },
              },
            ],
          );
        },
      })),
    ]);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);

    // The 8 baseline Domains (metadata.canonical, set during onboarding) are
    // a mandatory minimum — renameable via Edit, but never deletable or
    // convertible to a Skill (both would drop the count below 8). Only
    // Domains added beyond the baseline can be removed. Merging is the one
    // exception (see promptMergeInto above) since it consolidates identity
    // rather than dropping it.
    if (isCanonicalDomain(item)) {
      Alert.alert(item.title, undefined, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Edit', onPress: () => { setEditTarget(item); setCreateOpen(true); } },
        { text: 'Merge into...', onPress: () => promptMergeInto(item) },
      ]);
      return;
    }

    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => { setEditTarget(item); setCreateOpen(true); } },
      { text: 'Convert to Skill...', onPress: () => promptConvertToSkill(item) },
      { text: 'Merge into...', onPress: () => promptMergeInto(item) },
      {
        text: 'Delete',
        style: 'destructive',
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
      },
    ]);
  };

  const focusDomainId = focus ? Object.keys(focus.weights).find((id) => focus.weights[id] > 1) ?? null : null;
  const focusDomainTitle = areas.find((a) => a.id === focusDomainId)?.title;
  const sectionLabel = NUMBER_WORDS[areas.length] ? `YOUR ${NUMBER_WORDS[areas.length].toUpperCase()} DOMAINS` : 'YOUR DOMAINS';

  return (
    <LensSurface title="Domains">
      {areas.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No domains yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            Domains group related missions (e.g. Health, Finances). Hold the + in the dock to create one.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <RiverStoneSurface variant="hero" mode={isDark ? 'dark' : 'light'} style={styles.heroCard} contentStyle={styles.heroInner}>
              <View style={styles.heroCopy}>
                <Text style={[styles.heroTitle, { color: palette.ivory }]}>Overall Potential</Text>
                <Text style={[styles.heroSubtitle, { color: palette.greige }]}>Your life in balance.</Text>
              </View>
              <RiverStoneProgress
                progress={overall / 100}
                isDark={isDark}
                height={12}
                accessibilityLabel="Overall potential"
              />
              {focus && (
                <TouchableOpacity
                  style={[styles.focusChip, { backgroundColor: isDark ? palette.fill : `${palette.vermilion}14`, borderColor: palette.separatorStrong }]}
                  onPress={() => (navigation as any).navigate('Focus')}
                  activeOpacity={0.75}
                  accessibilityRole="button"
                  accessibilityLabel={`Current Focus: ${focus.label}`}
                >
                  <Text style={[styles.focusChipText, { color: palette.textSecondary }]} numberOfLines={1}>
                    Current Focus · <Text style={{ color: palette.vermilion, fontWeight: '700' }}>{focusDomainTitle ?? focus.label}</Text>
                  </Text>
                  <Heart size={14} color={palette.vermilion} strokeWidth={1.8} />
                </TouchableOpacity>
              )}
          </RiverStoneSurface>

          <View style={styles.sectionHead}>
            <Text style={[styles.sectionLabel, { color: palette.antiqueBrass }]}>{sectionLabel}</Text>
          </View>

          <View style={styles.grid}>
            {areas.map((area) => {
              const count = projectCounts[area.id] ?? 0;
              const skillCount = skillCounts[area.id] ?? 0;
              const score = Math.round(scores[area.id] ?? 0);
              const DomainIcon = getDomainIcon(area.title);
              const isFocus = area.id === focusDomainId;
              const metaParts = [
                skillCount > 0 ? `${skillCount} skill${skillCount === 1 ? '' : 's'}` : null,
                count > 0 ? `${count} mission${count === 1 ? '' : 's'}` : null,
              ].filter(Boolean);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={styles.cardWrap}
                  activeOpacity={0.82}
                  onPress={() => (navigation as any).navigate('AreaDetail', { areaId: area.id, title: area.title })}
                  onLongPress={() => handleLongPress(area)}
                  delayLongPress={400}
                  accessibilityRole="button"
                  accessibilityLabel={`${area.title}, ${score}% potential, ${count} missions${isFocus ? ', current focus' : ''}`}
                >
                  <RiverStoneSurface
                    variant="card"
                    mode={isDark ? 'dark' : 'light'}
                    style={[styles.card, isFocus && { borderColor: palette.vermilion, borderWidth: 1.5 }]}
                    contentStyle={styles.cardContent}
                  >
                      <View style={styles.cardHeadRow}>
                        <DomainIcon size={20} color={palette.antiqueBrass} strokeWidth={1.6} />
                        <Text style={[styles.cardScore, { color: palette.vermilion }]}>{score}%</Text>
                      </View>
                      <Text style={[styles.cardTitle, { color: palette.ivory }]} numberOfLines={2}>{area.title}</Text>
                      <Text style={[styles.cardMeta, { color: palette.greige }]} numberOfLines={1}>
                        {metaParts.length > 0 ? metaParts.join(' · ') : 'No activity yet'}
                      </Text>
                      <RiverStoneProgress
                        progress={score / 100}
                        isDark={isDark}
                        height={6}
                        showLabel={false}
                        animate={false}
                        accessibilityLabel={`${area.title} progress`}
                      />
                  </RiverStoneSurface>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title={editTarget ? 'Edit Domain' : 'New Domain'}
        placeholder="Domain name..."
        icon={<AreaBonsaiIcon size={38} />}
        initialValue={editTarget?.title}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        onSubmit={handleCreate}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    gap: 12,
  },
  heroCard: { marginTop: 4 },
  heroInner: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  heroCopy: { gap: 1 },
  heroTitle: { fontFamily: 'Newsreader_600SemiBold', fontSize: 18 },
  heroSubtitle: { fontFamily: 'Inter_400Regular', fontSize: 12, fontWeight: '400' },
  focusChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 36,
  },
  focusChipText: { fontSize: 12, fontWeight: '500', fontFamily: 'Inter_500Medium', flex: 1, marginRight: 8 },
  sectionHead: { paddingHorizontal: 2 },
  sectionLabel: { fontSize: 11, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 8,
  },
  cardWrap: {
    width: '48%',
    minHeight: 44,
  },
  card: {},
  cardContent: {
    padding: 10,
    gap: 4,
    minHeight: 116,
  },
  cardHeadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    minHeight: 34,
  },
  cardScore: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  cardMeta: {
    fontSize: 11,
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
