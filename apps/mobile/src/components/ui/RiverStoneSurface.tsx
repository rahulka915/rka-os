import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';
import { getThemeColors, riverStoneMaterial, type RiverStoneVariant } from '../../theme';

export type { RiverStoneVariant } from '../../theme';

interface RiverStoneSurfaceProps {
  variant: RiverStoneVariant;
  isDark: boolean;
  children?: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  backgroundColor?: string;
  tintColor?: string;
  stretchToFill?: boolean;
}

export function RiverStoneSurface({
  variant,
  isDark,
  children,
  style,
  backgroundColor,
  tintColor,
  stretchToFill,
}: RiverStoneSurfaceProps) {
  const palette = getThemeColors(isDark);
  const material = isDark ? riverStoneMaterial.dark : riverStoneMaterial.light;
  const token = riverStoneMaterial.variants[variant];
  const resolvedBg = backgroundColor ?? palette.stoneSurface;
  const radius = token.radius;
  const shadowScale = material.shadowScale;
  const percent = (value: number) => `${value}%` as `${number}%`;

  const ambientShadow: ViewStyle = {
    borderRadius: radius,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.ambientShadow.offset },
    shadowOpacity: token.ambientShadow.opacity * shadowScale,
    shadowRadius: token.ambientShadow.radius,
    elevation: Math.max(1, Math.round(token.ambientShadow.radius / 2)),
  };
  const contactShadow: ViewStyle = {
    borderRadius: radius,
    backgroundColor: palette.stoneSurface,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.contact.offset },
    shadowOpacity: token.contact.opacity * shadowScale,
    shadowRadius: token.contact.radius,
    elevation: token.contact.opacity > 0 ? 2 : 0,
  };
  const clippedFace: ViewStyle = {
    borderRadius: radius,
    backgroundColor: resolvedBg,
  };

  return (
    <View style={[ambientShadow, style]}>
      <View style={[contactShadow, stretchToFill && styles.fill]}>
        <View style={[styles.clip, stretchToFill && styles.fill, clippedFace]}>
          {tintColor ? (
            <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: tintColor }]} />
          ) : null}
          {children}

          <Svg pointerEvents="none" width="100%" height="100%" style={StyleSheet.absoluteFill}>
            <Defs>
              <RadialGradient id="stoneAmbient" cx="18%" cy="2%" r="92%" fx="12%" fy="0%">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={token.ambientAlpha} />
                <Stop offset="0.5" stopColor="#ffffff" stopOpacity={token.ambientAlpha * 0.22} />
                <Stop offset="1" stopColor="#ffffff" stopOpacity={0} />
              </RadialGradient>
            </Defs>
            <Rect width="100%" height="100%" fill="url(#stoneAmbient)" />
          </Svg>

          <LinearGradient
            pointerEvents="none"
            colors={[
              `rgba(${material.lightRgb},${token.edgeAlpha})`,
              `rgba(${material.lightRgb},${token.edgeAlpha * 0.18})`,
              'rgba(255,255,255,0)',
            ]}
            locations={[0, 0.28, 1]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0.7 }}
            style={[
              styles.edgeCatch,
              { width: percent(token.edgeWidth), height: percent(token.edgeHeight) },
            ]}
          />

          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', `rgba(${material.occlusionRgb},${token.cornerAlpha})`]}
            start={{ x: 0.2, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.lowerLeftOcclusion}
          />
          <LinearGradient
            pointerEvents="none"
            colors={['rgba(0,0,0,0)', `rgba(${material.occlusionRgb},${token.cornerAlpha})`]}
            start={{ x: 0.8, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.lowerRightOcclusion}
          />

          <LinearGradient
            pointerEvents="none"
            colors={[
              'rgba(0,0,0,0)',
              'rgba(0,0,0,0)',
              `rgba(${material.occlusionRgb},${token.lowerAlpha})`,
            ]}
            locations={[0, token.lowerStart, 1]}
            style={StyleSheet.absoluteFill}
          />

          {variant === 'chip' ? (
            <>
              <LinearGradient
                pointerEvents="none"
                colors={[
                  `rgba(${material.occlusionRgb},${isDark ? 0.22 : 0.12})`,
                  'rgba(0,0,0,0)',
                ]}
                style={styles.chipInsetTop}
              />
              <View
                pointerEvents="none"
                style={[
                  StyleSheet.absoluteFill,
                  styles.chipBoundary,
                  {
                    borderRadius: radius,
                    borderColor: `rgba(${material.occlusionRgb},${isDark ? 0.28 : 0.14})`,
                  },
                ]}
              />
            </>
          ) : null}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    flex: 1,
  },
  clip: {
    overflow: 'hidden',
  },
  edgeCatch: {
    position: 'absolute',
    top: 0,
    left: 0,
  },
  lowerLeftOcclusion: {
    position: 'absolute',
    left: 0,
    bottom: 0,
    width: '38%',
    height: '30%',
  },
  lowerRightOcclusion: {
    position: 'absolute',
    right: 0,
    bottom: 0,
    width: '38%',
    height: '30%',
  },
  chipInsetTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 5,
  },
  chipBoundary: {
    borderWidth: StyleSheet.hairlineWidth,
  },
});
