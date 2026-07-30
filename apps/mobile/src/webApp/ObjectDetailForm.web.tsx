import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { updateItemTitle, updateItem, updateItemMetadata, deleteItem } from '../db/database';
import type { Item, ObjectStatus } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface ObjectDetailFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

const STATUS_OPTIONS: Array<{ value: ObjectStatus; label: string }> = [
  { value: 'want', label: 'Want' },
  { value: 'need', label: 'Need' },
  { value: 'saving', label: 'Saving' },
  { value: 'ready', label: 'Ready to Buy' },
  { value: 'ordered', label: 'Ordered' },
  { value: 'owned', label: 'Owned' },
];

function parseMetadata(raw?: string): Record<string, unknown> {
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch {
    return {};
  }
}

export function ObjectDetailForm({ item, onChanged, onDeleted }: ObjectDetailFormProps) {
  const metadata = parseMetadata(item.metadata);
  const objectStatus: ObjectStatus = (metadata.objectStatus as ObjectStatus) ?? 'want';
  const category = Array.isArray(metadata.tags) && typeof metadata.tags[0] === 'string' ? (metadata.tags[0] as string) : '';

  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const [priceText, setPriceText] = useState(typeof metadata.price === 'number' ? String(metadata.price) : '');
  const [categoryText, setCategoryText] = useState(category);

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
    setPriceText(typeof metadata.price === 'number' ? String(metadata.price) : '');
    setCategoryText(category);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.id, item.title, item.notes, item.metadata]);

  const saveTitle = () => {
    const trimmed = title.trim();
    if (trimmed && trimmed !== item.title) {
      updateItemTitle(item.id, trimmed);
      onChanged();
    }
  };

  const saveNotes = () => {
    if (notes !== (item.notes ?? '')) {
      updateItem(item.id, { notes: notes || null });
      onChanged();
    }
  };

  const setStatus = (value: ObjectStatus) => {
    updateItemMetadata(item.id, { ...metadata, objectStatus: value });
    onChanged();
  };

  const savePrice = () => {
    const parsed = parseFloat(priceText);
    const next = { ...metadata };
    if (Number.isFinite(parsed)) next.price = parsed;
    else delete next.price;
    updateItemMetadata(item.id, next);
    onChanged();
  };

  const saveCategory = () => {
    const trimmed = categoryText.trim();
    const next = { ...metadata };
    if (trimmed) next.tags = [trimmed];
    else delete next.tags;
    updateItemMetadata(item.id, next);
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

      <View>
        <Text style={styles.label}>Status</Text>
        <View style={styles.chipRow}>
          {STATUS_OPTIONS.map((option) => {
            const active = objectStatus === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => setStatus(option.value)}
                style={[styles.chip, active && styles.chipActive]}
              >
                <Text style={[styles.chipText, active && styles.chipTextActive]}>{option.label}</Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.row}>
        <View style={styles.rowField}>
          <Text style={styles.label}>Price</Text>
          <TextInput
            value={priceText}
            onChangeText={setPriceText}
            onBlur={savePrice}
            placeholder="0.00"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.input}
          />
        </View>
        <View style={styles.rowField}>
          <Text style={styles.label}>Category</Text>
          <TextInput
            value={categoryText}
            onChangeText={setCategoryText}
            onBlur={saveCategory}
            placeholder="e.g. Music"
            placeholderTextColor={webColors.mutedForeground}
            style={styles.input}
          />
        </View>
      </View>

      <View>
        <Text style={styles.label}>Notes</Text>
        <TextInput
          value={notes}
          onChangeText={setNotes}
          onBlur={saveNotes}
          style={styles.notesInput}
          placeholder="Add notes…"
          placeholderTextColor={webColors.mutedForeground}
          multiline
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
  chipRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  chip: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
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
  notesInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
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
