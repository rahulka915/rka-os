import { useCallback, useState } from 'react';
import { StyleSheet, Text, TextInput, Pressable, View } from 'react-native';
import { Minus, Plus } from 'lucide-react-native';
import { getItemsByType, getFocus, setFocus, clearFocus } from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { webColors, webSpacing, webRadius, webFontSize, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

const WEIGHT_STEP = 0.5;

// Body-only Focus editor, extracted so it can be embedded inline within
// Potential (a setting on that page) instead of living as its own sidebar
// destination.
export function FocusEditor({ onSaved }: { onSaved?: () => void }) {
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

  useDbRefresh(load);

  const adjustWeight = (areaId: string, delta: number) => {
    setWeightText((current) => {
      const raw = parseFloat(current[areaId] ?? '') || 1;
      const next = Math.max(WEIGHT_STEP, raw + delta);
      return { ...current, [areaId]: String(next) };
    });
  };

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
    load();
    onSaved?.();
  };

  const handleClear = () => {
    clearFocus();
    load();
    onSaved?.();
  };

  return (
    <View style={styles.content}>
      <Text style={styles.sectionLabel}>LABEL</Text>
      <TextInput
        style={styles.labelInput}
        value={label}
        onChangeText={setLabel}
        placeholder="e.g. 25th Birthday"
        placeholderTextColor={webColors.mutedForeground}
      />

      <Text style={[styles.sectionLabel, styles.weightsLabel]}>DOMAIN WEIGHTING</Text>
      <Text style={styles.hint}>
        Leave blank for equal weighting. Higher numbers count for more of Overall Potential while this Focus is active.
      </Text>

      <View style={styles.rows}>
        {areas.map((area) => (
          <View key={area.id} style={styles.weightRow}>
            <Text style={styles.weightLabel} numberOfLines={1}>{area.title}</Text>
            <View style={styles.stepper}>
              <Pressable style={styles.stepperButton} onPress={() => adjustWeight(area.id, -WEIGHT_STEP)}>
                <Minus size={13} color={webColors.mutedForeground} strokeWidth={2.2} />
              </Pressable>
              <TextInput
                style={styles.weightInput}
                value={weightText[area.id] ?? ''}
                onChangeText={(text) => setWeightText((current) => ({ ...current, [area.id]: text }))}
                placeholder="1"
                placeholderTextColor={webColors.mutedForeground}
                keyboardType="decimal-pad"
              />
              <Pressable style={styles.stepperButton} onPress={() => adjustWeight(area.id, WEIGHT_STEP)}>
                <Plus size={13} color={webColors.mutedForeground} strokeWidth={2.2} />
              </Pressable>
            </View>
          </View>
        ))}
      </View>

      <Pressable
        style={[styles.saveButton, !label.trim() && styles.saveButtonDisabled]}
        onPress={handleSave}
        disabled={!label.trim()}
      >
        <Text style={styles.saveButtonText}>Save Focus</Text>
      </Pressable>

      {hasFocus ? (
        <Pressable style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear Focus</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    letterSpacing: 1,
    color: webColors.mutedForeground,
  },
  weightsLabel: { marginTop: webSpacing[5] },
  hint: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    marginBottom: webSpacing[2],
  },
  labelInput: {
    fontSize: webFontSize.lg,
    fontWeight: '600',
    color: webColors.foreground,
    borderBottomWidth: 1,
    borderBottomColor: webColors.border,
    paddingVertical: webSpacing[2],
  },
  rows: { gap: webSpacing[2] },
  weightRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    ...webDepth.list,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  weightLabel: {
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
    flex: 1,
  },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[1],
  },
  stepperButton: {
    width: 26,
    height: 26,
    borderRadius: webRadius.sm,
    borderWidth: 1,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  weightInput: {
    width: 46,
    fontSize: webFontSize.base,
    fontWeight: '600',
    color: webColors.foreground,
    borderWidth: 1,
    borderColor: webColors.border,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[1],
    paddingVertical: 6,
    textAlign: 'center',
  },
  saveButton: {
    marginTop: webSpacing[5],
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
    backgroundColor: webColors.accent,
  },
  saveButtonDisabled: {
    opacity: 0.4,
  },
  saveButtonText: {
    fontSize: webFontSize.base,
    fontWeight: '700',
    color: '#ffffff',
  },
  clearButton: {
    marginTop: webSpacing[3],
    paddingVertical: webSpacing[2],
    alignItems: 'center',
  },
  clearButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
});
