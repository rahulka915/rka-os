import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useWorkouts } from '../hooks/useDb';
import { createItem, updateItem, deleteItem } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import type { Item } from '../db/types';

const STARTERS = ['Push starter', 'Pull starter'];

// No header "+" — holding the dock FAB while this screen is focused opens
// New Template instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function WorkoutsScreen() {
  const { workouts, refresh } = useWorkouts();
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
    createItem('workout-template', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const openEdit = (item: Item) => {
    setEditTarget(item);
    setCreateOpen(true);
  };

  const handleStarter = (title: string) => {
    createItem('workout-template', title, 'active');
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
  };

  const handleStartEmpty = () => {
    // No workout-session model exists yet — this is a placeholder until one is built.
    Alert.alert('Coming soon', 'Live workout tracking is not wired up yet.');
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => openEdit(item) },
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
    <LensSurface title="Workouts">
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {workouts.length === 0 ? (
          <>
            <Text style={[styles.heading, { color: palette.text }]}>Ready to train?</Text>

            <TouchableOpacity
              style={[styles.primaryCard, { backgroundColor: palette.text }]}
              onPress={handleStartEmpty}
              activeOpacity={0.85}
            >
              <Text style={[styles.primaryCardText, { color: palette.bg }]}>Start empty workout</Text>
            </TouchableOpacity>

            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>BUILD FROM A TEMPLATE</Text>
            <View style={styles.startersRow}>
              {STARTERS.map(label => (
                <TouchableOpacity
                  key={label}
                  style={[styles.starterCard, { backgroundColor: palette.surface, borderColor: palette.separator }]}
                  onPress={() => handleStarter(label)}
                  activeOpacity={0.7}
                >
                  <Text style={[styles.starterText, { color: palette.text }]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <TouchableOpacity onPress={() => setCreateOpen(true)} hitSlop={8}>
              <Text style={[styles.linkText, { color: palette.deeperBlue }]}>Create your own template →</Text>
            </TouchableOpacity>
          </>
        ) : (
          <View style={styles.sectionRows}>
            <Text style={[styles.sectionLabel, { color: palette.textTertiary }]}>TEMPLATES</Text>
            {workouts.map(item => (
              <TouchableOpacity
                key={item.id}
                style={[styles.row, { backgroundColor: palette.surface }]}
                activeOpacity={0.7}
                onPress={() => openEdit(item)}
                onLongPress={() => handleLongPress(item)}
                delayLongPress={400}
              >
                <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{item.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      <QuickCreateSheet
        visible={createOpen}
        title={editTarget ? 'Edit Template' : 'New Template'}
        placeholder="Template name..."
        initialValue={editTarget?.title}
        onClose={() => { setCreateOpen(false); setEditTarget(null); }}
        onSubmit={handleCreate}
      />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: 16,
    paddingBottom: 40,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginBottom: 4,
  },
  primaryCard: {
    borderRadius: 14,
    paddingVertical: 18,
    alignItems: 'center',
    marginBottom: 8,
  },
  primaryCardText: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    marginBottom: 4,
  },
  startersRow: {
    flexDirection: 'row',
    gap: 12,
  },
  starterCard: {
    flex: 1,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 20,
    alignItems: 'center',
  },
  starterText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
  linkText: {
    fontSize: 14,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    marginTop: 4,
  },
  sectionRows: {
    gap: 8,
  },
  row: {
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
  },
});
