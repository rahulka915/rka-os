// Ronin companion domain model. Mood and outfit are independent axes used by
// the journey walker and status logic.

export type RoninMood = 'normal' | 'alert' | 'tired' | 'focused' | 'overwhelmed' | 'resolved';

export type RoninOutfit = 'base' | 'haori' | 'training' | 'journey';

// Cat companion reacts alongside Ronin. No cat asset exists yet — this is
// computed and threaded through the component tree so rendering it later
// (once an asset lands) doesn't require new plumbing.
export type RoninCatState = 'calm' | 'alert' | 'asleep' | 'watching' | 'concerned' | 'celebrating';

// Environment/background layer — independent of mood and outfit. See
// roninScenes.ts for the time-of-day → scene asset resolver.
export type RoninTimeOfDay = 'morning' | 'day' | 'night';
