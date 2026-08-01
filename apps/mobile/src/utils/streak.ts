import { parseRepeatRule, dayMatchesRepeat, addDays } from './repeat.ts';

// Derived from activityLogs' 'completed-occurrence' entries (see
// updateItemStatus in database.ts), never a stored counter — self-healing,
// no drift risk between the log and the number shown.
//
// Walks backward from `today` (or from the day before, if today hasn't been
// completed yet — an unfinished today shouldn't zero out an active streak),
// counting consecutive rule-matching days that are in `completedDates`. Days
// the rule doesn't apply to (e.g. weekends for a Weekdays habit) are skipped
// without breaking the streak. Stops at the first rule-matching day that's
// missing from `completedDates`.
export function computeStreak(
  rrule: string | null | undefined,
  completedDates: Set<string>,
  today: string,
): number {
  const rule = parseRepeatRule(rrule);
  if (!rule) return 0;

  let cursor = completedDates.has(today) ? today : addDays(today, -1);
  let streak = 0;

  // 10-year cap as a hard backstop against ever looping unboundedly — real
  // streaks never approach this.
  for (let i = 0; i < 3650; i++) {
    if (dayMatchesRepeat(rule, cursor)) {
      if (!completedDates.has(cursor)) break;
      streak++;
    }
    cursor = addDays(cursor, -1);
  }

  return streak;
}
