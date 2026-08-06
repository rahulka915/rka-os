import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation, useRoute } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import {
  getItemWithMetadata,
  updateSkillProficiency,
  getPrimaryAreaForSkill,
  setPrimaryAreaForSkill,
  getSecondaryAreasForSkill,
  setSkillSecondaryAreas,
  getItemsByType,
  getHabitsForSkill,
  linkHabitToSkill,
  getRoutinesForSkill,
  linkRoutineToSkill,
  getMissionsForSkill,
  linkMissionToSkill,
  getMilestonesForSkill,
  createSkillMilestone,
  deleteSkillMilestone,
  setSkillMilestoneContributesToScore,
  computeSkillPracticeSummary,
  formatDate,
} from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { showActionSheet } from '../utils/actionSheet';
import { Sparkles, Flame, ListChecks } from '../icons';
import { ProjectPortfolioIcon } from '../components/icons/ProjectPortfolioIcon';
import { getDomainIcon } from '../utils/domainIcons';
import type { Item } from '../db/types';

interface SkillDetailRouteParams {
  skillId: string;
  title: string;
}

const PROFICIENCY_LEVELS = [
  { label: 'Beginner', value: 20 },
  { label: 'Novice', value: 40 },
  { label: 'Intermediate', value: 60 },
  { label: 'Advanced', value: 80 },
  { label: 'Expert', value: 100 },
];

export function SkillDetailScreen() {
  const navigation = useNavigation();
  const route = useRoute();
  const { skillId, title } = route.params as SkillDetailRouteParams;
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const [proficiency, setProficiency] = useState(0);
  const [primaryAreaId, setPrimaryAreaId] = useState<string | null>(null);
  const [secondaryAreaIds, setSecondaryAreaIds] = useState<string[]>([]);
  const [areas, setAreas] = useState<Item[]>([]);
  const [habits, setHabits] = useState<Item[]>([]);
  const [routines, setRoutines] = useState<Item[]>([]);
  const [missions, setMissions] = useState<Item[]>([]);
  const [milestones, setMilestones] = useState<Item[]>([]);
  const [practice, setPractice] = useState({ habitCompletions30d: 0, routineSessionsCompleted: 0 });

  const refresh = useCallback(() => {
    const item = getItemWithMetadata(skillId);
    const meta = item?.metadata ? JSON.parse(item.metadata) : {};
    setProficiency(typeof meta.proficiency === 'number' ? meta.proficiency : 0);
    setPrimaryAreaId(getPrimaryAreaForSkill(skillId));
    setSecondaryAreaIds(getSecondaryAreasForSkill(skillId));
    setAreas(getItemsByType('area'));
    setHabits(getHabitsForSkill(skillId));
    setRoutines(getRoutinesForSkill(skillId));
    setMissions(getMissionsForSkill(skillId));
    setMilestones(getMilestonesForSkill(skillId));
    setPractice(computeSkillPracticeSummary(skillId));
  }, [skillId]);

  useFocusEffect(refresh);

  const handleSetProficiency = (value: number) => {
    Haptics.selectionAsync();
    updateSkillProficiency(skillId, value);
    refresh();
  };

  const promptPrimaryArea = () => {
    showActionSheet('Primary Domain', [
      { label: 'None', onPress: () => { setPrimaryAreaForSkill(skillId, null); refresh(); } },
      ...areas.map((area) => ({ label: area.title, onPress: () => { setPrimaryAreaForSkill(skillId, area.id); refresh(); } })),
    ]);
  };

  const toggleSecondaryArea = (areaId: string) => {
    const next = secondaryAreaIds.includes(areaId)
      ? secondaryAreaIds.filter((id) => id !== areaId)
      : [...secondaryAreaIds, areaId];
    setSkillSecondaryAreas(skillId, next);
    refresh();
  };

  const promptLinkHabit = () => {
    const linkedIds = new Set(habits.map((h) => h.id));
    const unlinked = getItemsByType('habit').filter((h) => !linkedIds.has(h.id));
    if (unlinked.length === 0) return;
    showActionSheet('Link a Habit', unlinked.map((h) => ({ label: h.title, onPress: () => { linkHabitToSkill(h.id, skillId); refresh(); } })));
  };

  const promptLinkRoutine = () => {
    const linkedIds = new Set(routines.map((r) => r.id));
    const unlinked = getItemsByType('routine').filter((r) => !linkedIds.has(r.id));
    if (unlinked.length === 0) return;
    showActionSheet('Link a Routine', unlinked.map((r) => ({ label: r.title, onPress: () => { linkRoutineToSkill(r.id, skillId); refresh(); } })));
  };

  const promptLinkMission = () => {
    const linkedIds = new Set(missions.map((m) => m.id));
    const unlinked = getItemsByType('project').filter((m) => !linkedIds.has(m.id));
    if (unlinked.length === 0) return;
    showActionSheet('Link a Mission', unlinked.map((m) => ({ label: m.title, onPress: () => { linkMissionToSkill(m.id, skillId); refresh(); } })));
  };

  const promptAddMilestone = () => {
    Alert.prompt('New Milestone', 'What did you accomplish?', (milestoneTitle) => {
      const trimmed = milestoneTitle?.trim();
      if (!trimmed) return;
      showActionSheet('Contributes to Potential?', [
        { label: 'Yes — contributes to score', onPress: () => { createSkillMilestone(skillId, trimmed, formatDate(new Date()), true); Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); refresh(); } },
        { label: 'No — display only', onPress: () => { createSkillMilestone(skillId, trimmed, formatDate(new Date()), false); refresh(); } },
      ]);
    });
  };

  const handleMilestoneLongPress = (milestone: Item) => {
    const meta = milestone.metadata ? JSON.parse(milestone.metadata) : {};
    const contributes = meta.contributesToScore !== false;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(milestone.title, [
      {
        label: contributes ? 'Turn off: contributes to score' : 'Turn on: contributes to score',
        onPress: () => { setSkillMilestoneContributesToScore(milestone.id, !contributes); refresh(); },
      },
      { label: 'Delete', destructive: true, onPress: () => { deleteSkillMilestone(milestone.id); refresh(); } },
    ]);
  };

  const cardBg = isDark ? palette.fillStrong : palette.surface;
  const cardBorder = isDark ? palette.separatorStrong : palette.separator;
  const primaryAreaTitle = areas.find((a) => a.id === primaryAreaId)?.title;

  return (
    <LensSurface title={title}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.proficiencySection}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PROFICIENCY</Text>
          <View style={styles.levelRow}>
            {PROFICIENCY_LEVELS.map((level) => {
              const selected = proficiency >= level.value;
              return (
                <TouchableOpacity
                  key={level.value}
                  style={[styles.levelChip, { borderColor: selected ? palette.vermilion : palette.separatorStrong, backgroundColor: selected ? `${palette.vermilion}22` : 'transparent' }]}
                  onPress={() => handleSetProficiency(level.value)}
                  accessibilityRole="button"
                  accessibilityLabel={`Set proficiency to ${level.label}, ${level.value}%`}
                >
                  <Text style={[styles.levelText, { color: selected ? palette.vermilion : palette.textSecondary }]} numberOfLines={1}>{level.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>PRACTICE (LAST 30 DAYS)</Text>
          <View style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <Flame size={20} color={palette.red} strokeWidth={1.8} />
            <Text style={[styles.rowTitle, { color: palette.text }]}>{practice.habitCompletions30d} habit check-ins</Text>
          </View>
          <View style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
            <ListChecks size={20} color={palette.antiqueBrass} strokeWidth={1.8} />
            <Text style={[styles.rowTitle, { color: palette.text }]}>{practice.routineSessionsCompleted} routine sessions completed</Text>
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>RELATED DOMAINS</Text>
          </View>
          <TouchableOpacity style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]} onPress={promptPrimaryArea} accessibilityRole="button" accessibilityLabel={primaryAreaTitle ? `Primary Domain: ${primaryAreaTitle}` : 'Set primary Domain'}>
            <Text style={[styles.rowLabel, { color: palette.textTertiary }]}>PRIMARY</Text>
            <Text style={[styles.rowTitle, { color: palette.text, flex: 1 }]}>{primaryAreaTitle ?? 'Set primary Domain'}</Text>
          </TouchableOpacity>
          <View style={styles.chipRow}>
            {areas.filter((a) => a.id !== primaryAreaId).map((area) => {
              const selected = secondaryAreaIds.includes(area.id);
              const AreaIcon = getDomainIcon(area.title);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.chip, { borderColor: selected ? palette.antiqueBrass : palette.separatorStrong, backgroundColor: selected ? `${palette.antiqueBrass}22` : 'transparent' }]}
                  onPress={() => toggleSecondaryArea(area.id)}
                  accessibilityRole="button"
                  accessibilityLabel={`${selected ? 'Remove' : 'Add'} ${area.title} as a secondary Domain`}
                >
                  <AreaIcon size={14} color={selected ? palette.antiqueBrass : palette.textTertiary} strokeWidth={1.8} />
                  <Text style={[styles.chipText, { color: selected ? palette.text : palette.textSecondary }]}>{area.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={styles.section}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKED HABITS</Text>
            <TouchableOpacity onPress={promptLinkHabit} hitSlop={10} accessibilityRole="button" accessibilityLabel="Link a habit"><Text style={[styles.addLink, { color: palette.vermilion }]}>+ Link</Text></TouchableOpacity>
          </View>
          {habits.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No habits linked yet.</Text>
          ) : habits.map((h) => (
            <View key={h.id} style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <Flame size={18} color={palette.red} strokeWidth={1.8} />
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{h.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LINKED ROUTINES</Text>
            <TouchableOpacity onPress={promptLinkRoutine} hitSlop={10} accessibilityRole="button" accessibilityLabel="Link a routine"><Text style={[styles.addLink, { color: palette.vermilion }]}>+ Link</Text></TouchableOpacity>
          </View>
          {routines.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No routines linked yet.</Text>
          ) : routines.map((r) => (
            <View key={r.id} style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}>
              <ListChecks size={18} color={palette.antiqueBrass} strokeWidth={1.8} />
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{r.title}</Text>
            </View>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>ACTIVE MISSIONS</Text>
            <TouchableOpacity onPress={promptLinkMission} hitSlop={10} accessibilityRole="button" accessibilityLabel="Link a mission"><Text style={[styles.addLink, { color: palette.vermilion }]}>+ Link</Text></TouchableOpacity>
          </View>
          {missions.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No missions linked yet.</Text>
          ) : missions.map((m) => (
            <TouchableOpacity
              key={m.id}
              style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}
              onPress={() => (navigation as any).navigate('ProjectDetail', { projectId: m.id, title: m.title })}
              accessibilityRole="button"
              accessibilityLabel={m.title}
            >
              <ProjectPortfolioIcon size={20} />
              <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{m.title}</Text>
            </TouchableOpacity>
          ))}
        </View>

        <View style={styles.section}>
          <View style={styles.scoreHeaderRow}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>MILESTONES</Text>
            <TouchableOpacity onPress={promptAddMilestone} hitSlop={10} accessibilityRole="button" accessibilityLabel="Add a milestone"><Text style={[styles.addLink, { color: palette.vermilion }]}>+ Add</Text></TouchableOpacity>
          </View>
          {milestones.length === 0 ? (
            <Text style={[styles.emptySub, { color: palette.textSecondary }]}>No milestones yet — add one when you reach a real turning point.</Text>
          ) : milestones.map((milestone) => {
            const meta = milestone.metadata ? JSON.parse(milestone.metadata) : {};
            return (
              <TouchableOpacity
                key={milestone.id}
                style={[styles.row, { backgroundColor: cardBg, borderColor: cardBorder }]}
                onLongPress={() => handleMilestoneLongPress(milestone)}
                delayLongPress={400}
                accessibilityRole="button"
                accessibilityLabel={`${milestone.title}, ${meta.earnedAt}`}
              >
                <Sparkles size={18} color={palette.red} strokeWidth={1.8} />
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{milestone.title}</Text>
                <Text style={[styles.rowMeta, { color: palette.textTertiary }]}>{meta.earnedAt}{meta.contributesToScore === false ? ' · display only' : ''}</Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  proficiencySection: { gap: 10, marginBottom: 20 },
  levelRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  levelChip: { borderRadius: 16, borderWidth: 1.5, paddingHorizontal: 12, paddingVertical: 10, minHeight: 44, justifyContent: 'center' },
  levelText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  section: { gap: 8, marginTop: 20 },
  scoreHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sectionLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  addLink: { fontSize: 14, fontWeight: '600', fontFamily: 'Inter_600SemiBold', minHeight: 44, textAlignVertical: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 14,
    minHeight: 44,
  },
  rowLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 0.8, marginRight: 4 },
  rowTitle: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold', flex: 1 },
  rowMeta: { fontSize: 12, fontWeight: '500', fontFamily: 'Inter_500Medium' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 4 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 16,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    minHeight: 44,
  },
  chipText: { fontSize: 12, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptySub: { fontSize: 13, fontFamily: 'Inter_400Regular', fontWeight: '400' },
});
