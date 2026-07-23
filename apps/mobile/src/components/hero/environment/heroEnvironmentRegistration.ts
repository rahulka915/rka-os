import registrationData from './heroEnvironmentRegistration.json';

export const HERO_SCENE_WIDTH = 1536;
export const HERO_SCENE_HEIGHT = 864;
export const HERO_HORIZON_Y = registrationData.scene.horizonY;

export type HeroLayerGroup =
  | 'sky'
  | 'distantLandscape'
  | 'waterAndShorelines'
  | 'architecture'
  | 'garden'
  | 'characterSpace'
  | 'functionalObjects'
  | 'atmosphere'
  | 'weatherAndParticles';

export type HeroLayerId = keyof typeof registrationData.layers;

export interface HeroLayerRegistration {
  group: HeroLayerGroup;
  x: number;
  y: number;
  scale: number;
  opacity?: number;
  rotation?: number;
  anchorX?: number;
  anchorY?: number;
  parallax?: number;
}

export interface HeroViewportRegistration {
  sceneWidth: number;
  sceneHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  sceneOffsetX: number;
  sceneOffsetY: number;
  sceneScale: number;
}

export const HERO_LAYER_ORDER: HeroLayerId[] = [
  'hero_clouds',
  'hero_fuji',
  'hero_hills',
  'hero_far_shoreline',
  'hero_lake',
  'hero_near_shoreline',
  'hero_veranda',
  'hero_floor',
  'hero_roof',
  'hero_pillar',
  'hero_steps',
  'hero_moss',
  'hero_rocks',
  'hero_lantern',
  'hero_bonsai',
  'hero_meditation_cushion',
  'hero_training_post',
  'hero_sword_stand',
  'hero_inbox_tray_empty',
  'hero_inbox_tray_partial',
  'hero_inbox_tray_full',
  'hero_scroll',
  'hero_scroll_open',
  'hero_morning_mist',
  'hero_evening_haze',
  'hero_rain',
  'hero_snow',
  'hero_fireflies',
  'hero_falling_petals',
];

export const HERO_LAYER_GROUPS: Record<HeroLayerGroup, HeroLayerId[]> = HERO_LAYER_ORDER.reduce(
  (groups, id) => {
    groups[registrationData.layers[id].group as HeroLayerGroup].push(id);
    return groups;
  },
  {
    sky: [],
    distantLandscape: [],
    waterAndShorelines: [],
    architecture: [],
    garden: [],
    characterSpace: [],
    functionalObjects: [],
    atmosphere: [],
    weatherAndParticles: [],
  } as Record<HeroLayerGroup, HeroLayerId[]>
);

export const HERO_LAYER_REGISTRATION = registrationData.layers as Record<
  HeroLayerId,
  HeroLayerRegistration
>;

export const HERO_REGISTRATION_GUIDES = registrationData.guides;
export const HERO_MASTER_VIEWPORT = registrationData.viewport;

export function resolveHeroViewport(
  viewportWidth = HERO_MASTER_VIEWPORT.referenceWidth,
  viewportHeight = HERO_MASTER_VIEWPORT.referenceHeight
): HeroViewportRegistration {
  const sceneScale = viewportWidth / HERO_SCENE_WIDTH;
  return {
    sceneWidth: HERO_SCENE_WIDTH,
    sceneHeight: HERO_SCENE_HEIGHT,
    viewportWidth,
    viewportHeight,
    sceneOffsetX: -HERO_MASTER_VIEWPORT.crop.x * sceneScale,
    sceneOffsetY: -HERO_MASTER_VIEWPORT.crop.y * sceneScale,
    sceneScale,
  };
}

export function mergeHeroRegistration(
  overrides?: Partial<Record<HeroLayerId, Partial<HeroLayerRegistration>>>
): Record<HeroLayerId, HeroLayerRegistration> {
  if (!overrides) return HERO_LAYER_REGISTRATION;
  return Object.fromEntries(
    HERO_LAYER_ORDER.map((id) => [
      id,
      { ...HERO_LAYER_REGISTRATION[id], ...overrides[id] },
    ])
  ) as Record<HeroLayerId, HeroLayerRegistration>;
}
