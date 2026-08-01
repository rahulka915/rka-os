import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import type { WorkoutBlockMeta } from '../utils/workoutBlock';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

interface BlockEditFormProps {
  exerciseTitle: string;
  initialValue?: WorkoutBlockMeta;
  onSubmit: (meta: WorkoutBlockMeta) => void;
  onCancel: () => void;
  onDelete: () => void;
}

function toIntOrUndefined(text: string): number | undefined {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function BlockEditForm({ exerciseTitle, initialValue, onSubmit, onCancel, onDelete }: BlockEditFormProps) {
  const [sets, setSets] = useState(initialValue?.sets ? String(initialValue.sets) : '');
  const [reps, setReps] = useState(initialValue?.reps ?? '');
  const [weight, setWeight] = useState(initialValue?.weight ?? '');
  const [restSeconds, setRestSeconds] = useState(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
  const [notes, setNotes] = useState(initialValue?.notes ?? '');

  useEffect(() => {
    setSets(initialValue?.sets ? String(initialValue.sets) : '');
    setReps(initialValue?.reps ?? '');
    setWeight(initialValue?.weight ?? '');
    setRestSeconds(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
    setNotes(initialValue?.notes ?? '');
  }, [initialValue]);

  const handleSave = () => {
    onSubmit({
      sets: toIntOrUndefined(sets),
      reps: reps.trim() || undefined,
      weight: weight.trim() || undefined,
      restSeconds: toIntOrUndefined(restSeconds),
      notes: notes.trim() || undefined,
    });
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title} numberOfLines={1}>{exerciseTitle}</Text>

      <View>
        <Text style={styles.label}>Sets</Text>
        <TextInput value={sets} onChangeText={setSets} placeholder="4" placeholderTextColor={webColors.mutedForeground} style={styles.input} keyboardType="number-pad" />
      </View>
      <View>
        <Text style={styles.label}>Reps</Text>
        <TextInput value={reps} onChangeText={setReps} placeholder="8-12" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
      </View>
      <View>
        <Text style={styles.label}>Weight</Text>
        <TextInput value={weight} onChangeText={setWeight} placeholder="60kg or bodyweight" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
      </View>
      <View>
        <Text style={styles.label}>Rest (seconds)</Text>
        <TextInput value={restSeconds} onChangeText={setRestSeconds} placeholder="90" placeholderTextColor={webColors.mutedForeground} style={styles.input} keyboardType="number-pad" />
      </View>
      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput value={notes} onChangeText={setNotes} placeholder="Optional" placeholderTextColor={webColors.mutedForeground} style={[styles.input, styles.notesInput]} multiline />
      </View>

      <View style={styles.actionRow}>
        <Pressable onPress={onCancel} style={styles.cancelButton}>
          <Text style={styles.cancelText}>Cancel</Text>
        </Pressable>
        <Pressable onPress={handleSave} style={styles.saveButton}>
          <Text style={styles.saveText}>Save</Text>
        </Pressable>
      </View>

      <Pressable onPress={onDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Remove from template</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: webSpacing[4] },
  title: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[1],
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
  actionRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: webSpacing[3] },
  cancelButton: { paddingVertical: webSpacing[2], paddingHorizontal: webSpacing[3] },
  cancelText: { fontSize: webFontSize.sm, color: webColors.mutedForeground, fontWeight: '600' },
  saveButton: {
    paddingVertical: webSpacing[2],
    paddingHorizontal: webSpacing[4],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.accent,
  },
  saveText: { fontSize: webFontSize.sm, color: webColors.card, fontWeight: '700' },
  deleteRow: { flexDirection: 'row', alignItems: 'center', gap: webSpacing[2], marginTop: webSpacing[2] },
  deleteLabel: { fontSize: webFontSize.sm, color: webColors.destructive, fontWeight: '600' },
});
