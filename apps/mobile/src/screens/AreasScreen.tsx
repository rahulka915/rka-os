import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAreas } from '../hooks/useDb';
import { createItem, updateItem, deleteItem, getAreaProjectCount } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import type { Item } from '../db/types';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';

// No header "+" — holding the dock FAB while this screen is focused opens
// New Area instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function AreasScreen() {
  const navigation = useNavigation();
  const { areas, refresh } = useAreas();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (title: string) => {
    if (editTarget) {
      updateItem(editTarget.id, { title });
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      refresh();
      return;
    }
    createItem('area', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => { setEditTarget(item); setCreateOpen(true); } },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert(`Delete ${item.title}?`, 'This cannot be undone.', [
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
        },
      },
    ]);
  };

  return (
    <LensSurface title="Domains">
      {areas.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No domains yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            Domains group related missions (e.g. Health, Finances). Hold the + in the dock to create one.
          </Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {areas.map(area => {
              const count = getAreaProjectCount(area.id);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('AreaDetail', { areaId: area.id, title: area.title })}
                  onLongPress={() => handleLongPress(area)}
                  delayLongPress={400}
                >
                  <AreaBonsaiIcon size={34} />
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{area.title}</Text>
                  <Text style={[styles.rowCount, { color: palette.textTertiary }]}>{count}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title={editTarget ? 'Edit Domain' : 'New Domain'}
        placeholder="Domain name..."
        icon={<AreaBonsaiIcon size={38} />}
        initialValue={editTarget?.title}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
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
  rows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    flex: 1,
  },
  rowCount: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginLeft: 12,
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
    fontFamily: 'Inter_700Bold',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
    textAlign: 'center',
  },
});
