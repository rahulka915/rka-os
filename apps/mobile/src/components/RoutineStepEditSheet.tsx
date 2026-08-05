import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Switch, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../theme';
import { BottomSheet } from './ui/BottomSheet';
import type { RoutineStepMeta } from '../utils/routineMeta';

interface RoutineStepEditSheetProps {
  visible: boolean;
  stepTitle: string;
  initialValue?: RoutineStepMeta;
  onClose: () => void;
  onSubmit: (title: string, meta: RoutineStepMeta) => void;
}

function toIntOrUndefined(text: string): number | undefined {
  const n = parseInt(text, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

export function RoutineStepEditSheet({ visible, stepTitle, initialValue, onClose, onSubmit }: RoutineStepEditSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [title, setTitle] = useState('');
  const [durationSeconds, setDurationSeconds] = useState('');
  const [autoAdvance, setAutoAdvance] = useState(false);
  const [instructions, setInstructions] = useState('');
  const titleRef = useRef<TextInput>(null);

  useEffect(() => {
    if (!visible) return;
    setTitle(stepTitle);
    setDurationSeconds(initialValue?.durationSeconds ? String(initialValue.durationSeconds) : '');
    setAutoAdvance(initialValue?.autoAdvance ?? false);
    setInstructions(initialValue?.instructions ?? '');
    const t = setTimeout(() => titleRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const handleSave = () => {
    if (!title.trim()) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSubmit(title.trim(), {
      durationSeconds: toIntOrUndefined(durationSeconds),
      autoAdvance,
      instructions: instructions.trim() || undefined,
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
      title={initialValue ? 'Edit Step' : 'New Step'}
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
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>STEP NAME</Text>
        <TextInput
          ref={titleRef}
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="e.g. Stretch"
          placeholderTextColor={palette.textTertiary}
          value={title}
          onChangeText={setTitle}
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>DURATION (SECONDS)</Text>
        <TextInput
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Leave blank for a manual step"
          placeholderTextColor={palette.textTertiary}
          value={durationSeconds}
          onChangeText={setDurationSeconds}
          keyboardType="number-pad"
          keyboardAppearance={isDark ? 'dark' : 'light'}
        />
      </View>
      <View style={[styles.fieldRow, styles.switchRow]}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>AUTO-ADVANCE WHEN TIMER ENDS</Text>
        <Switch value={autoAdvance} onValueChange={setAutoAdvance} />
      </View>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>INSTRUCTIONS</Text>
        <TextInput
          style={[styles.fieldInput, styles.notesInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="Optional"
          placeholderTextColor={palette.textTertiary}
          value={instructions}
          onChangeText={setInstructions}
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
  actionText: { fontFamily: 'Inter_400Regular', fontSize: 16, fontWeight: '400' },
  saveText: { fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  fieldRow: { gap: 4 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  fieldLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, fontSize: 15, padding: 10 },
  notesInput: { minHeight: 60, textAlignVertical: 'top' },
});
