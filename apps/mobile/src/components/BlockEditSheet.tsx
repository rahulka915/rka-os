import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import type { WorkoutBlockMeta } from '../utils/workoutBlock';

interface BlockEditSheetProps {
  visible: boolean;
  exerciseTitle: string;
  initialValue?: WorkoutBlockMeta;
  onClose: () => void;
  onSubmit: (meta: WorkoutBlockMeta) => void;
}

function toIntOrUndefined(text: string): number | undefined {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function BlockEditSheet({ visible, exerciseTitle, initialValue, onClose, onSubmit }: BlockEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [sets, setSets] = useState('');
  const [reps, setReps] = useState('');
  const [weight, setWeight] = useState('');
  const [restSeconds, setRestSeconds] = useState('');
  const [notes, setNotes] = useState('');
  const setsRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setSets(initialValue?.sets ? String(initialValue.sets) : '');
    setReps(initialValue?.reps ?? '');
    setWeight(initialValue?.weight ?? '');
    setRestSeconds(initialValue?.restSeconds ? String(initialValue.restSeconds) : '');
    setNotes(initialValue?.notes ?? '');
    const t = setTimeout(() => setsRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit({
      sets: toIntOrUndefined(sets),
      reps: reps.trim() || undefined,
      weight: weight.trim() || undefined,
      restSeconds: toIntOrUndefined(restSeconds),
      notes: notes.trim() || undefined,
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
      title={exerciseTitle}
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
        <TouchableOpacity onPress={handleSave} hitSlop={12}>
          <Text style={[styles.actionText, styles.saveText, { color: material.accent }]}>Save</Text>
        </TouchableOpacity>
      }
    >
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>SETS</Text>
        <TextInput
          ref={setsRef}
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="4"
          placeholderTextColor={palette.textTertiary}
          value={sets}
          onChangeText={setSets}
          keyboardType="number-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>REPS</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="8-12"
          placeholderTextColor={palette.textTertiary}
          value={reps}
          onChangeText={setReps}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>WEIGHT</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="60kg or bodyweight"
          placeholderTextColor={palette.textTertiary}
          value={weight}
          onChangeText={setWeight}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>REST (SECONDS)</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="90"
          placeholderTextColor={palette.textTertiary}
          value={restSeconds}
          onChangeText={setRestSeconds}
          keyboardType="number-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>NOTES</Text>
        <TextInput
          style={[styles.fieldInput, styles.notesInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          value={notes}
          onChangeText={setNotes}
          multiline
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  sheet: { marginHorizontal: 16 },
  content: { paddingBottom: spacing[5], gap: 12 },
  actionText: { fontSize: 16, fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, fontSize: 15, padding: 10 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
});
