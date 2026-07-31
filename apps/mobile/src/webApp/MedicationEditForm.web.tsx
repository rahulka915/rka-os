import { useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { updateMedication, deleteItem } from '../db/database';
import type { MedicationMeta } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface MedicationEditFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

const AUTO_STOP_PRESETS = [4, 5, 8, 12, 18, 24];

function parseMetadata(raw?: string): MedicationMeta {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as MedicationMeta;
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

export function MedicationEditForm({ item, onChanged, onDeleted }: MedicationEditFormProps) {
  const meta = parseMetadata(item.metadata);
  const isNew = meta.stockRemaining === undefined && !meta.containers;

  const [title, setTitle] = useState(item.title);
  const [dose, setDose] = useState(meta.dose ?? '');
  const [stockText, setStockText] = useState(String(meta.stockRemaining ?? meta.initialStock ?? ''));
  const [minHoursText, setMinHoursText] = useState(meta.minHoursBetweenDoses != null ? String(meta.minHoursBetweenDoses) : '');
  const [splitDoseEnabled, setSplitDoseEnabled] = useState(!!meta.splitDoseEnabled);
  const [autoStopText, setAutoStopText] = useState(meta.autoStopAfterHours != null ? String(meta.autoStopAfterHours) : '24');
  const [containerLabel, setContainerLabel] = useState(meta.containerLabel ?? '');
  const [containerSizeText, setContainerSizeText] = useState(meta.containerSize != null ? String(meta.containerSize) : '');
  const [containersPerRestockText, setContainersPerRestockText] = useState(
    meta.containersPerRestock != null ? String(meta.containersPerRestock) : ''
  );
  const [sheetsPerContainerText, setSheetsPerContainerText] = useState(
    meta.sheetsPerContainer != null ? String(meta.sheetsPerContainer) : ''
  );
  const [pillsPerSheetText, setPillsPerSheetText] = useState(meta.pillsPerSheet != null ? String(meta.pillsPerSheet) : '');
  const [packagingNote, setPackagingNote] = useState(meta.packagingNote ?? '');

  const save = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) return;
    const nextMeta: MedicationMeta = {
      ...meta,
      dose: dose.trim() || undefined,
      minHoursBetweenDoses: numOrUndefined(minHoursText),
      splitDoseEnabled: splitDoseEnabled || undefined,
      autoStopAfterHours: numOrUndefined(autoStopText),
      containerLabel: containerLabel.trim() || undefined,
      containerSize: numOrUndefined(containerSizeText),
      containersPerRestock: numOrUndefined(containersPerRestockText),
      sheetsPerContainer: numOrUndefined(sheetsPerContainerText),
      pillsPerSheet: numOrUndefined(pillsPerSheetText),
      packagingNote: packagingNote.trim() || undefined,
    };
    if (isNew) {
      nextMeta.initialStock = numOrUndefined(stockText);
      nextMeta.stockRemaining = numOrUndefined(stockText);
    }
    updateMedication(item.id, trimmedTitle, nextMeta);
    onChanged();
  };

  const handleDelete = () => {
    if (!window.confirm(`Delete "${item.title}"? This can't be undone.`)) return;
    deleteItem(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <View>
        <Text style={styles.label}>Medication name</Text>
        <TextInput value={title} onChangeText={setTitle} onBlur={save} style={styles.input} />
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Dose</Text>
          <TextInput value={dose} onChangeText={setDose} onBlur={save} placeholder="e.g. 400mg" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>{isNew ? 'Initial stock (units)' : 'Stock remaining (use Restock to add more)'}</Text>
          <TextInput
            value={stockText}
            onChangeText={setStockText}
            onBlur={save}
            editable={isNew}
            style={[styles.input, !isNew && styles.inputDisabled]}
          />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Min hours between doses</Text>
          <TextInput value={minHoursText} onChangeText={setMinHoursText} onBlur={save} style={styles.input} />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>Can be split</Text>
          <Pressable
            onPress={() => {
              setSplitDoseEnabled((v) => !v);
              save();
            }}
            style={[styles.toggle, splitDoseEnabled && styles.toggleActive]}
          >
            <Text style={[styles.toggleText, splitDoseEnabled && styles.toggleTextActive]}>
              {splitDoseEnabled ? 'Enabled' : 'Off'}
            </Text>
          </Pressable>
        </View>
      </View>

      <View>
        <Text style={styles.label}>Auto-stop after (hours)</Text>
        <TextInput value={autoStopText} onChangeText={setAutoStopText} onBlur={save} style={styles.input} />
        <View style={styles.chipRow}>
          {AUTO_STOP_PRESETS.map((hours) => {
            const active = autoStopText === String(hours);
            return (
              <Pressable
                key={hours}
                onPress={() => {
                  setAutoStopText(String(hours));
                  save();
                }}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{hours}h</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <Text style={styles.sectionLabel}>PACKAGING</Text>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Container label</Text>
          <TextInput value={containerLabel} onChangeText={setContainerLabel} onBlur={save} placeholder="e.g. box" placeholderTextColor={webColors.mutedForeground} style={styles.input} />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>Pills per container</Text>
          <TextInput value={containerSizeText} onChangeText={setContainerSizeText} onBlur={save} style={styles.input} />
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Containers per restock</Text>
          <TextInput value={containersPerRestockText} onChangeText={setContainersPerRestockText} onBlur={save} style={styles.input} />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>Sheets per container</Text>
          <TextInput value={sheetsPerContainerText} onChangeText={setSheetsPerContainerText} onBlur={save} style={styles.input} />
        </View>
      </View>

      <View>
        <Text style={styles.label}>Pills per sheet</Text>
        <TextInput value={pillsPerSheetText} onChangeText={setPillsPerSheetText} onBlur={save} style={styles.input} />
      </View>

      <View>
        <Text style={styles.label}>Packaging note</Text>
        <TextInput
          value={packagingNote}
          onChangeText={setPackagingNote}
          onBlur={save}
          placeholder="e.g. 28 + 2 topper blister"
          placeholderTextColor={webColors.mutedForeground}
          style={styles.input}
        />
      </View>

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: webSpacing[4],
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '700',
    color: webColors.foreground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: webSpacing[2],
  },
  input: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  inputDisabled: {
    opacity: 0.5,
  },
  row: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  rowField: {
    flex: 1,
  },
  toggle: {
    alignSelf: 'flex-start',
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
    borderRadius: webRadius.sm,
    backgroundColor: webColors.muted,
  },
  toggleActive: {
    backgroundColor: webColors.accent,
  },
  toggleText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  toggleTextActive: {
    color: webColors.card,
  },
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
    marginTop: webSpacing[2],
  },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[1],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  chipActive: {
    backgroundColor: webColors.accent,
  },
  chipText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  chipTextActive: {
    color: webColors.card,
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[2],
    paddingTop: webSpacing[4],
    borderTopWidth: 1,
    borderTopColor: webColors.border,
  },
  deleteLabel: {
    fontSize: webFontSize.sm,
    color: webColors.destructive,
    fontWeight: '600',
  },
});
