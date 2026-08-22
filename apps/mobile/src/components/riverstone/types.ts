import type { ReactNode } from "react";
import type { StyleProp, ViewStyle } from "react-native";

export type RiverStoneVariant =
  | "header"
  | "hero"
  | "card"
  | "list"
  | "chip"
  | "tray";

export type RiverStoneThemeMode = "dark" | "light";
export type RiverStoneShape = "organic" | "regular" | "flush";

export interface RiverStoneSurfaceProps {
  children?: ReactNode;

  /**
   * A surface's own deliberate color — a tint gradient, scene photo, etc.
   * Renders UNDER the material's lighting layers (unlike `children`, which
   * renders above them at zIndex 10), so the stone's upper light/edge catch/
   * lower occlusion stay visible instead of being fully covered by an
   * opaque background.
   */
  background?: ReactNode;

  /**
   * Controls the material depth and proportions.
   *
   * Depth order:
   * chip < header < list < card < hero < tray
   */
  variant?: RiverStoneVariant;

  /**
   * Selects the dark graphite or warm pale-stone material.
   */
  mode?: RiverStoneThemeMode;

  /**
   * Organic keeps the carved, asymmetric Home silhouette. Regular uses an
   * even rounded rectangle. Flush removes the radius for immersive bands.
   */
  shape?: RiverStoneShape;

  /**
   * Styles applied to the outside wrapper.
   * Use this for dimensions, margins and positioning.
   */
  style?: StyleProp<ViewStyle>;

  /**
   * Styles applied to the content layer inside the material.
   * Use this for padding and content alignment.
   */
  contentStyle?: StyleProp<ViewStyle>;

  testID?: string;
  disabled?: boolean;

  /**
   * Whether the face fills its container (`flex: 1`) — the default, needed
   * by fixed-size surfaces (aspectRatio/minHeight cards, FlatList rows).
   * Set `false` for surfaces that must hug variable-length content instead
   * (e.g. chat bubbles): with a `flex: 1` face nested in an auto-height
   * ancestor inside a ScrollView, the surface expands to fill all leftover
   * scroll space rather than sizing to its content.
   */
  fill?: boolean;
}

export interface RiverStoneMaterialToken {
  base: string;
  upperAmbient: string;
  edgeCatch: string;
  lowerOcclusion: string;
  contactShadow: string;
  ambientShadow: string;

  borderRadius: number;

  upperLightOpacity: number;
  lowerOcclusionOpacity: number;
  edgeCatchOpacity: number;

  contactShadowOpacity: number;
  ambientShadowOpacity: number;

  contactShadowY: number;
  ambientShadowY: number;

  contactShadowBlur: number;
  ambientShadowBlur: number;
}
