import { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { createBackwardPlan, deleteBackwardPlan } from '../db/database';
import { useBackwardPlans } from '../hooks/useDb';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { LensSurface } from '../components/LensSurface';
import { AnchorEventEditSheet, type AnchorEventDraft } from '../components/AnchorEventEditSheet';
import { showActionSheet } from '../utils/actionSheet';
import { parseBackwardPlanMeta, formatClockTime } from '../utils/backwardPlanMeta';
import { Navigation, Plus } from '../icons';
import type { Item } from '../db/types';

// Entry point for Plan Backwards — a standalone workspace list (spec section
// 2: intentionally NOT folded into Today yet). Empty state leads straight
// into "Add Event" since a plan can't exist without its anchor.
export function PlanBackwardsScreen() {
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { plans, refresh } = useBackwardPlans();
  const [creating, setCreating] = useState(false);

  useFocusEffect(refresh);

  const handleCreate = (draft: AnchorEventDraft) => {
    const id = createBackwardPlan(draft.title, draft.date, draft.meta, draft.notes || undefined);
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    refresh();
    (navigation as any).navigate('PlanBackwardsDetail', { planId: id });
  };

  const handleLongPress = (plan: Item) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    showActionSheet(plan.title, [
      {
        label: 'Delete plan',
        destructive: true,
        onPress: () => {
          deleteBackwardPlan(plan.id);
          refresh();
        },
      },
    ]);
  };

  return (
    <LensSurface
      title="Plan Backwards"
      headerRight={
        <TouchableOpacity onPress={() => setCreating(true)} hitSlop={12} accessibilityLabel="Add event">
          <Plus size={22} color={palette.text} strokeWidth={2} />
        </TouchableOpacity>
      }
    >
      {plans.length === 0 ? (
        <View style={styles.empty}>
          <Navigation size={32} color={palette.textTertiary} strokeWidth={1.5} />
          <Text style={[styles.emptyTitle, { color: palette.text }]}>Work backwards from what matters</Text>
          <Text style={[styles.emptySub, { color: palette.textSecondary }]}>
            Set a Goal Time, then figure out everything that needs to happen before it.
          </Text>
          <TouchableOpacity style={[styles.emptyCta, { backgroundColor: palette.deeperBlue }]} onPress={() => setCreating(true)}>
            <Text style={styles.emptyCtaText}>Add Event</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          <View style={styles.rows}>
            {plans.map((plan) => {
              const meta = parseBackwardPlanMeta(plan.metadata);
              return (
                <TouchableOpacity
                  key={plan.id}
                  style={[styles.row, { backgroundColor: palette.surface }]}
                  activeOpacity={0.7}
                  onPress={() => (navigation as any).navigate('PlanBackwardsDetail', { planId: plan.id })}
                  onLongPress={() => handleLongPress(plan)}
                  delayLongPress={400}
                >
                  <Navigation size={20} color={palette.deeperBlue} strokeWidth={1.8} />
                  <View style={styles.rowContent}>
                    <Text style={[styles.rowTitle, { color: palette.text }]} numberOfLines={1}>{plan.title}</Text>
                    <Text style={[styles.rowSub, { color: palette.textTertiary }]} numberOfLines={1}>
                      {plan.scheduledDate ?? 'No date'}{meta.goalTime ? ` · Goal ${formatClockTime(meta.goalTime)}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      )}

      <AnchorEventEditSheet visible={creating} onClose={() => setCreating(false)} onSubmit={handleCreate} />
    </LensSurface>
  );
}

const styles = StyleSheet.create({
  listContent: { paddingHorizontal: 16, paddingBottom: 24 },
  rows: { gap: 8 },
  row: { borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, flexDirection: 'row', alignItems: 'center', gap: 10 },
  rowContent: { flex: 1, gap: 2 },
  rowTitle: { fontSize: 16, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
  rowSub: { fontSize: 12, fontFamily: 'Inter_400Regular', fontWeight: '400' },
  empty: { flex: 1, justifyContent: 'center', alignItems: 'center', gap: 10, paddingHorizontal: 32 },
  emptyTitle: { fontSize: 18, fontFamily: 'Inter_700Bold', fontWeight: '700', textAlign: 'center' },
  emptySub: { fontSize: 14, fontFamily: 'Inter_400Regular', fontWeight: '400', textAlign: 'center', lineHeight: 20 },
  emptyCta: { marginTop: 8, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  emptyCtaText: { color: '#fff', fontSize: 15, fontFamily: 'Inter_600SemiBold', fontWeight: '600' },
});
