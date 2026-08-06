import { useCallback, useState } from 'react';
import { View, Text, TouchableOpacity, ScrollView, Alert, StyleSheet } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useAreas } from '../hooks/useDb';
import { createItem, updateItem, deleteItem, getAreaProjectCount, computeDomainScore, convertAreaToSkill } from '../db/database';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { QuickCreateSheet } from '../components/QuickCreateSheet';
import { RiverStoneSurface } from '../components/ui/RiverStoneSurface';
import { useRegisterFabHoldAction } from '../hooks/useFabHoldAction';
import { showActionSheet } from '../utils/actionSheet';
import type { Item } from '../db/types';
import { AreaBonsaiIcon } from '../components/icons/AreaBonsaiIcon';
import { getDomainIcon } from '../utils/domainIcons';

// No header "+" — holding the dock FAB while this screen is focused opens
// New Area instead (see useRegisterFabHoldAction / App.tsx's runFabHold).
export function AreasScreen() {
  const navigation = useNavigation();
  const { areas, refresh } = useAreas();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const [createOpen, setCreateOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Item | null>(null);
  const [scores, setScores] = useState<Record<string, number>>({});

  useFocusEffect(
    useCallback(() => {
      const next: Record<string, number> = {};
      for (const area of areas) next[area.id] = computeDomainScore(area.id);
      setScores(next);
    }, [areas]),
  );

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

  const promptConvertToSkill = (item: Item) => {
    const otherAreas = areas.filter((a) => a.id !== item.id);
    if (otherAreas.length === 0) {
      Alert.alert('No other Domain to move into', 'Convert to Skill re-homes this Domain’s Missions and Potential Stats onto another real Domain — create one first.');
      return;
    }
    showActionSheet(`Convert "${item.title}" to a Skill — pick its primary Domain`, [
      ...otherAreas.map((area) => ({
        label: area.title,
        onPress: () => {
          const skillId = convertAreaToSkill(item.id, area.id);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          refresh();
          (navigation as any).navigate('SkillDetail', { skillId, title: item.title });
        },
      })),
    ]);
  };

  const handleLongPress = (item: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    Alert.alert(item.title, undefined, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Edit', onPress: () => { setEditTarget(item); setCreateOpen(true); } },
      { text: 'Convert to Skill...', onPress: () => promptConvertToSkill(item) },
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
          <View style={styles.grid}>
            {areas.map((area) => {
              const count = getAreaProjectCount(area.id);
              const score = Math.round(scores[area.id] ?? 0);
              const DomainIcon = getDomainIcon(area.title);
              return (
                <TouchableOpacity
                  key={area.id}
                  style={styles.cardWrap}
                  activeOpacity={0.82}
                  onPress={() => (navigation as any).navigate('AreaDetail', { areaId: area.id, title: area.title })}
                  onLongPress={() => handleLongPress(area)}
                  delayLongPress={400}
                  accessibilityRole="button"
                  accessibilityLabel={`${area.title}, ${score}% potential, ${count} missions`}
                >
                  <RiverStoneSurface variant="card" isDark={isDark} style={styles.card} stretchToFill>
                    <View style={styles.cardContent}>
                      <DomainIcon size={30} color={palette.antiqueBrass} strokeWidth={1.6} />
                      <Text style={[styles.cardTitle, { color: palette.ivory }]} numberOfLines={2}>{area.title}</Text>
                      <View style={styles.cardFooter}>
                        <Text style={[styles.cardScore, { color: palette.vermilion }]}>{score}%</Text>
                        <Text style={[styles.cardCount, { color: palette.greige }]}>{count} missions</Text>
                      </View>
                    </View>
                  </RiverStoneSurface>
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
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    rowGap: 12,
  },
  cardWrap: {
    width: '31%',
    minHeight: 44,
  },
  card: {
    aspectRatio: 0.92,
  },
  cardContent: {
    flex: 1,
    padding: 12,
    justifyContent: 'space-between',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
    marginTop: 8,
  },
  cardFooter: {
    gap: 2,
  },
  cardScore: {
    fontSize: 16,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  cardCount: {
    fontSize: 11,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
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
