import { useCallback, useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Flame, ListChecks, Lock, LockOpen, Plus, Sparkles, Trash2 } from 'lucide-react-native';
import {
  getSkills,
  createSkill,
  deleteItem,
  getPrimaryAreaForSkill,
  getItemsByType,
  isSkillUnlocked,
  getItemWithMetadata,
  updateSkillProficiency,
  setPrimaryAreaForSkill,
  getSecondaryAreasForSkill,
  setSkillSecondaryAreas,
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
  setSkillUnlocked,
  formatDate,
} from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { getSkillProficiencyLabel } from '../utils/skillIconKey';
import { DetailPanel } from './DetailPanel';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

interface SkillRow {
  item: Item;
  proficiency: number;
  primaryAreaTitle: string | null;
  unlocked: boolean;
}

const PROFICIENCY_LEVELS = [
  { label: 'Beginner', value: 20 },
  { label: 'Novice', value: 40 },
  { label: 'Intermediate', value: 60 },
  { label: 'Advanced', value: 80 },
  { label: 'Expert', value: 100 },
];

function useSkills() {
  const [rows, setRows] = useState<SkillRow[]>([]);
  const refresh = useCallback(() => {
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
          unlocked: isSkillUnlocked(item.id),
        };
      }),
    );
  }, []);
  useDbRefresh(refresh);
  return { rows, refresh };
}

export function SkillsScreen() {
  const { rows, refresh } = useSkills();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = rows.find((r) => r.item.id === selectedId)?.item ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    const id = createSkill(trimmed);
    setCaptureText('');
    refresh();
    setSelectedId(id);
  };

  const handleDelete = (row: SkillRow) => {
    deleteItem(row.item.id);
    if (selectedId === row.item.id) setSelectedId(null);
    refresh();
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Skills</Text>
        <Text style={styles.count}>{rows.length}</Text>
      </View>

      <View style={styles.captureRow}>
        <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
        <TextInput
          value={captureText}
          onChangeText={setCaptureText}
          onSubmitEditing={submit}
          placeholder="New skill..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.captureInput}
        />
      </View>

      <FlatList
        data={rows}
        keyExtractor={(row) => row.item.id}
        numColumns={3}
        contentContainerStyle={styles.grid}
        columnWrapperStyle={styles.gridRow}
        ListEmptyComponent={<Text style={styles.empty}>No skills yet — a Skill is a capability you develop.</Text>}
        renderItem={({ item: row }) => (
          <Pressable style={styles.card} onPress={() => setSelectedId(row.item.id)}>
            <View style={styles.cardTopRow}>
              <View style={[styles.identityDisc, !row.unlocked && styles.identityDiscLocked]}>
                <Text style={styles.identityInitial}>{row.item.title.charAt(0).toUpperCase()}</Text>
              </View>
              {!row.unlocked && <Lock size={13} color={webColors.mutedForeground} strokeWidth={2} />}
            </View>
            <Text style={styles.cardTitle} numberOfLines={2}>{row.item.title}</Text>
            <Text style={styles.cardProficiency}>{getSkillProficiencyLabel(row.proficiency)}</Text>
            {row.primaryAreaTitle ? <Text style={styles.cardArea} numberOfLines={1}>{row.primaryAreaTitle}</Text> : null}
          </Pressable>
        )}
      />

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title={selectedItem?.title ?? 'Skill'}>
        {selectedItem ? (
          <SkillDetailBody
            item={selectedItem}
            onChanged={refresh}
            onDelete={() => handleDelete(rows.find((r) => r.item.id === selectedItem.id)!)}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

function SkillDetailBody({ item, onChanged, onDelete }: { item: Item; onChanged: () => void; onDelete: () => void }) {
  const skillId = item.id;
  const [, forceTick] = useState(0);
  const rerender = () => forceTick((n) => n + 1);

  const meta = item.metadata ? JSON.parse(item.metadata) : {};
  const freshItem = getItemWithMetadata(skillId);
  const freshMeta = freshItem?.metadata ? JSON.parse(freshItem.metadata) : meta;
  const proficiency = typeof freshMeta.proficiency === 'number' ? freshMeta.proficiency : 0;
  const unlocked = isSkillUnlocked(skillId);
  const primaryAreaId = getPrimaryAreaForSkill(skillId);
  const secondaryAreaIds = getSecondaryAreasForSkill(skillId);
  const areas = getItemsByType('area');
  const habits = getHabitsForSkill(skillId);
  const routines = getRoutinesForSkill(skillId);
  const missions = getMissionsForSkill(skillId);
  const milestones = getMilestonesForSkill(skillId);
  const practice = useMemo(() => computeSkillPracticeSummary(skillId), [skillId, milestones.length]);
  const primaryAreaTitle = areas.find((a) => a.id === primaryAreaId)?.title;

  const [milestoneText, setMilestoneText] = useState('');

  const refresh = () => {
    rerender();
    onChanged();
  };

  const toggleUnlocked = () => {
    setSkillUnlocked(skillId, !unlocked);
    refresh();
  };

  const setProficiency = (value: number) => {
    updateSkillProficiency(skillId, value);
    refresh();
  };

  const setPrimaryArea = (areaId: string | null) => {
    setPrimaryAreaForSkill(skillId, areaId);
    refresh();
  };

  const toggleSecondaryArea = (areaId: string) => {
    const next = secondaryAreaIds.includes(areaId)
      ? secondaryAreaIds.filter((id) => id !== areaId)
      : [...secondaryAreaIds, areaId];
    setSkillSecondaryAreas(skillId, next);
    refresh();
  };

  const linkedHabitIds = new Set(habits.map((h) => h.id));
  const linkableHabits = getItemsByType('habit').filter((h) => !linkedHabitIds.has(h.id));
  const linkedRoutineIds = new Set(routines.map((r) => r.id));
  const linkableRoutines = getItemsByType('routine').filter((r) => !linkedRoutineIds.has(r.id));
  const linkedMissionIds = new Set(missions.map((m) => m.id));
  const linkableMissions = getItemsByType('project').filter((m) => !linkedMissionIds.has(m.id));

  const addMilestone = () => {
    const trimmed = milestoneText.trim();
    if (!trimmed) return;
    createSkillMilestone(skillId, trimmed, formatDate(new Date()), true);
    setMilestoneText('');
    refresh();
  };

  return (
    <View style={{ gap: webSpacing[5] }}>
      <Pressable style={[styles.lockBanner, unlocked && styles.lockBannerUnlocked]} onPress={toggleUnlocked}>
        <View style={styles.skillIdentityDisc}>
          <Text style={styles.identityInitial}>{item.title.charAt(0).toUpperCase()}</Text>
        </View>
        {unlocked ? <LockOpen size={18} color={webColors.primary} strokeWidth={1.8} /> : <Lock size={18} color={webColors.mutedForeground} strokeWidth={1.8} />}
        <View style={{ flex: 1, gap: 2 }}>
          <Text style={styles.primaryDomainLabel}>{primaryAreaTitle ? `PRIMARY DOMAIN · ${primaryAreaTitle}` : 'SET A PRIMARY DOMAIN'}</Text>
          <Text style={styles.lockTitle}>{unlocked ? 'Unlocked' : 'Still learning'}</Text>
          <Text style={styles.lockSub}>{unlocked ? 'Milestones can contribute to Potential.' : 'Not unlocked yet — milestones won’t affect Potential.'}</Text>
        </View>
      </Pressable>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PROFICIENCY</Text>
        <View style={styles.chipWrap}>
          {PROFICIENCY_LEVELS.map((level) => {
            const selected = proficiency >= level.value;
            return (
              <Pressable key={level.value} style={[styles.levelChip, selected && styles.levelChipSelected]} onPress={() => setProficiency(level.value)}>
                <Text style={[styles.levelChipText, selected && styles.levelChipTextSelected]}>{level.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>PRACTICE (LAST 30 DAYS)</Text>
        <View style={styles.row}>
          <Flame size={16} color={webColors.destructive} strokeWidth={1.8} />
          <Text style={styles.rowTitle}>{practice.habitCompletions30d} habit check-ins</Text>
        </View>
        <View style={styles.row}>
          <ListChecks size={16} color={webColors.primary} strokeWidth={1.8} />
          <Text style={styles.rowTitle}>{practice.routineSessionsCompleted} routine sessions completed</Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>RELATED DOMAINS</Text>
        <View style={styles.row}>
          <Text style={styles.rowLabel}>PRIMARY</Text>
          <View style={{ flex: 1 }}>
            <SelectRow
              value={primaryAreaId}
              placeholder="Set primary Domain"
              options={areas.map((a) => ({ id: a.id, title: a.title }))}
              onChange={setPrimaryArea}
            />
          </View>
        </View>
        <View style={styles.chipWrap}>
          {areas.filter((a) => a.id !== primaryAreaId).map((area) => {
            const selected = secondaryAreaIds.includes(area.id);
            return (
              <Pressable key={area.id} style={[styles.chip, selected && styles.chipSelected]} onPress={() => toggleSecondaryArea(area.id)}>
                <Text style={[styles.chipText, selected && styles.chipTextSelected]}>{area.title}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <LinkedSection
        label="LINKED HABITS"
        items={habits}
        linkable={linkableHabits}
        emptyText="No habits linked yet."
        icon={<Flame size={15} color={webColors.destructive} strokeWidth={1.8} />}
        onLink={(id) => { linkHabitToSkill(id, skillId); refresh(); }}
      />

      <LinkedSection
        label="LINKED ROUTINES"
        items={routines}
        linkable={linkableRoutines}
        emptyText="No routines linked yet."
        icon={<ListChecks size={15} color={webColors.primary} strokeWidth={1.8} />}
        onLink={(id) => { linkRoutineToSkill(id, skillId); refresh(); }}
      />

      <LinkedSection
        label="ACTIVE MISSIONS"
        items={missions}
        linkable={linkableMissions}
        emptyText="No missions linked yet."
        icon={<Sparkles size={15} color={webColors.primary} strokeWidth={1.8} />}
        onLink={(id) => { linkMissionToSkill(id, skillId); refresh(); }}
      />

      <View style={styles.section}>
        <Text style={styles.sectionLabel}>MILESTONES</Text>
        {milestones.length === 0 ? (
          <Text style={styles.emptySub}>No milestones yet — add one when you reach a real turning point.</Text>
        ) : (
          milestones.map((milestone) => {
            const mMeta = milestone.metadata ? JSON.parse(milestone.metadata) : {};
            const contributes = mMeta.contributesToScore !== false;
            const suffix = !contributes ? ' · display only' : !unlocked ? ' · locked' : '';
            return (
              <View key={milestone.id} style={styles.row}>
                <Sparkles size={15} color={webColors.destructive} strokeWidth={1.8} />
                <Text style={styles.rowTitle} numberOfLines={1}>{milestone.title}</Text>
                <Text style={styles.rowMeta}>{mMeta.earnedAt}{suffix}</Text>
                <Pressable
                  onPress={() => { setSkillMilestoneContributesToScore(milestone.id, !contributes); refresh(); }}
                  style={styles.milestoneToggle}
                >
                  <Text style={styles.milestoneToggleText}>{contributes ? 'On' : 'Off'}</Text>
                </Pressable>
                <Pressable onPress={() => { deleteSkillMilestone(milestone.id); refresh(); }} hitSlop={8}>
                  <Trash2 size={14} color={webColors.mutedForeground} strokeWidth={1.8} />
                </Pressable>
              </View>
            );
          })
        )}
        <View style={styles.captureRowInline}>
          <TextInput
            value={milestoneText}
            onChangeText={setMilestoneText}
            onSubmitEditing={addMilestone}
            placeholder="Add a milestone..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInputInline}
          />
          <Pressable onPress={addMilestone} style={styles.addBtn}>
            <Text style={styles.addBtnText}>Add</Text>
          </Pressable>
        </View>
      </View>

      <Pressable style={styles.deleteBtn} onPress={onDelete}>
        <Trash2 size={14} color={webColors.destructive} strokeWidth={1.8} />
        <Text style={styles.deleteBtnText}>Delete skill</Text>
      </Pressable>
    </View>
  );
}

function LinkedSection({
  label,
  items,
  linkable,
  emptyText,
  icon,
  onLink,
}: {
  label: string;
  items: Item[];
  linkable: Item[];
  emptyText: string;
  icon: React.ReactNode;
  onLink: (id: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = useState(false);
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeaderRow}>
        <Text style={styles.sectionLabel}>{label}</Text>
        {linkable.length > 0 && (
          <Pressable onPress={() => setPickerOpen((v) => !v)} hitSlop={8}>
            <Text style={styles.addLink}>{pickerOpen ? 'Cancel' : '+ Link'}</Text>
          </Pressable>
        )}
      </View>
      {items.length === 0 ? (
        <Text style={styles.emptySub}>{emptyText}</Text>
      ) : (
        items.map((entry) => (
          <View key={entry.id} style={styles.row}>
            {icon}
            <Text style={styles.rowTitle} numberOfLines={1}>{entry.title}</Text>
          </View>
        ))
      )}
      {pickerOpen && (
        <View style={styles.chipWrap}>
          {linkable.map((entry) => (
            <Pressable key={entry.id} style={styles.chip} onPress={() => { onLink(entry.id); setPickerOpen(false); }}>
              <Text style={styles.chipText}>{entry.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

function SelectRow({
  value,
  placeholder,
  options,
  onChange,
}: {
  value: string | null;
  placeholder: string;
  options: { id: string; title: string }[];
  onChange: (id: string | null) => void;
}) {
  const [open, setOpen] = useState(false);
  const selectedTitle = options.find((o) => o.id === value)?.title;
  return (
    <View>
      <Pressable onPress={() => setOpen((v) => !v)}>
        <Text style={styles.rowTitle}>{selectedTitle ?? placeholder}</Text>
      </Pressable>
      {open && (
        <View style={styles.chipWrap}>
          <Pressable style={styles.chip} onPress={() => { onChange(null); setOpen(false); }}>
            <Text style={styles.chipText}>None</Text>
          </Pressable>
          {options.map((o) => (
            <Pressable key={o.id} style={styles.chip} onPress={() => { onChange(o.id); setOpen(false); }}>
              <Text style={styles.chipText}>{o.title}</Text>
            </Pressable>
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[4],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    marginHorizontal: webSpacing[6],
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    marginBottom: webSpacing[4],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  grid: {
    paddingHorizontal: webSpacing[6],
    paddingBottom: webSpacing[6],
    gap: webSpacing[3],
  },
  gridRow: {
    gap: webSpacing[3],
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  card: {
    flex: 1,
    backgroundColor: webColors.card,
    ...webDepth.card,
    padding: webSpacing[4],
    gap: webSpacing[1],
    minHeight: 128,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  identityDisc: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: webColors.muted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  identityDiscLocked: {
    opacity: 0.55,
  },
  identityInitial: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.primary,
  },
  cardTitle: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
    marginTop: webSpacing[2],
  },
  cardProficiency: {
    fontSize: webFontSize.sm,
    fontWeight: '700',
    color: webColors.accent,
  },
  cardArea: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  lockBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[3],
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[4],
    backgroundColor: webColors.muted,
  },
  lockBannerUnlocked: {
    borderColor: webColors.primary,
    backgroundColor: webColors.warningBackground,
  },
  skillIdentityDisc: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: webColors.card,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryDomainLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: webColors.primary,
  },
  lockTitle: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: webColors.foreground,
  },
  lockSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  section: {
    gap: webSpacing[2],
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.8,
    color: webColors.mutedForeground,
  },
  addLink: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.accent,
  },
  chipWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  levelChip: {
    borderRadius: webRadius.pill,
    borderWidth: 1.5,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  levelChipSelected: {
    borderColor: webColors.accent,
    backgroundColor: webColors.warningBackground,
  },
  levelChipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  levelChipTextSelected: {
    color: webColors.accent,
  },
  chip: {
    borderRadius: webRadius.pill,
    borderWidth: 1.5,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  chipSelected: {
    borderColor: webColors.primary,
    backgroundColor: webColors.warningBackground,
  },
  chipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipTextSelected: {
    color: webColors.primary,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  rowLabel: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.6,
    color: webColors.mutedForeground,
  },
  rowTitle: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.foreground,
    flex: 1,
  },
  rowMeta: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  milestoneToggle: {
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[2],
    paddingVertical: 2,
  },
  milestoneToggleText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
  },
  emptySub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
  captureRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[1],
  },
  captureInputInline: {
    flex: 1,
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  addBtn: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  addBtnText: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.card,
  },
  deleteBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: webSpacing[2],
    paddingVertical: webSpacing[3],
  },
  deleteBtnText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.destructive,
  },
});
