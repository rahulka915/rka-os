import type { ImageSourcePropType } from 'react-native';
import type { RoninAssetKind, RoninCharacterState, RoninMood, RoninOutfit } from './types';

export interface RoninAsset {
  kind: RoninAssetKind;
  source: ImageSourcePropType;
  // Each source image already bundles the character + cat companion pair as
  // a single flattened illustration (see note below) — there is no separate
  // cat layer to composite yet.
  includesCompanion: true;
}

// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY PLACEHOLDER ASSETS — extracted from the approved 6-mood x
// 4-outfit reference matrix (character identity: warm complexion, visible
// face, black bandana, katana, Trishul+Om necklace, Rudraksha bracelet,
// tabby cat companion). Background chroma-keyed to transparent and
// auto-trimmed from the matrix sheet — NOT final production assets.
// Expect soft shadow artifacts and inconsistent framing; these exist only
// so the mood+outfit architecture has something real to render while
// individual high-res transparent assets (or Rive/Lottie files) are
// produced separately.
//
// This resolver is the single seam for that swap: once real per-mood/
// per-outfit assets land at assets/ronin/<outfit>/<mood>.png (replacing
// these files in place, or under a new path wired in here), no component
// using getRoninAsset() needs to change. The old single-mood shadow PNGs
// (assets/ronin/moods/) are retained for archival/compatibility only and
// are no longer referenced.
// ─────────────────────────────────────────────────────────────────────────

type OutfitAssetMap = Record<RoninMood, ImageSourcePropType>;

const MOOD_FILES: RoninMood[] = ['normal', 'alert', 'tired', 'focused', 'overwhelmed', 'resolved'];

const BASE_OUTFIT_ASSETS: OutfitAssetMap = {
  normal: require('../../../assets/ronin/base/normal.png'),
  alert: require('../../../assets/ronin/base/alert.png'),
  tired: require('../../../assets/ronin/base/tired.png'),
  focused: require('../../../assets/ronin/base/focused.png'),
  overwhelmed: require('../../../assets/ronin/base/overwhelmed.png'),
  resolved: require('../../../assets/ronin/base/resolved.png'),
};

const HAORI_OUTFIT_ASSETS: OutfitAssetMap = {
  normal: require('../../../assets/ronin/haori/normal.png'),
  alert: require('../../../assets/ronin/haori/alert.png'),
  tired: require('../../../assets/ronin/haori/tired.png'),
  focused: require('../../../assets/ronin/haori/focused.png'),
  overwhelmed: require('../../../assets/ronin/haori/overwhelmed.png'),
  resolved: require('../../../assets/ronin/haori/resolved.png'),
};

const TRAINING_OUTFIT_ASSETS: OutfitAssetMap = {
  normal: require('../../../assets/ronin/training/normal.png'),
  alert: require('../../../assets/ronin/training/alert.png'),
  tired: require('../../../assets/ronin/training/tired.png'),
  focused: require('../../../assets/ronin/training/focused.png'),
  overwhelmed: require('../../../assets/ronin/training/overwhelmed.png'),
  resolved: require('../../../assets/ronin/training/resolved.png'),
};

const JOURNEY_OUTFIT_ASSETS: OutfitAssetMap = {
  normal: require('../../../assets/ronin/journey/normal.png'),
  alert: require('../../../assets/ronin/journey/alert.png'),
  tired: require('../../../assets/ronin/journey/tired.png'),
  focused: require('../../../assets/ronin/journey/focused.png'),
  overwhelmed: require('../../../assets/ronin/journey/overwhelmed.png'),
  resolved: require('../../../assets/ronin/journey/resolved.png'),
};

const OUTFIT_ASSETS: Record<RoninOutfit, OutfitAssetMap> = {
  base: BASE_OUTFIT_ASSETS,
  haori: HAORI_OUTFIT_ASSETS,
  training: TRAINING_OUTFIT_ASSETS,
  journey: JOURNEY_OUTFIT_ASSETS,
};

export function getRoninAsset({ mood, outfit }: RoninCharacterState): RoninAsset {
  const outfitAssets = OUTFIT_ASSETS[outfit] ?? BASE_OUTFIT_ASSETS;
  const source = outfitAssets[mood] ?? BASE_OUTFIT_ASSETS.normal;
  return { kind: 'static', source, includesCompanion: true };
}

// Exposed for callers that need to enumerate valid moods (e.g. previews/tests).
export const RONIN_MOODS = MOOD_FILES;
