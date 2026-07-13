import type { RoninMood } from '../domain/ronin/types';

export type { RoninMood };

interface RoninMoodInput {
  isTimerRunning?: boolean;
  overdueCount?: number;
  inboxCount?: number;
  completedJustNow?: boolean;
  hour?: number;
}

export interface RoninStatus {
  mood: RoninMood;
  // Concrete, number-driven status copy for the Home hero card — replaces
  // the old fixed per-mood flavor text so the one real signal this card has
  // access to is actually visible instead of hidden behind ambient wording.
  statusLine: string;
}

// Single source of truth for both mood and its status line, so the two
// can never drift out of sync (each branch below produces both together).
export function getRoninStatus(input: RoninMoodInput): RoninStatus {
  const hour = input.hour ?? new Date().getHours();
  const overdueCount = input.overdueCount ?? 0;
  const inboxCount = input.inboxCount ?? 0;

  if (input.completedJustNow) {
    return { mood: 'resolved', statusLine: "Nice — that's done." };
  }
  if (input.isTimerRunning) {
    return { mood: 'focused', statusLine: 'Timer running — stay with it.' };
  }
  if (inboxCount >= 10 || overdueCount >= 3) {
    return { mood: 'overwhelmed', statusLine: `${overdueCount} overdue, ${inboxCount} waiting in your inbox.` };
  }
  if (overdueCount > 0 || inboxCount >= 5) {
    return {
      mood: 'alert',
      statusLine: overdueCount > 0 ? `${overdueCount} overdue.` : `${inboxCount} waiting in your inbox.`,
    };
  }
  if (hour >= 23 || hour < 5) {
    return { mood: 'tired', statusLine: 'Winding down for the night.' };
  }
  return { mood: 'normal', statusLine: 'Nothing overdue, inbox clear.' };
}

export function getRoninMood(input: RoninMoodInput): RoninMood {
  return getRoninStatus(input).mood;
}
