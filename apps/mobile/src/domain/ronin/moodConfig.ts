import type { RoninMood, RoninMoodConfig } from './types';

// Accessibility text, accent color, and cat reaction all live here so
// components never hardcode per-mood values. Product-state feedback only —
// not a claim about the user's actual emotional or health state. Visible
// status copy is NOT here — it's computed alongside mood itself in
// roninMood.ts's getRoninStatus(), from the same real signals, so the two
// can never drift out of sync.
export const RONIN_MOOD_CONFIG: Record<RoninMood, RoninMoodConfig> = {
  normal: {
    mood: 'normal',
    statusLabel: 'Steady',
    accessibilityLabel: 'Ronin is calm and steady.',
    accentColor: '#9aa0aa',
    catState: 'calm',
  },
  alert: {
    mood: 'alert',
    statusLabel: 'Alert',
    accessibilityLabel: 'Ronin is alert to unattended items.',
    accentColor: '#d9a13f',
    catState: 'alert',
  },
  tired: {
    mood: 'tired',
    statusLabel: 'Winding down',
    accessibilityLabel: 'Ronin is tired and winding down.',
    accentColor: '#6b6fb0',
    catState: 'asleep',
  },
  focused: {
    mood: 'focused',
    statusLabel: 'Focused',
    accessibilityLabel: 'Ronin is in a focused state.',
    accentColor: '#3a8ff2',
    catState: 'watching',
  },
  overwhelmed: {
    mood: 'overwhelmed',
    statusLabel: 'A lot at once',
    accessibilityLabel: 'Ronin is overwhelmed by unresolved items.',
    accentColor: '#e2534a',
    catState: 'concerned',
  },
  resolved: {
    mood: 'resolved',
    statusLabel: 'All clear',
    accessibilityLabel: 'Ronin is glad things are resolved.',
    accentColor: '#3fbb63',
    catState: 'celebrating',
  },
};

export function getRoninMoodConfig(mood: RoninMood): RoninMoodConfig {
  return RONIN_MOOD_CONFIG[mood];
}
