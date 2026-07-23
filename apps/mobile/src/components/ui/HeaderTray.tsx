import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { riverStoneMaterial } from '../../theme';

interface HeaderTrayProps {
  isDark: boolean;
  backgroundColor: string;
  children: React.ReactNode;
}

// Regular flush header shape — square top edge (blends seamlessly into the
// status bar / Dynamic Island instead of floating as a separate carved
// ledge with its own notch), rounded bottom corners only. Replaces the
// earlier Dynamic-Island-notch geometry per direct feedback that a plain
// shape reads better here than a bespoke recess.
export function HeaderTray({ isDark, backgroundColor, children }: HeaderTrayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const token = riverStoneMaterial.variants.header;
  const shadowScale = isDark ? riverStoneMaterial.dark.shadowScale : riverStoneMaterial.light.shadowScale;
  const { width: w, height: h } = size;

  const onLayout = (event: LayoutChangeEvent) => {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  };

  let path = '';
  let edgePath = '';
  if (w > 0 && h > 0) {
    const radius = token.radius;

    path = [
      `M 0 0`,
      `L ${w} 0`,
      `L ${w} ${h - radius}`,
      `Q ${w} ${h} ${w - radius} ${h}`,
      `L ${radius} ${h}`,
      `Q 0 ${h} 0 ${h - radius}`,
      `L 0 0`,
      'Z',
    ].join(' ');

    edgePath = `M 1 1 L ${Math.max(radius * 3, w * 0.3)} 1`;
  }

  const ambientShadow: ViewStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.ambientShadow.offset },
    shadowOpacity: token.ambientShadow.opacity * shadowScale,
    shadowRadius: token.ambientShadow.radius,
    elevation: 4,
  };
  const contactShadow: ViewStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.contact.offset },
    shadowOpacity: token.contact.opacity * shadowScale,
    shadowRadius: token.contact.radius,
    elevation: 2,
  };

  return (
    <View style={[styles.wrap, ambientShadow]} onLayout={onLayout}>
      <View style={[styles.wrap, contactShadow]}>
        {w > 0 && h > 0 ? (
          <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="headerAmbient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={isDark ? 0.04 : 0.16} />
                <Stop offset="0.38" stopColor="#ffffff" stopOpacity={isDark ? 0.012 : 0.04} />
                <Stop offset="0.72" stopColor="#ffffff" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="headerLower" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.65" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={isDark ? 0.08 : 0.035} />
              </LinearGradient>
            </Defs>
            <Path d={path} fill={backgroundColor} />
            <Path d={path} fill="url(#headerAmbient)" />
            <Path d={path} fill="url(#headerLower)" />
            <Path
              d={edgePath}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={isDark ? 0.09 : 0.24}
              strokeWidth={0.85}
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
});
