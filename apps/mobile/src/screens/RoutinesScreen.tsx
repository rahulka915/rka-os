import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { getItemsByType, createRoutine, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { showActionSheet } from '../utils/actionSheet';
import { ListChecks } from '../icons';
import type { Item } from '../db/types';

// No header "+" — holding the dock FAB while this screen is focused opens
// New Routine instead (see useRegisterFabHoldAction / App.tsx's runFabHold),
// same pattern as Habits/Workouts.
export function RoutinesScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [routines, setRoutines] = useState<Item[]>([]);
  const [createOpen, setCreateOpen] = useState(false);

  const refresh = useCallback(() => {
    setRoutines(getItemsByType('routine'));
  }, []);

  useFocusEffect(refresh);

  useRegisterFabHoldAction(useCallback(() => setCreateOpen(true), []));

  const handleCreate = (title: string) => {
    const id = createRoutine(title);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    setCreateOpen(false);
    refresh();
    (navigation as any).navigate('RoutineTemplateDetail', { routineId: id, title });
  };

  const handleLongPress = (routine: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(routine.title, [
      {
        label: 'Delete',
        onPress: () => {
          deleteItem(routine.id);
          refresh();
        },
        destructive: true,
      },
    ]);
  };

  return (
    <LensSurface title="Routines">
      {routines.length === 0 ? (
        <View style={styles.empty}>
          <Text style={[styles.emptyTitle, { color: palette.text }]}>No routines yet</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>Hold the + in the dock to create one</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {routines.map((routine) => (
              <TouchableOpacity
                key={routine.id}
                style={[styles.row, { backgroundColor: palette.surface }]}
                activeOpacity={0.7}
                onPress={() => (navigation as any).navigate('RoutineTemplateDetail', { routineId: routine.id, title: routine.title })}
                onLongPress={() => handleLongPress(routine)}
                delayLongPress={400}
              >
                <ListChecks size={22} color={palette.red} strokeWidth={1.8} />
                <View style={styles.rowContent}>
                  <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{routine.title}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        </ScrollView>
      )}

      <QuickCreateSheet
        visible={createOpen}
        title="New Routine"
        placeholder="Routine name..."
        icon={<ListChecks size={38} color={palette.red} />}
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
  rows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  rowContent: {
    flex: 1,
    minHeight: 22,
    justifyContent: 'center',
  },
  rowTitle: {
    fontSize: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 8,
  },
  emptyTitle: {
    fontSize: 18,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  emptySub: {
    fontSize: 14,
    fontFamily: 'Inter_400Regular',
    fontWeight: '400',
  },
});
