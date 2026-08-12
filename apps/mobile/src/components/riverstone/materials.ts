import type { ViewStyle } from "react-native";

import { getRiverStoneToken } from "./riverStoneTokens";
import type {
  RiverStoneMaterialToken,
  RiverStoneShape,
  RiverStoneThemeMode,
  RiverStoneVariant,
} from "./types";

export interface RiverStoneLayers {
  container: ViewStyle;
  ambientShadow: ViewStyle;
  contactShadow: ViewStyle;
  face: ViewStyle;
  upperAmbientPrimary: ViewStyle;
  upperAmbientSecondary: ViewStyle;
  lowerOcclusion: ViewStyle;
  lowerCornerOcclusionLeft: ViewStyle;
  lowerCornerOcclusionRight: ViewStyle;
  edgeCatchPrimary: ViewStyle;
  edgeCatchSecondary: ViewStyle;
  content: ViewStyle;
}

/**
 * Converts the River Stone material tokens into reusable React Native layers.
 *
 * Material stack:
 *
 * 1. Ambient shadow
 * 2. Tight contact shadow
 * 3. Matte base face
 * 4. Broad upper ambient lighting
 * 5. Lower-edge and corner occlusion
 * 6. Restricted upper-left edge catches
 * 7. Content
 *
 * This intentionally avoids:
 *
 * - a full silver outline
 * - a hard horizontal tonal split
 * - strong full-height gradients
 * - glossy reflections
 * - texture or grain
 */
export function createRiverStoneLayers(
  variant: RiverStoneVariant,
  mode: RiverStoneThemeMode,
  shape: RiverStoneShape = "organic",
): RiverStoneLayers {
  const token = getRiverStoneToken(variant, mode);

  return {
    container: createContainerLayer(token, shape),

    ambientShadow: createAmbientShadowLayer(token, shape),

    contactShadow: createContactShadowLayer(token),

    face: createFaceLayer(token, shape),

    upperAmbientPrimary: createUpperAmbientPrimaryLayer(token),

    upperAmbientSecondary: createUpperAmbientSecondaryLayer(token),

    lowerOcclusion: createLowerOcclusionLayer(token),

    lowerCornerOcclusionLeft: createLowerCornerOcclusionLayer(
      token,
      "left",
    ),

    lowerCornerOcclusionRight: createLowerCornerOcclusionLayer(
      token,
      "right",
    ),

    edgeCatchPrimary: createEdgeCatchPrimaryLayer(token),

    edgeCatchSecondary: createEdgeCatchSecondaryLayer(token),

    content: createContentLayer(),
  };
}

/*
|--------------------------------------------------------------------------
| Container
|--------------------------------------------------------------------------
*/

// River stones aren't machine-symmetric — every corner here uses a slightly
// different radius (opposite corners share a value, adjacent ones don't) so
// the silhouette reads as a carved, faintly organic shape instead of a
// uniform rounded rectangle. Matches the "subtle asymmetry" called out in
// the reference mockup's design philosophy.
function asymmetricCorners(radius: number): ViewStyle {
  return {
    borderTopLeftRadius: radius,
    borderBottomRightRadius: radius,
    borderTopRightRadius: radius * 0.5,
    borderBottomLeftRadius: radius * 0.62,
  };
}

function surfaceCorners(radius: number, shape: RiverStoneShape): ViewStyle {
  if (shape === "flush") return { borderRadius: 0 };
  return shape === "regular" ? { borderRadius: radius } : asymmetricCorners(radius);
}

function createContainerLayer(
  token: RiverStoneMaterialToken,
  shape: RiverStoneShape,
): ViewStyle {
  return {
    position: "relative",
    overflow: "visible",
    ...surfaceCorners(token.borderRadius, shape),
  };
}

/*
|--------------------------------------------------------------------------
| Shadows
|--------------------------------------------------------------------------
*/

function createAmbientShadowLayer(
  token: RiverStoneMaterialToken,
  shape: RiverStoneShape,
): ViewStyle {
  return {
    position: "absolute",

    left: 2,
    right: -2,
    top: token.ambientShadowY * 0.7,
    bottom: -token.ambientShadowY * 1.25,

    ...surfaceCorners(token.borderRadius, shape),

    backgroundColor: token.ambientShadow,
    opacity: token.ambientShadowOpacity,
    shadowColor: token.ambientShadow,
    shadowOffset: { width: 0, height: token.ambientShadowY * 0.45 },
    shadowOpacity: token.ambientShadowOpacity,
    shadowRadius: token.ambientShadowBlur,
    elevation: 8,

    transform: [
      { scaleX: 0.99 },
      { scaleY: 1.02 },
    ],
  };
}

function createContactShadowLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  const contactHeight = Math.max(
    3,
    token.contactShadowBlur,
  );

  return {
    position: "absolute",

    left: 12,
    right: 8,
    bottom: -token.contactShadowY * 1.15,

    height: contactHeight,

    borderRadius: contactHeight,

    backgroundColor: token.contactShadow,
    opacity: token.contactShadowOpacity,
    shadowColor: token.contactShadow,
    shadowOffset: { width: 0, height: Math.max(1, token.contactShadowY * 0.5) },
    shadowOpacity: token.contactShadowOpacity,
    shadowRadius: token.contactShadowBlur,
    elevation: 4,

    transform: [
      { scaleX: 1.02 },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| Base Face
|--------------------------------------------------------------------------
*/

function createFaceLayer(
  token: RiverStoneMaterialToken,
  shape: RiverStoneShape,
): ViewStyle {
  return {
    position: "relative",
    // Needed so the face actually fills a container sized via aspectRatio
    // or minHeight (e.g. the square Home cards) — without this, `face` was
    // the only non-absolute flow child of `container` but had no size of
    // its own, so it shrank to its content instead of filling the shape.
    flex: 1,

    overflow: "hidden",

    ...surfaceCorners(token.borderRadius, shape),

    backgroundColor: token.base,
  };
}

/*
|--------------------------------------------------------------------------
| Upper Ambient Light
|--------------------------------------------------------------------------
|
| Two overlapping soft shapes create a broad, curved light field.
|
| Neither shape spans the entire height of the surface, preventing
| a visible horizontal split.
|
*/

function createUpperAmbientPrimaryLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  return {
    position: "absolute",

    // Extends past BOTH sides (not just the left) and well above the top —
    // its own rounded-rect silhouette must always fall outside the clipped
    // face, otherwise that silhouette's edge shows up as a visible boundary
    // no matter how soft the top-to-bottom gradient fade is (a linear
    // gradient only softens vertically, not around the shape's own sides).
    left: "-42%",
    right: "-42%",
    top: "-58%",

    // Deeper + level (no rotate/skew) so the fade reads as a broad, evenly
    // diffused glow — a tilted, sharper-falloff band was reading as a
    // glossy streak rather than felt light.
    height: "126%",

    borderRadius: token.borderRadius * 1.6,

    backgroundColor: token.upperAmbient,
    opacity: token.upperLightOpacity,

    transform: [
      { scaleX: 1.1 },
    ],
  };
}

function createUpperAmbientSecondaryLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  return {
    position: "absolute",

    left: "-34%",
    right: "-18%",
    top: "-40%",

    height: "92%",

    borderRadius: token.borderRadius * 1.4,

    backgroundColor: token.upperAmbient,
    opacity: token.upperLightOpacity * 0.5,

    transform: [
      { scaleX: 1.06 },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| Lower Weight and Corner Occlusion
|--------------------------------------------------------------------------
|
| These layers only affect the lower region and corners.
|
| They must never form a complete border around the surface.
|
*/

function createLowerOcclusionLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  return {
    position: "absolute",

    left: "-28%",
    right: "-28%",
    bottom: "-36%",

    height: "64%",

    borderRadius: token.borderRadius * 1.25,

    backgroundColor: token.lowerOcclusion,
    opacity: token.lowerOcclusionOpacity,

    transform: [
      { scaleX: 1.04 },
    ],
  };
}

function createLowerCornerOcclusionLayer(
  token: RiverStoneMaterialToken,
  side: "left" | "right",
): ViewStyle {
  return {
    position: "absolute",

    [side]: "-28%",
    bottom: "-30%",

    width: "58%",
    height: "70%",

    borderRadius: token.borderRadius * 1.4,

    backgroundColor: token.lowerOcclusion,
    opacity: token.lowerOcclusionOpacity * 0.45,
  };
}

/*
|--------------------------------------------------------------------------
| Edge Catch
|--------------------------------------------------------------------------
|
| These are intentionally short and discontinuous.
|
| They are not borders.
|
*/

function createEdgeCatchPrimaryLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  return {
    position: "absolute",

    left: 10,
    right: "34%",
    top: 5,

    height: 1.25,

    borderRadius: 999,

    backgroundColor: token.edgeCatch,
    opacity: token.edgeCatchOpacity,

    transform: [
      { rotate: "-0.7deg" },
    ],
  };
}

function createEdgeCatchSecondaryLayer(
  token: RiverStoneMaterialToken,
): ViewStyle {
  return {
    position: "absolute",

    left: 18,
    width: "20%",
    top: 8,

    height: 1,

    borderRadius: 999,

    backgroundColor: token.edgeCatch,
    opacity: token.edgeCatchOpacity * 0.55,

    transform: [
      { rotate: "-1.2deg" },
    ],
  };
}

/*
|--------------------------------------------------------------------------
| Content
|--------------------------------------------------------------------------
*/

function createContentLayer(): ViewStyle {
  return {
    position: "relative",
    zIndex: 10,
  };
}
