import { useEffect, useState } from 'react';
import { Modal, TouchableOpacity, ScrollView, KeyboardAvoidingView, Platform, View as RNView, Text as RNText, StyleSheet, TextInput } from 'react-native';
import * as Haptics from 'expo-haptics';
import { createSupplement, updateSupplement, type SupplementMeta, type NutrientProfile } from '../db/database';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';
import { X } from '../icons';

const NUTRIENT_FIELDS: { key: keyof NutrientProfile; label: string; placeholder: string }[] = [
  { key: 'sodium', label: 'Sodium (mg)', placeholder: 'e.g. 300' },
  { key: 'potassium', label: 'Potassium (mg)', placeholder: 'e.g. 200' },
  { key: 'magnesium', label: 'Magnesium (mg)', placeholder: 'e.g. 60' },
  { key: 'calcium', label: 'Calcium (mg)', placeholder: 'e.g. 100' },
  { key: 'chloride', label: 'Chloride (mg)', placeholder: 'e.g. 500' },
];

interface SupplementEditFormProps {
  visible: boolean;
  onClose: () => void;
  onSaved: () => void;
  isDark: boolean;
  editTarget?: Item | null;
}

export function SupplementEditForm({ visible, onClose, onSaved, isDark, editTarget }: SupplementEditFormProps) {
  const palette = getThemeColors(isDark);
  const [title, setTitle] = useState('');
  const [dose, setDose] = useState('');
  const [nutrients, setNutrients] = useState<Record<string, string>>({});
  const isEditing = !!editTarget;

  useEffect(() => {
    if (!visible) return;
    if (editTarget) {
      const meta: SupplementMeta = editTarget.metadata ? JSON.parse(editTarget.metadata) : {};
      setTitle(editTarget.title);
      setDose(meta.dose ?? '');
      const next: Record<string, string> = {};
      for (const { key } of NUTRIENT_FIELDS) {
        if (meta.nutrients?.[key] !== undefined) next[key] = String(meta.nutrients[key]);
      }
      setNutrients(next);
    } else {
      setTitle('');
      setDose('');
      setNutrients({});
    }
  }, [visible, editTarget]);

  const canSave = !!title.trim();

  const handleSave = () => {
    if (!canSave) return;
    const nutrientProfile: NutrientProfile = {};
    for (const { key } of NUTRIENT_FIELDS) {
      const raw = nutrients[key];
      if (raw && raw.trim()) {
        const parsed = parseFloat(raw);
        if (!Number.isNaN(parsed)) nutrientProfile[key] = parsed;
      }
    }
    const meta: SupplementMeta = { dose: dose.trim() || undefined, nutrients: nutrientProfile };
    if (editTarget) {
      updateSupplement(editTarget.id, title.trim(), meta);
    } else {
      createSupplement(title.trim(), meta);
    }
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onSaved();
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="formSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <RNView style={[s.container, { backgroundColor: palette.bg }]}>
          <RNView style={[s.dragHandle, { backgroundColor: palette.handle }]} />
          <RNView style={s.header}>
            <RNText style={[s.title, { color: palette.text }]}>{isEditing ? 'Edit Supplement' : 'Add Supplement'}</RNText>
            <TouchableOpacity onPress={onClose} hitSlop={12}>
              <X size={16} color={palette.text} strokeWidth={2.5} />
            </TouchableOpacity>
          </RNView>

          <ScrollView style={s.content} contentContainerStyle={{ gap: 16 }} keyboardShouldPersistTaps="handled">
            <RNView style={s.field}>
              <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Supplement name</RNText>
              <TextInput
                style={[s.fieldInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.fill }]}
                placeholder="e.g. Electrolyte Mix"
                placeholderTextColor={palette.textMuted}
                value={title}
                onChangeText={setTitle}
                autoFocus={!isEditing}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
            </RNView>
            <RNView style={s.field}>
              <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Dose</RNText>
              <TextInput
                style={[s.fieldInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.fill }]}
                placeholder="e.g. 1 sachet"
                placeholderTextColor={palette.textMuted}
                value={dose}
                onChangeText={setDose}
                keyboardAppearance={isDark ? 'dark' : 'light'}
              />
            </RNView>

            <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>Nutrients (optional)</RNText>
            {NUTRIENT_FIELDS.map(({ key, label, placeholder }) => (
              <RNView key={key} style={s.field}>
                <RNText style={[s.fieldLabel, { color: palette.textTertiary }]}>{label}</RNText>
                <TextInput
                  style={[s.fieldInput, { color: palette.text, borderColor: palette.separator, backgroundColor: palette.fill }]}
                  placeholder={placeholder}
                  placeholderTextColor={palette.textMuted}
                  value={nutrients[key] ?? ''}
                  onChangeText={(value) => setNutrients((prev) => ({ ...prev, [key]: value }))}
                  keyboardType="decimal-pad"
                  keyboardAppearance={isDark ? 'dark' : 'light'}
                />
              </RNView>
            ))}
          </ScrollView>

          <RNView style={s.actions}>
            <TouchableOpacity onPress={onClose} style={[s.cancelBtn, { backgroundColor: palette.fill }]}>
              <RNText style={[s.cancelText, { color: palette.textSecondary }]}>Cancel</RNText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={!canSave}
              style={[s.saveBtn, { backgroundColor: palette.deeperBlue, opacity: canSave ? 1 : 0.3 }]}
            >
              <RNText style={[s.saveText, { color: isDark ? '#182229' : '#ffffff' }]}>Save</RNText>
            </TouchableOpacity>
          </RNView>
        </RNView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  dragHandle: { width: 36, height: 4, borderRadius: 2, alignSelf: 'center', marginTop: 8 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 16,
  },
  title: { fontSize: 18, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: -0.3 },
  content: { flex: 1, paddingHorizontal: 16, gap: 16 },
  field: { gap: 6 },
  fieldLabel: {
    fontSize: 10,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
  },
  fieldInput: {
    fontSize: 15,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
  },
  actions: { flexDirection: 'row', gap: 12, paddingHorizontal: 16, paddingBottom: 100 },
  cancelBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  cancelText: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
  saveBtn: { flex: 1, height: 48, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  saveText: { fontSize: 15, fontWeight: '700', fontFamily: 'Inter_700Bold' },
});
