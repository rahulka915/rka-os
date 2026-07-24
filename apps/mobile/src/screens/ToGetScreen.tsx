import { useCallback, useState } from 'react';
import { Image, StyleSheet, Text, TouchableOpacity, ScrollView, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { getItemsByType } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { ShoppingBag } from '../icons';
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
  return Array.isArray(meta.tags) && typeof meta.tags[0] === 'string' ? meta.tags[0] : 'Other';
}

export function ToGetScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [objects, setObjects] = useState<Item[]>([]);

  useFocusEffect(useCallback(() => {
    setObjects(getItemsByType('object'));
  }, []));

  const groups = new Map<string, Item[]>();
  for (const item of objects) {
    const key = firstTag(item);
    const list = groups.get(key) ?? [];
    list.push(item);
    groups.set(key, list);
  }
  const groupNames = [...groups.keys()].sort((a, b) => (a === 'Other' ? 1 : b === 'Other' ? -1 : a.localeCompare(b)));

  return (
    <LensSurface title="To Get">
      {objects.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Nothing to get yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Classify a captured item as "Object" in Inbox</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {groupNames.map((group) => (
            <View key={group} style={styles.section}>
              <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>{group.toUpperCase()}</Text>
              <View style={styles.sectionRows}>
                {(groups.get(group) ?? []).map((item) => {
                  const meta = parseMetadata(item);
                  const objectStatus: ObjectStatus = (meta.objectStatus as ObjectStatus) ?? 'want';
                  const price = typeof meta.price === 'number' ? meta.price : null;
                  const photoUri = typeof meta.photo === 'string' ? meta.photo : undefined;
                  return (
                    <TouchableOpacity
                      key={item.id}
                      style={[styles.row, { backgroundColor: palette.surface }]}
                      activeOpacity={0.7}
                      onPress={() => (navigation as any).navigate('ObjectDetail', { objectId: item.id })}
                    >
                      {photoUri ? (
                        <Image source={{ uri: photoUri }} style={styles.rowThumb} />
                      ) : (
                        <ShoppingBag size={24} color={palette.textMuted} strokeWidth={1.6} />
                      )}
                      <View style={styles.rowBody}>
                        <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
                        <Text style={[styles.rowSub, { color: palette.textSecondary }]}>
                          {STATUS_LABELS[objectStatus]}{price != null ? ` · $${price.toFixed(2)}` : ''}
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          ))}
        </ScrollView>
      )}
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  section: {
    marginBottom: 20,
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    marginBottom: 8,
    paddingHorizontal: 4,
  },
  sectionRows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  rowThumb: {
    width: 24,
    height: 24,
    borderRadius: 6,
  },
  rowBody: {
    flex: 1,
    gap: 2,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  rowSub: {
    fontSize: 13,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
