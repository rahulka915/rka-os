import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemsByType, getFocus, setFocus, clearFocus } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import type { Item } from '../db/types';

// Current Focus only ever changes Domain WEIGHTING for Overall Potential —
// it never touches Domains, Missions, Achievements or history (see
// computeOverallPotential in src/db/database.ts, which reads these weights
// at aggregation time). Weight text fields are left blank for "equal (1x)".
export function FocusScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [label, setLabel] = useState('');
  const [areas, setAreas] = useState<Item[]>([]);
  const [weightText, setWeightText] = useState<Record<string, string>>({});
  const [hasFocus, setHasFocus] = useState(false);

  const load = useCallback(() => {
    const loadedAreas = getItemsByType('area');
    setAreas(loadedAreas);
    const focus = getFocus();
    setHasFocus(!!focus);
    setLabel(focus?.label ?? '');
    const text: Record<string, string> = {};
    for (const area of loadedAreas) {
      const weight = focus?.weights?.[area.id];
      text[area.id] = weight !== undefined ? String(weight) : '';
    }
    setWeightText(text);
  }, []);

  useFocusEffect(load);

  const handleSave = () => {
    const trimmed = label.trim();
    if (!trimmed) return;
    const weights: Record<string, number> = {};
    for (const area of areas) {
      const raw = weightText[area.id];
      const parsed = raw ? parseFloat(raw) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) weights[area.id] = parsed;
    }
    setFocus(trimmed, weights);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    navigation.goBack();
  };

  const handleClear = () => {
    clearFocus();
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    navigation.goBack();
  };

  return (
    <LensSurface title="Current Focus">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>LABEL</Text>
        <TextInput
          style={[styles.labelInput, { color: palette.text, borderColor: palette.separator }]}
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. 25th Birthday"
          placeholderTextColor={palette.textTertiary}
        />

        <Text style={[styles.sectionLabel, styles.weightsLabel, { color: palette.textTertiary }]}>DOMAIN WEIGHTING</Text>
        <Text style={[styles.hint, { color: palette.textSecondary }]}>
          Leave blank for equal weighting. Higher numbers count for more of Overall Potential while this Focus is active.
        </Text>
        <View style={styles.rows}>
          {areas.map((area) => (
            <View key={area.id} style={[styles.weightRow, { borderColor: palette.separator }]}>
              <Text style={[styles.weightLabel, { color: palette.text }]} numberOfLines={1}>{area.title}</Text>
              <TextInput
                style={[styles.weightInput, { color: palette.text, borderColor: palette.separator }]}
                value={weightText[area.id] ?? ''}
                onChangeText={(text) => setWeightText((current) => ({ ...current, [area.id]: text }))}
                placeholder="1"
                placeholderTextColor={palette.textTertiary}
                keyboardType="decimal-pad"
              />
            </View>
          ))}
        </View>

        <TouchableOpacity style={[styles.saveButton, { backgroundColor: palette.red, opacity: label.trim() ? 1 : 0.4 }]} onPress={handleSave} disabled={!label.trim()}>
          <Text style={styles.saveButtonText}>Save Focus</Text>
        </TouchableOpacity>

        {hasFocus && (
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={[styles.clearButtonText, { color: palette.textSecondary }]}>Clear Focus</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: 16, paddingBottom: 40, gap: 8 },
  sectionLabel: { fontSize: 10, fontWeight: '800', fontFamily: 'Inter_800ExtraBold', letterSpacing: 1 },
  weightsLabel: { marginTop: 20 },
  hint: { fontFamily: 'Inter_400Regular', fontSize: 13, fontWeight: '400', marginBottom: 8 },
  labelInput: {
    fontSize: 18,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: 10,
  },
  rows: { gap: 8 },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  weightLabel: { fontSize: 15, fontWeight: '600', fontFamily: 'Inter_600SemiBold', flex: 1 },
  weightInput: {
    width: 60,
    fontSize: 15,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: 24,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    color: '#ffffff',
  },
  clearButton: {
    marginTop: 12,
    paddingVertical: 10,
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
