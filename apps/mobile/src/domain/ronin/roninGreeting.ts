import type { RoninTimeOfDay } from './types';

// Real hiragana time-of-day greetings, name kept in romaji since it's a
// proper noun. Reuses the same 3-bucket RoninTimeOfDay ('morning'/'day'/
// 'night', see roninScenes.ts getTimeOfDay) already driving the hero card's
// scene art and gradient tint, rather than inventing a second time-bucket
// system just for this string.
//
// Returned as separate pieces (not one joined string) so RoninGreetingCard
// can render each with its own style if needed — currently both segments
// share the same Georgia italic font (a Mincho/Cormorant Garamond split was
// tried and reverted), but keeping them separate costs nothing and leaves
// the door open.
const GREETING_BY_TIME_OF_DAY: Record<RoninTimeOfDay, string> = {
  morning: 'おはよう',
  day: 'こんにちは',
  night: 'こんばんは',
};

export function getRoninGreetingWord(timeOfDay: RoninTimeOfDay): string {
  return GREETING_BY_TIME_OF_DAY[timeOfDay];
}
