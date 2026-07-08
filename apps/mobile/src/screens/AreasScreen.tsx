import { useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useAreas } from '../hooks/useDb';
import { createItem, deleteItem, getAreaProjectCount, getProjectsForArea } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { LensFAB } from '../components/LensFAB';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import type { Item } from '../db/types';

export function AreasScreen() {
  const { areas, refresh } = useAreas();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleCreate = (title: string) => {
    createItem('area', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          deleteItem(item.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <LensSurface title="Areas" headerRight={<LensFAB onPress={() => setCreateOpen(true)} />}>
      {areas.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No areas yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            Areas group related projects (e.g. Health, Finances). Tap + to create one.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {areas.map(area => {
            const count = getAreaProjectCount(area.id);
            const isOpen = expanded === area.id;
            const projects = isOpen ? getProjectsForArea(area.id) : [];
            return (
              <View key={area.id} style={{ marginBottom: 8 }}>
                <TouchableOpacity
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => setExpanded(isOpen ? null : area.id)}
                  onLongPress={() => handleLongPress(area)}
                  delayLongPress={400}
                >
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{area.title}</Text>
                  <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{count}</Text>
                </TouchableOpacity>
                {isOpen && (
                  <View style={styles.nestedRows}>
                    {projects.length === 0 ? (
                      <Text style={[styles.nestedEmpty, { color: palette.textTertiary }]}>No projects in this area yet</Text>
                    ) : (
                      projects.map(p => (
                        <View key={p.id} style={[styles.nestedRow, { borderColor: palette.separator }]}>
                          <Text style={[styles.nestedTitle, { color: palette.textSecondary }]} numberOfLines={1}>{p.title}</Text>
                        </View>
                      ))
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title="New Area"
        placeholder="Area name..."
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreate}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 12,
  },
  nestedRows: {
    paddingLeft: 16,
    paddingTop: 8,
    gap: 6,
  },
  nestedRow: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderLeftWidth: 2,
  },
  nestedTitle: {
    fontSize: 14,
    fontWeight: '500',
  },
  nestedEmpty: {
    fontSize: 13,
    paddingLeft: 12,
    paddingVertical: 4,
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontWeight: '400',
    textAlign: 'center',
  },
});
