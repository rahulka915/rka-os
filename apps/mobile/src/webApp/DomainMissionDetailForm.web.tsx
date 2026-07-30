import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { Trash2 } from 'lucide-react-native';
import { updateItemTitle, updateItem, deleteItem, setRelation, getRelatedItems, getRelation } from '../db/database';
import type { Item } from '../db/types';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';

export interface DomainMissionDetailFormProps {
  item: Item;
  domains: Item[];
  onChanged: () => void;
  onDeleted: () => void;
}

// Shared editor for both domains (type 'area') and missions (type 'project') —
// the two entity types differ only in whether a domain picker applies.
export function DomainMissionDetailForm({ item, domains, onChanged, onDeleted }: DomainMissionDetailFormProps) {
  const [title, setTitle] = useState(item.title);
  const [notes, setNotes] = useState(item.notes ?? '');
  const isMission = item.type === 'project';
  const currentDomainId = isMission ? getRelation(item.id, 'area') : null;

  useEffect(() => {
    setTitle(item.title);
    setNotes(item.notes ?? '');
  }, [item.id, item.title, item.notes]);

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

  const setDomain = (domainId: string | null) => {
    setRelation(item.id, 'area', domainId);
    onChanged();
  };

  const handleDelete = () => {
    const label = item.type === 'area' ? 'domain' : 'mission';
    const childLabel = item.type === 'area' ? 'missions' : 'tasks';
    if (!window.confirm(`Delete "${item.title}"? Its ${childLabel} will be unassigned, not deleted.`)) return;

    const relationType = item.type === 'area' ? 'area' : 'project';
    for (const child of getRelatedItems(item.id, relationType)) {
      setRelation(child.id, relationType, null);
    }
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

      {isMission ? (
        <View>
          <Text style={styles.label}>Domain</Text>
          <View style={styles.domainList}>
            <Pressable
              onPress={() => setDomain(null)}
              style={[styles.domainOption, currentDomainId === null && styles.domainOptionActive]}
            >
              <Text style={[styles.domainOptionText, currentDomainId === null && styles.domainOptionTextActive]}>
                No domain
              </Text>
            </Pressable>
            {domains.map((domain) => (
              <Pressable
                key={domain.id}
                onPress={() => setDomain(domain.id)}
                style={[styles.domainOption, currentDomainId === domain.id && styles.domainOptionActive]}
              >
                <Text
                  style={[styles.domainOptionText, currentDomainId === domain.id && styles.domainOptionTextActive]}
                >
                  {domain.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      ) : null}

      <Pressable onPress={handleDelete} style={styles.deleteRow}>
        <Trash2 size={16} color={webColors.destructive} strokeWidth={1.75} />
        <Text style={styles.deleteLabel}>Delete {item.type === 'area' ? 'domain' : 'mission'}</Text>
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
  notesInput: {
    fontSize: webFontSize.sm,
    color: webColors.foreground,
    minHeight: 100,
    textAlignVertical: 'top',
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    padding: webSpacing[3],
  },
  domainList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: webSpacing[2],
  },
  domainOption: {
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[2],
    borderRadius: webRadius.pill,
    backgroundColor: webColors.muted,
  },
  domainOptionActive: {
    backgroundColor: webColors.accent,
  },
  domainOptionText: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
  },
  domainOptionTextActive: {
    color: webColors.card,
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
