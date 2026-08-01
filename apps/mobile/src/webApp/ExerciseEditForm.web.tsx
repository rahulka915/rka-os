import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import {
  EQUIPMENT_LABELS,
  EQUIPMENT_OPTIONS,
  MUSCLE_GROUPS,
  MUSCLE_GROUP_LABELS,
  type Equipment,
  type MuscleGroup,
} from '../utils/exerciseLibrary';
import type { ExerciseDraft } from '../components/ExerciseEditSheet';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface ExerciseEditFormProps {
  initialValue?: ExerciseDraft;
  onSubmit: (draft: ExerciseDraft) => void;
  onCancel: () => void;
}

export function ExerciseEditForm({ initialValue, onSubmit, onCancel }: ExerciseEditFormProps) {
  const [title, setTitle] = useState(initialValue?.title ?? '');
  const [muscleGroup, setMuscleGroup] = useState<MuscleGroup>(initialValue?.muscleGroup ?? 'full-body');
  const [equipment, setEquipment] = useState<Equipment | undefined>(initialValue?.equipment);
  const [notes, setNotes] = useState(initialValue?.notes ?? '');

  useEffect(() => {
    setTitle(initialValue?.title ?? '');
    setMuscleGroup(initialValue?.muscleGroup ?? 'full-body');
    setEquipment(initialValue?.equipment);
    setNotes(initialValue?.notes ?? '');
  }, [initialValue]);

  const handleSave = () => {
    const trimmed = title.trim();
    if (!trimmed) return;
    onSubmit({ title: trimmed, muscleGroup, equipment, notes: notes.trim() || undefined, imageKey: initialValue?.imageKey });
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        placeholder="Exercise name..."
        placeholderTextColor={webColors.mutedForeground}
        style={styles.titleInput}
      />

      <View>
        <Text style={styles.label}>Muscle Group</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            {MUSCLE_GROUPS.map((group) => {
              const active = muscleGroup === group;
              return (
                <Pressable
                  key={group}
                  onPress={() => setMuscleGroup(group)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{MUSCLE_GROUP_LABELS[group]}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View>
        <Text style={styles.label}>Equipment</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={styles.chipRow}>
            <Pressable onPress={() => setEquipment(undefined)} style={[styles.chip, !equipment && styles.chipActive]}>
              <Text style={[styles.chipText, !equipment && styles.chipTextActive]}>Any</Text>
            </Pressable>
            {EQUIPMENT_OPTIONS.map((option) => {
              const active = equipment === option;
              return (
                <Pressable
                  key={option}
                  onPress={() => setEquipment(option)}
                  style={[styles.chip, active && styles.chipActive]}
                >
                  <Text style={[styles.chipText, active && styles.chipTextActive]}>{EQUIPMENT_LABELS[option]}</Text>
                </Pressable>
              );
            })}
          </View>
        </ScrollView>
      </View>

      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          placeholder="Form cues, optional..."
          placeholderTextColor={webColors.mutedForeground}
          style={styles.notesInput}
          multiline
        />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} disabled={!title.trim()} style={[styles.saveButton, !title.trim() && styles.saveButtonDisabled]}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: webSpacing[4] },
  titleInput: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
    padding: 0,
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  chipRow: { flexDirection: 'row', gap: webSpacing[2], paddingRight: webSpacing[2] },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  chipActive: { backgroundColor: webColors.accent },
  chipText: { fontSize: webFontSize.sm, fontWeight: '600', color: webColors.mutedForeground },
  chipTextActive: { color: webColors.card },
  notesInput: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
    minHeight: 60,
    textAlignVertical: 'top',
  },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: webSpacing[3] },
  cancelButton: { paddingVertical: webSpacing[2], paddingHorizontal: webSpacing[3] },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  saveButton: {
    paddingVertical: webSpacing[2],
    paddingHorizontal: webSpacing[4],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  saveButtonDisabled: { opacity: 0.4 },
  saveText: { fontSize: webFontSize.sm, color: webColors.card, fontWeight: '700' },
});
