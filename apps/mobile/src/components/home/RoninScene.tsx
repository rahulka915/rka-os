import { Image, type ImageStyle } from 'react-native';
import type { RoninTimeOfDay } from '../../domain/ronin/types';
import { getRoninSceneAsset } from '../../domain/ronin/roninScenes';

interface RoninSceneProps {
  timeOfDay: RoninTimeOfDay;
  style?: ImageStyle;
}

// Environment layer — resolves timeOfDay to a background scene asset via
// getRoninSceneAsset(). Pure background image; the caller (RoninHero) stacks
// its own content (greeting, character, status) on top of this as siblings.
// Swap the asset source (real image today, later maybe an animated/parallax
// layer) without touching RoninHero or RoninCharacter.
export function RoninScene({ timeOfDay, style }: RoninSceneProps) {
  return <Image source={getRoninSceneAsset(timeOfDay)} resizeMode="cover" style={style} />;
}
