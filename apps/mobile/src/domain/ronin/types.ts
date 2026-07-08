// Ronin companion domain model. Mood and outfit are independent axes that
// resolve together to a character asset — see roninAssets.ts. This lets the
// system grow (seasonal outfits, unlocks, animation) without touching Home.

export type RoninMood = 'normal' | 'alert' | 'tired' | 'focused' | 'overwhelmed' | 'resolved';

export type RoninOutfit = 'base' | 'haori' | 'training' | 'journey';

// Cat companion reacts alongside Ronin. No cat asset exists yet — this is
// computed and threaded through the component tree so rendering it later
// (once an asset lands) doesn't require new plumbing.
export type RoninCatState = 'calm' | 'alert' | 'asleep' | 'watching' | 'concerned' | 'celebrating';

// 'static' is the only kind implemented today (plain PNG + crossfade).
// Reserved for when individual production assets move to Rive/Lottie/sprite.
export type RoninAssetKind = 'static';

export interface RoninMoodConfig {
  mood: RoninMood;
  statusLabel: string;
  supportingCopy: string;
  accessibilityLabel: string;
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
