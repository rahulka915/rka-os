import React from "react";
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { RiverStoneSurface } from "./RiverStoneSurface";
import type {
  RiverStoneThemeMode,
  RiverStoneVariant,
} from "./types";

const variants: RiverStoneVariant[] = [
  "header",
  "hero",
  "card",
  "list",
  "chip",
  "tray",
];

interface VariantPreviewProps {
  variant: RiverStoneVariant;
  mode: RiverStoneThemeMode;
}

function VariantPreview({
  variant,
  mode,
}: VariantPreviewProps) {
  return (
    <View style={styles.previewSection}>
      <Text
        style={[
          styles.variantTitle,
          mode === "light" && styles.darkText,
        ]}
      >
        {variant}
      </Text>

      <RiverStoneSurface
        variant={variant}
        mode={mode}
        style={[
          styles.surface,
          variant === "header" && styles.headerSurface,
          variant === "hero" && styles.heroSurface,
          variant === "card" && styles.cardSurface,
          variant === "list" && styles.listSurface,
          variant === "chip" && styles.chipSurface,
          variant === "tray" && styles.traySurface,
        ]}
        contentStyle={[
          styles.content,
          variant === "chip" && styles.chipContent,
        ]}
      >
        <Text
          style={[
            styles.surfaceLabel,
            mode === "light" && styles.darkText,
          ]}
        >
          {variant}
        </Text>

        {variant !== "chip" && (
          <Text
            style={[
              styles.surfaceDescription,
              mode === "light" && styles.darkSecondaryText,
            ]}
          >
            River Stone material preview
          </Text>
        )}
      </RiverStoneSurface>
    </View>
  );
}

export function RiverStoneDemoScreen() {
  return (
    <ScrollView
      contentContainerStyle={styles.page}
      showsVerticalScrollIndicator={false}
    >
      <Text style={styles.pageTitle}>
        RKA OS River Stone
      </Text>

      <Text style={styles.pageSubtitle}>
        Dark material variants
      </Text>

      {variants.map((variant) => (
        <VariantPreview
          key={`dark-${variant}`}
          variant={variant}
          mode="dark"
        />
      ))}

      <View style={styles.lightSection}>
        <Text style={[styles.pageSubtitle, styles.darkText]}>
          Light material variants
        </Text>

        {variants.map((variant) => (
          <VariantPreview
            key={`light-${variant}`}
            variant={variant}
            mode="light"
          />
        ))}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingTop: 56,
    paddingHorizontal: 24,
    paddingBottom: 80,
    gap: 20,
    backgroundColor: "#05070B",
  },

  pageTitle: {
    color: "#F5F7FA",
    fontSize: 28,
    lineHeight: 34,
    fontFamily: 'Inter_700Bold',
    fontWeight: "700",
  },

  pageSubtitle: {
    color: "#AEB6C4",
    fontSize: 14,
    lineHeight: 20,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: "600",
    marginTop: 8,
  },

  previewSection: {
    gap: 8,
  },

  variantTitle: {
    color: "#C8CFDA",
    fontSize: 12,
    lineHeight: 16,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.8,
  },

  surface: {
    width: "100%",
  },

  headerSurface: {
    minHeight: 68,
  },

  heroSurface: {
    minHeight: 220,
  },

  cardSurface: {
    minHeight: 160,
  },

  listSurface: {
    minHeight: 64,
  },

  chipSurface: {
    minHeight: 36,
    minWidth: 128,
    alignSelf: "flex-start",
  },

  traySurface: {
    minHeight: 96,
  },

  content: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
  },

  chipContent: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },

  surfaceLabel: {
    color: "#F2F4F7",
    fontSize: 16,
    lineHeight: 20,
    fontFamily: 'Inter_700Bold',
    fontWeight: "700",
    textTransform: "capitalize",
  },

  surfaceDescription: {
    color: "#9CA5B3",
    fontSize: 13,
    lineHeight: 18,
    marginTop: 4,
  },

  lightSection: {
    marginHorizontal: -24,
    marginTop: 28,
    paddingHorizontal: 24,
    paddingTop: 28,
    paddingBottom: 40,
    gap: 20,
    backgroundColor: "#F2EEE5",
  },

  darkText: {
    color: "#292B30",
  },

  darkSecondaryText: {
    color: "#69645B",
  },
});
