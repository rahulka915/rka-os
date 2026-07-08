import type { RoninMood } from '../domain/ronin/types';

export type { RoninMood };

interface RoninMoodInput {
  isTimerRunning?: boolean;
  overdueCount?: number;
  inboxCount?: number;
  completedJustNow?: boolean;
  hour?: number;
}

export function getRoninMood(input: RoninMoodInput): RoninMood {
  const hour = input.hour ?? new Date().getHours();
  if (input.completedJustNow) return 'resolved';
  if (input.isTimerRunning) return 'focused';
  if ((input.inboxCount ?? 0) >= 10 || (input.overdueCount ?? 0) >= 3) return 'overwhelmed';
  if ((input.overdueCount ?? 0) > 0 || (input.inboxCount ?? 0) >= 5) return 'alert';
  if (hour >= 23 || hour < 5) return 'tired';
  return 'normal';
}
