import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Plus } from 'lucide-react-native';
import { getItemsByType, createItem } from '../db/database';
import { useDbRefresh } from '../hooks/useDb';
import { DetailPanel } from './DetailPanel';
import { ObjectDetailForm } from './ObjectDetailForm';
import { webColors, webSpacing, webRadius, webFontSize } from '../theme/webTheme';
import type { Item, ObjectStatus } from '../db/types';

const STATUS_LABELS: Record<ObjectStatus, string> = {
  want: 'Want',
  need: 'Need',
  saving: 'Saving',
  ready: 'Ready to Buy',
  ordered: 'Ordered',
  owned: 'Owned',
};

function parseMetadata(item: Item): Record<string, unknown> {
  if (!item.metadata) return {};
  try {
    return JSON.parse(item.metadata) as Record<string, unknown>;
  } catch {
    return {};
  }
}

function firstTag(item: Item): string {
  const meta = parseMetadata(item);
  return Array.isArray(meta.tags) && typeof meta.tags[0] === 'string' ? (meta.tags[0] as string) : 'Other';
}

function useObjects() {
  const [objects, setObjects] = useState<Item[]>([]);
  const refresh = useCallback(() => {
    setObjects(getItemsByType('object'));
  }, []);
  useDbRefresh(refresh);
  return { objects, refresh };
}

export function ObjectsScreen() {
  const { objects, refresh } = useObjects();
  const [captureText, setCaptureText] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selectedItem = objects.find((i) => i.id === selectedId) ?? null;

  const submit = () => {
    const trimmed = captureText.trim();
    if (!trimmed) return;
    createItem('object', trimmed, 'active');
    setCaptureText('');
    refresh();
  };

  const groups = new Map<string, Item[]>();
  for (const item of objects) {
    const key = firstTag(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const groupNames = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        <View style={styles.header}>
          <Text style={styles.title}>To Get</Text>
          <Text style={styles.count}>{objects.length}</Text>
        </View>

        <View style={styles.captureRow}>
          <Plus size={16} color={webColors.mutedForeground} strokeWidth={2} />
          <TextInput
            value={captureText}
            onChangeText={setCaptureText}
            onSubmitEditing={submit}
            placeholder="Add something to get..."
            placeholderTextColor={webColors.mutedForeground}
            style={styles.captureInput}
          />
        </View>

        {objects.length === 0 ? (
          <Text style={styles.empty}>Nothing to get yet.</Text>
        ) : (
          groupNames.map((group) => (
            <View key={group} style={styles.section}>
              <Text style={styles.sectionLabel}>{group.toUpperCase()}</Text>
              {(groups.get(group) ?? []).map((item) => {
                const meta = parseMetadata(item);
                const objectStatus: ObjectStatus = (meta.objectStatus as ObjectStatus) ?? 'want';
                const price = typeof meta.price === 'number' ? meta.price : null;
                return (
                  <Pressable key={item.id} style={styles.row} onPress={() => setSelectedId(item.id)}>
                    <Text style={styles.rowTitle} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.rowSub}>
                      {STATUS_LABELS[objectStatus]}
                      {price != null ? ` · $${price.toFixed(2)}` : ''}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ))
        )}
      </ScrollView>

      <DetailPanel visible={!!selectedItem} onClose={() => setSelectedId(null)} title="Object">
        {selectedItem ? (
          <ObjectDetailForm
            item={selectedItem}
            onChanged={refresh}
            onDeleted={() => {
              setSelectedId(null);
              refresh();
            }}
          />
        ) : null}
      </DetailPanel>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: webColors.background,
  },
  scrollContent: {
    paddingHorizontal: webSpacing[6],
    paddingTop: webSpacing[6],
    paddingBottom: webSpacing[8],
    gap: webSpacing[4],
  },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: webSpacing[3],
  },
  title: {
    fontSize: webFontSize.xl,
    fontWeight: '700',
    color: webColors.foreground,
  },
  count: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
  },
  captureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: webSpacing[2],
    backgroundColor: webColors.muted,
    borderRadius: webRadius.sm,
    paddingHorizontal: webSpacing[3],
    paddingVertical: webSpacing[3],
  },
  captureInput: {
    flex: 1,
    fontSize: webFontSize.base,
    color: webColors.foreground,
  },
  empty: {
    fontSize: webFontSize.sm,
    color: webColors.mutedForeground,
    paddingVertical: webSpacing[4],
  },
  section: {
    gap: webSpacing[2],
  },
  sectionLabel: {
    fontSize: webFontSize.xs,
    fontWeight: '600',
    color: webColors.mutedForeground,
    letterSpacing: 0.5,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: webSpacing[3],
    backgroundColor: webColors.card,
    borderRadius: webRadius.md,
    borderWidth: 1,
    borderColor: webColors.border,
    paddingHorizontal: webSpacing[4],
    paddingVertical: webSpacing[3],
  },
  rowTitle: {
    fontSize: webFontSize.base,
    color: webColors.foreground,
    flex: 1,
  },
  rowSub: {
    fontSize: webFontSize.xs,
    color: webColors.mutedForeground,
  },
});
