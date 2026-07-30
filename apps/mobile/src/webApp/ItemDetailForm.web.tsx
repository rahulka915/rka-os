import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Check, Trash2 } from 'lucide-react-native';
import { updateItemTitle, updateItem, updateItemStatus, deleteItem } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface ItemDetailFormProps {
  item: Item;
  onChanged: () => void;
  onDeleted: () => void;
}

export function ItemDetailForm({ item, onChanged, onDeleted }: ItemDetailFormProps) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
  }, [item.id, item.title, item.notes]);

  const completed = item.status === 'completed';

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

  const toggleComplete = () => {
    updateItemStatus(item.id, completed ? 'active' : 'completed');
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

      <Pressable onPress={toggleComplete} style={styles.completeRow}>
        <View style={[styles.checkbox, completed && styles.checkboxDone]}>
          {completed ? <Check size={14} color={webColors.card} strokeWidth={2.5} /> : null}
        </View>
        <Text style={styles.completeLabel}>{completed ? 'Completed' : 'Mark as complete'}</Text>
      </Pressable>

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
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: webRadius.sm,
    borderWidth: 1.5,
    borderColor: webColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkboxDone: {
    backgroundColor: webColors.accent,
    borderColor: webColors.accent,
  },
  completeLabel: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    fontWeight: '500',
  },
  label: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
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
