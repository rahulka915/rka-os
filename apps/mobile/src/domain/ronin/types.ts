// Ronin companion domain model. Mood and outfit are independent axes that
// resolve together to a character asset — see roninAssets.ts. This lets the
// system grow (seasonal outfits, unlocks, animation) without touching Home.

export type RoninMood = 'normal' | 'alert' | 'tired' | 'focused' | 'overwhelmed' | 'resolved';

export type RoninOutfit = 'base' | 'haori' | 'training' | 'journey';

// Cat companion reacts alongside Ronin. No cat asset exists yet — this is
// computed and threaded through the component tree so rendering it later
// (once an asset lands) doesn't require new plumbing.
export type RoninCatState = 'calm' | 'alert' | 'asleep' | 'watching' | 'concerned' | 'celebrating';

// 'static' is the plain PNG + crossfade path. 'model3d' is the animated GLB
// companion (see roninModel.ts / Ronin3D.tsx); 'static' remains the
// always-available fallback when 3D is disabled or unavailable.
export type RoninAssetKind = 'static' | 'model3d';

export interface RoninMoodConfig {
  mood: RoninMood;
  statusLabel: string;
  accessibilityLabel: string;
  // Single accent color for the Home hero card (RoninGreetingCard) — used
  // for the corner glow, mood dot, hanko seal tint, and progress-bar fill.
  // The card's base gradient is driven by time-of-day instead (see
  // roninScenes.ts getTimeOfDay), not mood, so this stays a small accent
  // rather than a full background color.
  accentColor: string;
  catState: RoninCatState;
}

export interface RoninCharacterState {
  mood: RoninMood;
  outfit: RoninOutfit;
}

// Environment/background layer — independent of mood and outfit. See
// roninScenes.ts for the time-of-day → scene asset resolver.
export type RoninTimeOfDay = 'morning' | 'day' | 'night';
