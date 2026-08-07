import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import { X } from '../icons';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type MovementFamily,
  type MuscleGroup,
  type MuscleGroupAssignment,
} from '../utils/exerciseLibrary';

export interface ExerciseDraft {
  title: string;
  muscleGroup: MuscleGroup;
  muscleGroupDetail?: string;
  secondaryMuscleGroups?: MuscleGroupAssignment[];
  equipment?: Equipment;
  movementFamily?: MovementFamily;
  notes?: string;
  imageKey?: string;
}

interface ExerciseEditSheetProps {
  visible: boolean;
  initialValue?: ExerciseDraft;
  onClose: () => void;
  onSubmit: (draft: ExerciseDraft) => void;
}

const EMPTY_DRAFT: ExerciseDraft = { title: '', muscleGroup: 'full-body', equipment: undefined, notes: '' };

export function ExerciseEditSheet({ visible, initialValue, onClose, onSubmit }: ExerciseEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [title, setTitle] = useState('');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>('full-body');
  const [muscleGroupDetail, setMuscleGroupDetail] = useState('');
  const [secondaryGroups, setSecondaryGroups] = useState<MuscleGroupAssignment[]>([]);
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    const draft = initialValue ?? EMPTY_DRAFT;
    setTitle(draft.title);
    setMuscleGroup(draft.muscleGroup);
    setMuscleGroupDetail(draft.muscleGroupDetail ?? '');
    setSecondaryGroups(draft.secondaryMuscleGroups ?? []);
    setEquipment(draft.equipment);
    setNotes(draft.notes ?? '');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  // Switching primary away from a group already used as a secondary would
  // create a duplicate assignment — drop that secondary row rather than let
  // it silently collide (parseExerciseMeta would drop it on next read anyway,
  // this just keeps what's on screen consistent with what gets saved).
  const handleSelectPrimary = (group: MuscleGroup) => {
    Haptics.selectionAsync();
    setMuscleGroup(group);
    setSecondaryGroups((prev) => prev.filter((s) => s.group !== group));
  };

  const addSecondaryGroup = () => {
    const used = new Set([muscleGroup, ...secondaryGroups.map((s) => s.group)]);
    const next = MUSCLE_GROUPS.find((g) => !used.has(g));
    if (!next) return;
    Haptics.selectionAsync();
    setSecondaryGroups((prev) => [...prev, { group: next }]);
  };

  const updateSecondaryGroup = (index: number, group: MuscleGroup) => {
    Haptics.selectionAsync();
    setSecondaryGroups((prev) => prev.map((s, i) => (i === index ? { ...s, group } : s)));
  };

  const updateSecondaryDetail = (index: number, detail: string) => {
    setSecondaryGroups((prev) => prev.map((s, i) => (i === index ? { ...s, detail } : s)));
  };

  const removeSecondaryGroup = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setSecondaryGroups((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    const cleanedSecondaries = secondaryGroups
      .filter((s) => s.group !== muscleGroup)
      .map((s) => ({ group: s.group, ...(s.detail?.trim() ? { detail: s.detail.trim() } : {}) }));
    onSubmit({
      title: trimmedTitle,
      muscleGroup,
      muscleGroupDetail: muscleGroupDetail.trim() || undefined,
      secondaryMuscleGroups: cleanedSecondaries.length > 0 ? cleanedSecondaries : undefined,
      equipment,
      notes: notes.trim() || undefined,
      imageKey: initialValue?.imageKey,
    });
    onClose();
  };

  const handleCancel = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    onClose();
  };

  return (
    <BottomSheet
      visible={visible}
      onClose={handleCancel}
      isDark={isDark}
      title={initialValue ? 'Edit Exercise' : 'New Exercise'}
      topAnchored
      scrollable
      sheetStyle={[styles.sheet, { backgroundColor: material.surface, borderColor: material.rim }]}
      contentContainerStyle={styles.content}
      headerLeft={
        <TouchableOpacity onPress={handleCancel} hitSlop={12}>
          <Text style={[styles.actionText, { color: palette.textMuted }]}>Cancel</Text>
        </TouchableOpacity>
      }
      headerRight={
        <TouchableOpacity onPress={handleSave} hitSlop={12} disabled={!title.trim()}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent, opacity: title.trim() ? 1 : 0.28 }]}>
            Save
          </Text>
        </TouchableOpacity>
      }
    >
      <View style={[styles.inputRow, { borderBottomColor: material.rim }]}>
        <TextInput
          ref={inputRef}
          style={[styles.input, { color: palette.text }]}
          placeholder="Exercise name..."
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          returnKeyType="done"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>MUSCLE GROUP</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        {MUSCLE_GROUPS.map((group) => {
          const selected = muscleGroup === group;
          return (
            <TouchableOpacity
              key={group}
              style={[
                styles.chip,
                { borderColor: material.rim },
                selected && { backgroundColor: material.accent, borderColor: material.accent },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setMuscleGroup(group);
              }}
            >
              <Text style={[styles.chipText, { color: selected ? material.onAccent : palette.text }]}>
                {MUSCLE_GROUP_LABELS[group]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
      <TextInput
        style={[styles.detailInput, { color: palette.text, borderColor: material.rim }]}
        placeholder="Sub-region detail, optional (e.g. upper, long head)"
        placeholderTextColor={palette.textTertiary}
        value={muscleGroupDetail}
        onChangeText={setMuscleGroupDetail}
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />

      <View style={styles.secondaryHeaderRow}>
        <Text style={[styles.sectionLabel, styles.sectionLabelNoMargin, { color: palette.textTertiary }]}>
          SECONDARY MUSCLE GROUPS
        </Text>
        {secondaryGroups.length < MUSCLE_GROUPS.length - 1 && (
          <TouchableOpacity onPress={addSecondaryGroup} hitSlop={8}>
            <Text style={[styles.addSecondaryText, { color: material.accent }]}>+ Add</Text>
          </TouchableOpacity>
        )}
      </View>
      {secondaryGroups.length === 0 ? (
        <Text style={[styles.emptyText, { color: palette.textTertiary }]}>
          None — this exercise counts fully toward its primary group in Muscle Balance.
        </Text>
      ) : (
        secondaryGroups.map((secondary, index) => (
          <View key={index} style={styles.secondaryRow}>
            <View style={styles.secondaryRowTop}>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
                {MUSCLE_GROUPS.filter((g) => g === secondary.group || (g !== muscleGroup && !secondaryGroups.some((s, i) => i !== index && s.group === g))).map((group) => {
                  const selected = secondary.group === group;
                  return (
                    <TouchableOpacity
                      key={group}
                      style={[
                        styles.chip,
                        { borderColor: material.rim },
                        selected && { backgroundColor: material.accent, borderColor: material.accent },
                      ]}
                      onPress={() => updateSecondaryGroup(index, group)}
                    >
                      <Text style={[styles.chipText, { color: selected ? material.onAccent : palette.text }]}>
                        {MUSCLE_GROUP_LABELS[group]}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity onPress={() => removeSecondaryGroup(index)} hitSlop={8} style={styles.removeBtn}>
                <X size={16} color={palette.textTertiary} strokeWidth={2} />
              </TouchableOpacity>
            </View>
            <TextInput
              style={[styles.detailInput, { color: palette.text, borderColor: material.rim }]}
              placeholder="Sub-region detail, optional"
              placeholderTextColor={palette.textTertiary}
              value={secondary.detail ?? ''}
              onChangeText={(text) => updateSecondaryDetail(index, text)}
              keyboardAppearance={isDark ? 'dark' : 'light'}
            />
          </View>
        ))
      )}

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>EQUIPMENT</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipRow} contentContainerStyle={styles.chipRowContent}>
        <TouchableOpacity
          style={[
            styles.chip,
            { borderColor: material.rim },
            !equipment && { backgroundColor: material.accent, borderColor: material.accent },
          ]}
          onPress={() => {
            Haptics.selectionAsync();
            setEquipment(undefined);
          }}
        >
          <Text style={[styles.chipText, { color: !equipment ? material.onAccent : palette.text }]}>Any</Text>
        </TouchableOpacity>
        {EQUIPMENT_OPTIONS.map((option) => {
          const selected = equipment === option;
          return (
            <TouchableOpacity
              key={option}
              style={[
                styles.chip,
                { borderColor: material.rim },
                selected && { backgroundColor: material.accent, borderColor: material.accent },
              ]}
              onPress={() => {
                Haptics.selectionAsync();
                setEquipment(option);
              }}
            >
              <Text style={[styles.chipText, { color: selected ? material.onAccent : palette.text }]}>
                {EQUIPMENT_LABELS[option]}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>NOTES</Text>
      <TextInput
        style={[styles.notesInput, { color: palette.text, borderColor: material.rim }]}
        placeholder="Form cues, optional..."
        placeholderTextColor={palette.textTertiary}
        value={notes}
        onChangeText={setNotes}
        multiline
        keyboardAppearance={isDark ? 'dark' : 'light'}
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16 },
  content: { paddingBottom: spacing[5], gap: 4 },
  actionText: { fontFamily: 'Inter_400Regular', fontSize: 16, fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  inputRow: {
    minHeight: 64,
    borderBottomWidth: StyleSheet.hairlineWidth,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  input: {
    flex: 1,
    fontSize: 22,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    letterSpacing: -0.3,
    minHeight: 56,
    paddingVertical: 12,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginTop: 12,
    marginBottom: 6,
  },
  chipRow: { flexGrow: 0 },
  chipRowContent: { gap: 8, paddingRight: 8 },
  chip: {
    borderRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  notesInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    fontSize: 15,
    padding: 10,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  detailInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    fontSize: 13,
    paddingHorizontal: 10,
    paddingVertical: 8,
    marginTop: 6,
  },
  secondaryHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 12,
  },
  sectionLabelNoMargin: { marginTop: 0, marginBottom: 0 },
  addSecondaryText: { fontSize: 13, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  emptyText: { fontSize: 12, fontFamily: 'Inter_400Regular', marginTop: 6, lineHeight: 17 },
  secondaryRow: { marginTop: 10 },
  secondaryRowTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  removeBtn: { padding: 4 },
});
