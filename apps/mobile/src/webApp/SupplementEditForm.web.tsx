import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { updateSupplement, deleteItem } from '../db/database';
import type { SupplementMeta, NutrientProfile } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface SupplementEditFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

const NUTRIENT_FIELDS: { key: keyof NutrientProfile; label: string; placeholder: string }[] = [
  { key: 'sodium', label: 'Sodium (mg)', placeholder: 'e.g. 300' },
  { key: 'potassium', label: 'Potassium (mg)', placeholder: 'e.g. 200' },
  { key: 'magnesium', label: 'Magnesium (mg)', placeholder: 'e.g. 60' },
  { key: 'calcium', label: 'Calcium (mg)', placeholder: 'e.g. 100' },
  { key: 'chloride', label: 'Chloride (mg)', placeholder: 'e.g. 500' },
];

function parseMetadata(raw?: string): SupplementMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as SupplementMeta;
  } catch {
    return {};
  }
}

function numOrUndefined(text: string): number | undefined {
  const trimmed = text.trim();
  if (!trimmed) return undefined;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : undefined;
}

export function SupplementEditForm({ item, onChanged, onDeleted }: SupplementEditFormProps) {
  const meta = parseMetadata(item.metadata);

  const [title, setTitle] = useState(item.title);
  const [dose, setDose] = useState(meta.dose ?? '');
  const [nutrientText, setNutrientText] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const { key } of NUTRIENT_FIELDS) {
      if (meta.nutrients?.[key] !== undefined) initial[key] = String(meta.nutrients[key]);
    }
    return initial;
  });

  const save = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const nutrients: NutrientProfile = {};
    for (const { key } of NUTRIENT_FIELDS) {
      const value = numOrUndefined(nutrientText[key] ?? '');
      if (value !== undefined) nutrients[key] = value;
    }
    updateSupplement(item.id, trimmedTitle, { dose: dose.trim() || undefined, nutrients });
    onChanged();
  };

  const remove = () => {
    if (!window.confirm(`Delete ${item.title}? This cannot be undone.`)) return;
    deleteItem(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <View style={styles.field}>
        <Text style={styles.label}>Supplement name</Text>
        <TextInput value={title} onChangeText={setTitle} onBlur={save} style={styles.input} />
      </View>
      <View style={styles.field}>
        <Text style={styles.label}>Dose</Text>
        <TextInput value={dose} onChangeText={setDose} onBlur={save} placeholder="e.g. 1 sachet" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
      </View>

      <Text style={styles.sectionLabel}>Nutrients (optional)</Text>
      {NUTRIENT_FIELDS.map(({ key, label, placeholder }) => (
        <View key={key} style={styles.field}>
          <Text style={styles.label}>{label}</Text>
          <TextInput
            value={nutrientText[key] ?? ''}
            onChangeText={(value) => setNutrientText((prev) => ({ ...prev, [key]: value }))}
            onBlur={save}
            placeholder={placeholder}
            placeholderTextColor={webColors.mutedForeground}
            keyboardType="numeric"
            style={styles.input}
          />
        </View>
      ))}

      <Pressable style={styles.deleteButton} onPress={remove}>
        <Trash2 size={14} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteText}>Delete supplement</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  field: {
    gap: webSpacing[1],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: webSpacing[2],
  },
  input: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
  },
  deleteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[4],
    paddingVertical: webSpacing[2],
  },
  deleteText: {
    fontSize: webFontSize.sm,
    color: webColors.destructive,
    fontWeight: '600',
  },
});
