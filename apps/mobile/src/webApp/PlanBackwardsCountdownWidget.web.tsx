import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Navigation } from 'lucide-react-native';
import { getPlanBlocks } from '../db/database';
import { useBackwardPlans } from '../hooks/useDb';
import { parseBackwardPlanMeta } from '../utils/backwardPlanMeta';
import {
  calculateTimeRemaining,
  calculateUnallocatedTime,
  calculatePlanRequiredDuration,
  formatDurationMinutes,
  dateTimeFromParts,
  planBlockRowToCalc,
} from '../utils/backwardPlanCalc';
import { webColors, webRadius, webFontSize, webSpacing, webDepth } from '../theme/webTheme';
import type { Item } from '../db/types';

// Web port of native's PlanBackwardsCountdownWidget — same pure calc
// functions (backwardPlanCalc.ts), same soonest-future-Goal-Time selection.
// Tap is a no-op: Home has no wiring into PlanBackwardsScreen.web.tsx's
// AppShell-level navigation, and adding that is out of scope here — the
// countdown display being correct matters more than the tap doing something.
export function PlanBackwardsCountdownWidget() {
  const { plans } = useBackwardPlans();
  const [now, setNow] = useState(() => new Date());

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

  const requiredMinutes = useMemo(() => {
    if (!target) return 0;
    return calculatePlanRequiredDuration(getPlanBlocks(target.item.id).map(planBlockRowToCalc));
  }, [target?.item.id, now]);

  if (!target) return null;

  const timeRemaining = calculateTimeRemaining(now, target.goalDate);
  const unallocated = calculateUnallocatedTime(timeRemaining, requiredMinutes);
  const isShort = unallocated < 0;

  return (
    <View style={[styles.card, webDepth.card]}>
      <Navigation size={18} color={isShort ? webColors.destructive : webColors.accent} strokeWidth={1.8} />
      <Text style={[styles.remaining, isShort && styles.shortText]}>{formatDurationMinutes(Math.max(timeRemaining, 0))}</Text>
      <Text style={[styles.status, isShort && styles.shortText]} numberOfLines={1}>
        {isShort ? `${formatDurationMinutes(Math.abs(unallocated))} short` : target.item.title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flex: 1,
    aspectRatio: 1,
    backgroundColor: webColors.card,
    borderRadius: webRadius.lg,
    padding: webSpacing[3],
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  remaining: { fontSize: webFontSize.lg, fontWeight: '700', color: webColors.foreground },
  status: { fontSize: 10, fontWeight: '500', color: webColors.mutedForeground, textAlign: 'center' },
  shortText: { color: webColors.destructive },
});
