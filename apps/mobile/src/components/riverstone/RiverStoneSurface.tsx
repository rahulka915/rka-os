import React, { memo, useMemo } from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { LinearGradient } from "expo-linear-gradient";

import { createRiverStoneLayers } from "./materials";
import { getRiverStoneToken } from "./riverStoneTokens";
import type { RiverStoneSurfaceProps } from "./types";

const TRANSPARENT = "rgba(0,0,0,0)";

// TEMP perf experiment — flip to true to render every RiverStoneSurface as a
// single flat View (its face color only, no gradient/shadow layers) instead of
// the full ~7-layer material. Used to A/B whether the material's native render
// cost is the app-wide cold-start/interaction lag. Revert once measured.
const RIVERSTONE_FLAT_EXPERIMENT = false;

// Strips backgroundColor AND opacity out of a layer style so it can be
// handed to LinearGradient's `style` prop: backgroundColor would paint a
// solid box underneath the gradient (the original hard-edged "sticker"
// bug), and opacity would silently double up with the alpha we already
// bake into the gradient's own color stops below.
function stripToPositionOnly(style: ViewStyle): ViewStyle {
  const { backgroundColor: _backgroundColor, opacity: _opacity, ...rest } = style;
  return rest;
}

// Gradient light needs a small compensation for its transparent falloff,
// but it must stay below the bright metallic range. The material reference
// is matte charcoal stone with localized light, not a silver highlight.
function withAlpha(rgba: string, alpha: number): string {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((part) => part.trim());
  const [r, g, b] = parts;
  const clamped = Math.min(1, Math.max(0, alpha));
  return `rgba(${r},${g},${b},${clamped})`;
}

function scaleAlpha(rgba: string, multiplier: number): string {
  const match = rgba.match(/rgba?\(([^)]+)\)/);
  if (!match) return rgba;
  const parts = match[1].split(",").map((part) => part.trim());
  const baseAlpha = parts[3] ? parseFloat(parts[3]) : 1;
  return withAlpha(rgba, baseAlpha * multiplier);
}

const MATERIAL_LIGHT_BOOST = 3;

function glowColors(base: string, opacityMultiplier: number, alphaBoost = MATERIAL_LIGHT_BOOST, midFraction = 0.65): [string, string, string] {
  const baseAlphaMatch = base.match(/rgba?\([^)]*,\s*([0-9.]+)\s*\)/);
  const baseAlpha = baseAlphaMatch ? parseFloat(baseAlphaMatch[1]) : 1;
  const peak = baseAlpha * opacityMultiplier * alphaBoost;

  return [withAlpha(base, peak), withAlpha(base, peak * midFraction), TRANSPARENT];
}

function RiverStoneSurfaceComponent({
  children,
  background,
  variant = "card",
  mode = "dark",
  shape = "organic",
  style,
  contentStyle,
  testID,
  disabled = false,
}: RiverStoneSurfaceProps) {
  const layers = useMemo(
    () => createRiverStoneLayers(variant, mode, shape),
    [variant, mode, shape],
  );
  const token = useMemo(
    () => getRiverStoneToken(variant, mode),
    [variant, mode],
  );
  if (RIVERSTONE_FLAT_EXPERIMENT) {
    return (
      <View
        testID={testID}
        pointerEvents={disabled ? "none" : "auto"}
        style={[layers.container, style]}
      >
        <View style={layers.face}>
          {background}
          <View style={[layers.content, contentStyle]}>{children}</View>
        </View>
      </View>
    );
  }

  const isChip = variant === "chip";
  const isEverydayStone = variant === "list" || variant === "card";
  const isFlush = shape === "flush";
  const insetShadowColor = mode === "dark" ? "0,0,0" : "60,50,30";
  // The hero card carries its own opaque time-of-day tint as `background`
  // (a much darker/higher-contrast surface than the other variants' plain
  // graphite base) — the material needs extra peak alpha here just to cut
  // through it and stay visible, or it reads as flat next to the small
  // cards next to it.
  const heroBoost = variant === "hero" ? 1.35 : 1;

  return (
    <View
      testID={testID}
      pointerEvents={disabled ? "none" : "auto"}
      style={[layers.container, style]}
    >
      {/* Large, soft ambient shadow */}
      {!isFlush ? (
        <View
          pointerEvents="none"
          style={layers.ambientShadow}
        />
      ) : null}

      {/* Tight shadow directly beneath the surface */}
      {!isFlush ? (
        <View
          pointerEvents="none"
          style={layers.contactShadow}
        />
      ) : null}

      {/* Physical face of the River Stone surface */}
      <View style={layers.face}>
        {/* A surface's own deliberate color (tint gradient, scene photo)
            renders here, UNDER the material lighting below, so the stone's
            highlight/occlusion stay visible instead of being fully covered
            by an opaque background. */}
        {background}

        {/* Chips are inset (pressed into their row), not raised — skip the
            upper light/edge catch and use an inner top shadow + hairline
            boundary instead. Every other variant gets the raised
            upper-light treatment. */}
        {isChip ? (
          <>
            <LinearGradient
              pointerEvents="none"
              colors={[`rgba(${insetShadowColor},${mode === "dark" ? 0.48 : 0.26})`, TRANSPARENT]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={styles.chipInsetTop}
            />
            <View
              pointerEvents="none"
              style={[
                StyleSheet.absoluteFill,
                styles.chipBoundary,
                {
                  borderRadius: layers.face.borderRadius,
                  borderTopLeftRadius: layers.face.borderTopLeftRadius,
                  borderTopRightRadius: layers.face.borderTopRightRadius,
                  borderBottomLeftRadius: layers.face.borderBottomLeftRadius,
                  borderBottomRightRadius: layers.face.borderBottomRightRadius,
                  borderColor: `rgba(${insetShadowColor},${mode === "dark" ? 0.5 : 0.28})`,
                },
              ]}
            />
          </>
        ) : isEverydayStone ? (
          null
        ) : (
          <>
            {/* Continuous face illumination. This spans the whole clipped
                face; everyday stone must read as one volume, not a bright
                upper slab sitting on a darker lower slab. */}
            <LinearGradient
              pointerEvents="none"
              colors={[
                scaleAlpha(token.upperAmbient, token.upperLightOpacity * MATERIAL_LIGHT_BOOST * heroBoost * 0.86),
                scaleAlpha(token.upperAmbient, token.upperLightOpacity * MATERIAL_LIGHT_BOOST * heroBoost * 0.50),
                scaleAlpha(token.upperAmbient, token.upperLightOpacity * MATERIAL_LIGHT_BOOST * heroBoost * 0.18),
                TRANSPARENT,
              ] as [string, string, string, string]}
              locations={[0, 0.28, 0.68, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 0, y: 1 }}
              style={StyleSheet.absoluteFill}
            />

            {/* Restrained, discontinuous polished edge catches — fade out
                along their length instead of stopping abruptly. */}
            <LinearGradient
              pointerEvents="none"
              colors={glowColors(token.edgeCatch, token.edgeCatchOpacity, MATERIAL_LIGHT_BOOST * heroBoost)}
              locations={[0, 0.4, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={stripToPositionOnly(layers.edgeCatchPrimary)}
            />

            <LinearGradient
              pointerEvents="none"
              colors={glowColors(token.edgeCatch, token.edgeCatchOpacity * 0.55, MATERIAL_LIGHT_BOOST * heroBoost)}
              locations={[0, 0.4, 1]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={stripToPositionOnly(layers.edgeCatchSecondary)}
            />
          </>
        )}

        {!isEverydayStone ? (
          <LinearGradient
            pointerEvents="none"
            colors={[
              TRANSPARENT,
              scaleAlpha(token.lowerOcclusion, token.lowerOcclusionOpacity * 0.22),
              scaleAlpha(token.lowerOcclusion, token.lowerOcclusionOpacity * 0.62),
              scaleAlpha(token.lowerOcclusion, token.lowerOcclusionOpacity),
            ] as [string, string, string, string]}
            locations={[0, 0.48, 0.82, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={StyleSheet.absoluteFill}
          />
        ) : null}

        {!isChip && !isFlush ? (
          <View
            pointerEvents="none"
            style={[
              StyleSheet.absoluteFill,
              styles.surfaceBoundary,
              {
                borderRadius: layers.face.borderRadius,
                borderTopLeftRadius: layers.face.borderTopLeftRadius,
                borderTopRightRadius: layers.face.borderTopRightRadius,
                borderBottomLeftRadius: layers.face.borderBottomLeftRadius,
                borderBottomRightRadius: layers.face.borderBottomRightRadius,
                borderColor: mode === "dark" ? "rgba(255,255,255,0.055)" : "rgba(60,50,35,0.13)",
              },
            ]}
          />
        ) : null}

        {/* Application content */}
        <View style={[layers.content, contentStyle]}>
          {children}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chipInsetTop: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    height: 10,
  },
  chipBoundary: {
    borderWidth: 1,
  },
  surfaceBoundary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});

export const RiverStoneSurface = memo(
  RiverStoneSurfaceComponent,
);
