import { useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type MuscleGroup,
} from '../utils/exerciseLibrary';

export interface ExerciseDraft {
  title: string;
  muscleGroup: MuscleGroup;
  equipment?: Equipment;
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
  const [equipment, setEquipment] = useState<Equipment | undefined>(undefined);
  const [notes, setNotes] = useState('');
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    const draft = initialValue ?? EMPTY_DRAFT;
    setTitle(draft.title);
    setMuscleGroup(draft.muscleGroup);
    setEquipment(draft.equipment);
    setNotes(draft.notes ?? '');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({ title: trimmedTitle, muscleGroup, equipment, notes: notes.trim() || undefined, imageKey: initialValue?.imageKey });
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
  actionText: { fontSize: 16, fontWeight: '400' },
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
});
