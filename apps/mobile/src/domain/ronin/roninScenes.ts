import type { ImageSourcePropType } from 'react-native';
import type { RoninTimeOfDay } from './types';

// ─────────────────────────────────────────────────────────────────────────
// TEMPORARY PLACEHOLDER SCENE ART — cropped from a 3-panel (morning/day/
// night) reference illustration, same composition (mountain, lake, tree,
// shrine, lantern) lit differently per time of day. Not final production
// assets, but real painted scenery rather than a structural stand-in.
//
// This resolver is the seam for future environment work (seasonal scenes,
// weather, animated background layer) — only this file changes; RoninScene
// just asks for getRoninSceneAsset(timeOfDay).
// ─────────────────────────────────────────────────────────────────────────

const SCENE_ASSETS: Record<RoninTimeOfDay, ImageSourcePropType> = {
  morning: require('../../../assets/ronin/scenes/morning.png'),
  day: require('../../../assets/ronin/scenes/day.png'),
  night: require('../../../assets/ronin/scenes/night.png'),
};

export function getRoninSceneAsset(timeOfDay: RoninTimeOfDay): ImageSourcePropType {
  return SCENE_ASSETS[timeOfDay] ?? SCENE_ASSETS.day;
}

export function getTimeOfDay(hour: number): RoninTimeOfDay {
  if (hour < 6) return 'night';
  if (hour < 11) return 'morning';
  if (hour < 18) return 'day';
  return 'night';
}
