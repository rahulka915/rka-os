import type {
  RiverStoneMaterialToken,
  RiverStoneThemeMode,
  RiverStoneVariant,
} from "./types";

/*
|--------------------------------------------------------------------------
| Base Material Palettes
|--------------------------------------------------------------------------
|
| These represent the physical material itself.
| They should almost never change.
|
*/

const darkPalette = {
  base: "#181B21",

  upperAmbient: "rgba(230,236,244,0.18)",

  edgeCatch: "rgba(255,255,255,0.18)",

  lowerOcclusion: "rgba(0,0,0,0.42)",

  contactShadow: "rgba(0,0,0,0.50)",

  ambientShadow: "rgba(0,0,0,0.30)",
};

const lightPalette = {
  base: "#E3DDD0",

  upperAmbient: "rgba(255,255,255,0.42)",

  edgeCatch: "rgba(255,255,255,0.30)",

  lowerOcclusion: "rgba(112,103,92,0.10)",

  contactShadow: "rgba(65,58,48,0.14)",

  ambientShadow: "rgba(65,58,48,0.08)",
};

/*
|--------------------------------------------------------------------------
| Depth Hierarchy
|--------------------------------------------------------------------------
|
| The ONLY thing variants should change is:
|
| - depth
| - shadow
| - radius
| - material strength
|
| Never colour.
|
*/

const variants: Record<
  RiverStoneVariant,
  Omit<
    RiverStoneMaterialToken,
    | "base"
    | "upperAmbient"
    | "edgeCatch"
    | "lowerOcclusion"
    | "contactShadow"
    | "ambientShadow"
  >
> = {
  chip: {
    borderRadius: 16,

    upperLightOpacity: 0.16,
    lowerOcclusionOpacity: 0.10,
    edgeCatchOpacity: 0.03,

    contactShadowOpacity: 0.08,
    ambientShadowOpacity: 0.03,

    contactShadowY: 1,
    ambientShadowY: 2,

    contactShadowBlur: 2,
    ambientShadowBlur: 5,
  },

  header: {
    borderRadius: 24,

    upperLightOpacity: 0.18,
    lowerOcclusionOpacity: 0.12,
    edgeCatchOpacity: 0.04,

    contactShadowOpacity: 0.10,
    ambientShadowOpacity: 0.05,

    contactShadowY: 1,
    ambientShadowY: 3,

    contactShadowBlur: 3,
    ambientShadowBlur: 8,
  },

  list: {
    borderRadius: 20,

    upperLightOpacity: 0.24,
    lowerOcclusionOpacity: 0.28,
    edgeCatchOpacity: 0,

    contactShadowOpacity: 0.44,
    ambientShadowOpacity: 0.30,

    contactShadowY: 6,
    ambientShadowY: 14,

    contactShadowBlur: 11,
    ambientShadowBlur: 34,
  },

  card: {
    borderRadius: 28,

    upperLightOpacity: 0.28,
    lowerOcclusionOpacity: 0.24,
    edgeCatchOpacity: 0,

    contactShadowOpacity: 0.50,
    ambientShadowOpacity: 0.36,

    contactShadowY: 8,
    ambientShadowY: 20,

    contactShadowBlur: 14,
    ambientShadowBlur: 44,
  },

  hero: {
    borderRadius: 34,

    upperLightOpacity: 0.34,
    lowerOcclusionOpacity: 0.30,
    edgeCatchOpacity: 0.05,

    contactShadowOpacity: 0.30,
    ambientShadowOpacity: 0.20,

    contactShadowY: 5,
    ambientShadowY: 13,

    contactShadowBlur: 7,
    ambientShadowBlur: 28,
  },

  tray: {
    borderRadius: 38,

    upperLightOpacity: 0.32,
    lowerOcclusionOpacity: 0.34,
    edgeCatchOpacity: 0.045,

    contactShadowOpacity: 0.34,
    ambientShadowOpacity: 0.24,

    contactShadowY: 6,
    ambientShadowY: 15,

    contactShadowBlur: 8,
    ambientShadowBlur: 32,
  },
};

const SHADOW_BOOST = 1;

export function getRiverStoneToken(
  variant: RiverStoneVariant,
  mode: RiverStoneThemeMode,
): RiverStoneMaterialToken {
  const palette = mode === "dark"
    ? darkPalette
    : lightPalette;

  const variantToken = variants[variant];

  return {
    ...palette,
    ...variantToken,
    contactShadowOpacity: Math.min(0.9, variantToken.contactShadowOpacity * SHADOW_BOOST),
    ambientShadowOpacity: Math.min(0.9, variantToken.ambientShadowOpacity * SHADOW_BOOST),
  };
}
