import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import * as Haptics from 'expo-haptics';
import { useBackwardPlans } from '../../hooks/useDb';
import { getPlanBlocks } from '../../db/database';
import { parseBackwardPlanMeta } from '../../utils/backwardPlanMeta';
import {
  calculateTimeRemaining,
  calculateUnallocatedTime,
  calculatePlanRequiredDuration,
  formatDurationMinutes,
  dateTimeFromParts,
  planBlockRowToCalc,
} from '../../utils/backwardPlanCalc';
import { RiverStoneSurface } from '../riverstone';
import { getThemeColors } from '../../theme';
import { Navigation as NavigationIcon } from '../../icons';
import type { Item } from '../../db/types';

interface PlanBackwardsCountdownWidgetProps {
  isDark: boolean;
}

// Same square-card slot as Medication/Weather in Home's widget row. Shows
// the soonest upcoming Plan Backwards plan's live time budget — Remaining
// to Goal Time, and Unallocated (red once the plan doesn't fit). Renders
// nothing when there's no plan with a future Goal Time, same fail-soft
// principle as the rest of Home's widgets. Tap opens that plan.
export function PlanBackwardsCountdownWidget({ isDark }: PlanBackwardsCountdownWidgetProps) {
  const navigation = useNavigation();
  const palette = getThemeColors(isDark);
  const { plans } = useBackwardPlans();
  const [now, setNow] = useState(() => new Date());
  const [requiredMinutes, setRequiredMinutes] = useState(0);

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const target = useMemo(() => {
    let best: { item: Item; goalDate: Date } | null = null;
    for (const plan of plans) {
      const meta = parseBackwardPlanMeta(plan.metadata);
      if (!plan.scheduledDate || !meta.goalTime) continue;
      const goalDate = dateTimeFromParts(plan.scheduledDate, meta.goalTime);
      if (goalDate.getTime() <= now.getTime()) continue;
      if (!best || goalDate.getTime() < best.goalDate.getTime()) best = { item: plan, goalDate };
    }
    return best;
  }, [plans, now]);

  useEffect(() => {
    if (!target) {
      setRequiredMinutes(0);
      return;
    }
    const blocks = getPlanBlocks(target.item.id);
    setRequiredMinutes(calculatePlanRequiredDuration(blocks.map(planBlockRowToCalc)));
  }, [target?.item.id, now]);

  if (!target) return null;

  const timeRemaining = calculateTimeRemaining(now, target.goalDate);
  const unallocated = calculateUnallocatedTime(timeRemaining, requiredMinutes);
  const isShort = unallocated < 0;

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    (navigation as any).navigate('Menu', { screen: 'PlanBackwardsDetail', params: { planId: target.item.id } });
  };

  return (
    <TouchableOpacity onPress={handlePress} activeOpacity={0.75} style={styles.touchWrap}>
      <RiverStoneSurface variant="card" mode={isDark ? 'dark' : 'light'} style={styles.squareCard} contentStyle={styles.fill}>
        <View style={styles.content}>
          <NavigationIcon size={18} color={isShort ? palette.red : palette.deeperBlue} strokeWidth={1.8} />
          <Text style={[styles.remaining, { color: isShort ? palette.red : palette.text }]}>
            {formatDurationMinutes(Math.max(timeRemaining, 0))}
          </Text>
          <Text style={[styles.status, { color: isShort ? palette.red : palette.textTertiary }]} numberOfLines={1}>
            {isShort ? `${formatDurationMinutes(Math.abs(unallocated))} short` : target.item.title}
          </Text>
        </View>
      </RiverStoneSurface>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  touchWrap: {
    paddingVertical: 4,
  },
  fill: {
    flex: 1,
  },
  squareCard: {
    aspectRatio: 1.16,
    overflow: 'hidden',
  },
  content: {
    flex: 1,
    padding: 8,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
  },
  remaining: {
    fontSize: 15,
    fontWeight: '700',
    fontFamily: 'Inter_700Bold',
  },
  status: {
    fontSize: 10,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    textAlign: 'center',
  },
});
