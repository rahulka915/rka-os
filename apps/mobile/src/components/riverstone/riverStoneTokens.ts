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
  base: "#171A20",

  upperAmbient: "rgba(225,230,238,0.16)",

  edgeCatch: "rgba(255,255,255,0.16)",

  lowerOcclusion: "rgba(0,0,0,0.34)",

  contactShadow: "rgba(0,0,0,0.42)",

  ambientShadow: "rgba(0,0,0,0.22)",
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
    borderRadius: 18,

    upperLightOpacity: 0.20,
    lowerOcclusionOpacity: 0.22,
    edgeCatchOpacity: 0.05,

    contactShadowOpacity: 0.14,
    ambientShadowOpacity: 0.07,

    contactShadowY: 2,
    ambientShadowY: 5,

    contactShadowBlur: 4,
    ambientShadowBlur: 11,
  },

  card: {
    borderRadius: 26,

    upperLightOpacity: 0.22,
    lowerOcclusionOpacity: 0.18,
    edgeCatchOpacity: 0.05,

    contactShadowOpacity: 0.18,
    ambientShadowOpacity: 0.10,

    contactShadowY: 3,
    ambientShadowY: 7,

    contactShadowBlur: 5,
    ambientShadowBlur: 15,
  },

  hero: {
    borderRadius: 34,

    upperLightOpacity: 0.30,
    lowerOcclusionOpacity: 0.24,
    edgeCatchOpacity: 0.07,

    contactShadowOpacity: 0.22,
    ambientShadowOpacity: 0.13,

    contactShadowY: 4,
    ambientShadowY: 9,

    contactShadowBlur: 6,
    ambientShadowBlur: 20,
  },

  tray: {
    borderRadius: 38,

    upperLightOpacity: 0.28,
    lowerOcclusionOpacity: 0.28,
    edgeCatchOpacity: 0.06,

    contactShadowOpacity: 0.25,
    ambientShadowOpacity: 0.16,

    contactShadowY: 5,
    ambientShadowY: 11,

    contactShadowBlur: 7,
    ambientShadowBlur: 24,
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
