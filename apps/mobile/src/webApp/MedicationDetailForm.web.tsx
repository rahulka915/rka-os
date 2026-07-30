import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import {
  updateItemTitle,
  updateMedication,
  logMedicationTaken,
  getMedicationLogs,
  getTotalStock,
  deleteItem,
} from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface MedicationDetailFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function MedicationDetailForm({ item, onChanged, onDeleted }: MedicationDetailFormProps) {
  const metadata = parseMetadata(item.metadata);
  const [title, setTitle] = useState(item.title);
  const [doseText, setDoseText] = useState(typeof metadata.dose === 'string' ? metadata.dose : '');

  useEffect(() => {
    setTitle(item.title);
    setDoseText(typeof metadata.dose === 'string' ? metadata.dose : '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.title, item.metadata]);

  const stock = getTotalStock(metadata as any);
  const logs = getMedicationLogs(item.id, 5);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      updateItemTitle(item.id, trimmed);
      onChanged();
    }
  };

  const saveDose = () => {
    const trimmed = doseText.trim();
    updateMedication(item.id, item.title, { ...metadata, dose: trimmed || undefined });
    onChanged();
  };

  const logDoseNow = () => {
    logMedicationTaken(item.id);
    onChanged();
  };

  const handleDelete = () => {
    deleteItem(item.id);
    onDeleted();
  };

  return (
    <View style={styles.container}>
      <TextInput
        value={title}
        onChangeText={setTitle}
        onBlur={saveTitle}
        style={styles.titleInput}
        placeholder="Untitled"
        placeholderTextColor={webColors.mutedForeground}
      />

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Dose</Text>
          <TextInput
            value={doseText}
            onChangeText={setDoseText}
            onBlur={saveDose}
            placeholder="e.g. 20mg"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.input}
          />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>Stock</Text>
          <View style={styles.stockDisplay}>
            <Text style={styles.stockText}>{stock} remaining</Text>
          </View>
        </View>
      </View>

      <Pressable onPress={logDoseNow} style={styles.logButton}>
        <Text style={styles.logButtonText}>Log dose now</Text>
      </Pressable>

      <View>
        <Text style={styles.label}>Recent doses</Text>
        {logs.length === 0 ? (
          <Text style={styles.emptyText}>No doses logged yet.</Text>
        ) : (
          logs.map((log) => (
            <Text key={log.id} style={styles.logRow}>
              {new Date(log.timestamp).toLocaleString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              })}
            </Text>
          ))
        )}
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
  row: {
    flexDirection: 'row',
    gap: webSpacing[3],
  },
  rowField: {
    flex: 1,
  },
  input: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  stockDisplay: {
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  stockText: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
  },
  logButton: {
    backgroundColor: webColors.accent,
    borderRadius: webRadius.sm,
    paddingVertical: webSpacing[3],
    alignItems: 'center',
  },
  logButtonText: {
    fontSize: webFontSize.sm,
    fontWeight: '600',
    color: webColors.card,
  },
  emptyText: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  logRow: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[1],
  },
  deleteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    marginTop: webSpacing[4],
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
