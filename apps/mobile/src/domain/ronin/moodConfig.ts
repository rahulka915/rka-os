import type { RoninMood, RoninMoodConfig } from './types';

// Copy, accessibility text, accent color, and cat reaction all live here so
// components never hardcode per-mood strings. Product-state feedback only —
// not a claim about the user's actual emotional or health state.
export const RONIN_MOOD_CONFIG: Record<RoninMood, RoninMoodConfig> = {
  normal: {
    mood: 'normal',
    statusLabel: 'Steady',
    supportingCopy: 'Ronin is steady today.',
    accessibilityLabel: 'Ronin is calm and steady.',
    accentColor: '#4a7c59',
    catState: 'calm',
  },
  alert: {
    mood: 'alert',
    statusLabel: 'Alert',
    supportingCopy: "Ronin noticed a few things waiting.",
    accessibilityLabel: 'Ronin is alert to unattended items.',
    accentColor: '#c17a2b',
    catState: 'alert',
  },
  tired: {
    mood: 'tired',
    statusLabel: 'Winding down',
    supportingCopy: 'Ronin could use some rest.',
    accessibilityLabel: 'Ronin is tired and winding down.',
    accentColor: '#5c6b8a',
    catState: 'asleep',
  },
  focused: {
    mood: 'focused',
    statusLabel: 'Focused',
    supportingCopy: 'Ronin is focused today.',
    accessibilityLabel: 'Ronin is in a focused state.',
    accentColor: '#2f6fa8',
    catState: 'watching',
  },
  overwhelmed: {
    mood: 'overwhelmed',
    statusLabel: 'A lot at once',
    supportingCopy: "There's a lot happening — Ronin could use a hand.",
    accessibilityLabel: 'Ronin is overwhelmed by unresolved items.',
    accentColor: '#a41e34',
    catState: 'concerned',
  },
  resolved: {
    mood: 'resolved',
    statusLabel: 'All clear',
    supportingCopy: "All clear. Moving forward.",
    accessibilityLabel: 'Ronin is glad things are resolved.',
    accentColor: '#34a853',
    catState: 'celebrating',
  },
};

export function getRoninMoodConfig(mood: RoninMood): RoninMoodConfig {
  return RONIN_MOOD_CONFIG[mood];
}
