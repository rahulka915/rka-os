import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getItemComposerMaterial, getThemeColors, spacing } from '../../theme';
import { BottomSheet } from '../ui/BottomSheet';
import { computeHabitPeriodProgress } from '../../utils/habitMeta';
import { getHabitSamples } from '../../db/database';
import type { Item } from '../../db/types';

interface HabitQuantifiedSheetProps {
  visible: boolean;
  habit: Item | null;
  onClose: () => void;
  onLogged: (value: number) => void;
}

export function HabitQuantifiedSheet({ visible, habit, onClose, onLogged }: HabitQuantifiedSheetProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const material = getItemComposerMaterial(isDark);
  const [value, setValue] = useState('');
  const inputRef = useRef<TextInput>(null);

  const progress = habit ? computeHabitPeriodProgress(habit, getHabitSamples(habit.id), new Date()) : null;

  useEffect(() => {
    if (!visible || !progress) return;
    const remaining = Math.max(progress.target - progress.current, 0);
    setValue(remaining > 0 ? String(remaining) : '');
    const t = setTimeout(() => inputRef.current?.focus(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, habit?.id]);

  if (!habit || !progress) return null;

  const handleSave = () => {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return;
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onLogged(n);
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
      title={habit.title}
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
          <Text style={[styles.actionText, styles.saveText, { color: material.accent }]}>Log</Text>
        </TouchableOpacity>
      }
    >
      <Text style={[styles.progressLine, { color: palette.textSecondary }]}>
        {progress.current}/{progress.target}{progress.unit ? ` ${progress.unit}` : ''} {progress.periodLabel}
      </Text>
      <View style={styles.fieldRow}>
        <Text style={[styles.fieldLabel, { color: palette.textTertiary }]}>VALUE{progress.unit ? ` (${progress.unit.toUpperCase()})` : ''}</Text>
        <TextInput
          ref={inputRef}
          style={[styles.fieldInput, { color: palette.text, borderColor: material.rim }]}
          placeholder="0"
          placeholderTextColor={palette.textTertiary}
          value={value}
          onChangeText={setValue}
          keyboardType="number-pad"
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
  progressLine: { fontSize: 13, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  fieldRow: { gap: 4 },
  fieldLabel: { fontSize: 11, fontWeight: '700', fontFamily: 'Inter_700Bold', letterSpacing: 0.6 },
  fieldInput: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, fontSize: 15, padding: 10 },
});
