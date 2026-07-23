import React, { useState } from 'react';
import { View, StyleSheet, type LayoutChangeEvent, type ViewStyle } from 'react-native';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import { riverStoneMaterial } from '../../theme';

interface TabBarTrayProps {
  isDark: boolean;
  backgroundColor: string;
  children: React.ReactNode;
}

const RECESS_OUTER_WIDTH = 148;
const RECESS_INNER_WIDTH = 126;
const RECESS_DEPTH = 7;
const FAB_CRADLE_WIDTH = 112;
const BODY_TOP = 4;

export function TabBarTray({ isDark, backgroundColor, children }: TabBarTrayProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });
  const token = riverStoneMaterial.variants.tray;
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
    const center = w / 2;
    const outerWidth = Math.min(RECESS_OUTER_WIDTH, w * 0.52);
    const innerWidth = Math.min(RECESS_INNER_WIDTH, outerWidth - 26);
    const depth = Math.min(RECESS_DEPTH, h - radius - 4);
    const footRight = center + outerWidth / 2;
    const shoulderRight = center + innerWidth / 2;
    const shoulderLeft = center - innerWidth / 2;
    const footLeft = center - outerWidth / 2;
    const cradleStart = Math.max(w - FAB_CRADLE_WIDTH, center + 46);
    const cradleTop = Math.max(cradleStart + 24, w - 76);

    path = [
      `M ${radius} ${BODY_TOP}`,
      `L ${cradleStart} ${BODY_TOP}`,
      `C ${cradleStart + 14} ${BODY_TOP} ${cradleStart + 26} 0 ${cradleTop} 0`,
      `L ${w - radius} 0`,
      `Q ${w} 0 ${w} ${radius}`,
      `L ${w} ${h - radius}`,
      `Q ${w} ${h} ${w - radius} ${h}`,
      `L ${footRight} ${h}`,
      `C ${footRight - 24} ${h} ${shoulderRight + 22} ${h - depth} ${shoulderRight} ${h - depth}`,
      `C ${shoulderRight - 24} ${h - depth} ${shoulderLeft + 24} ${h - depth} ${shoulderLeft} ${h - depth}`,
      `C ${shoulderLeft - 22} ${h - depth} ${footLeft + 24} ${h} ${footLeft} ${h}`,
      `L ${radius} ${h}`,
      `Q 0 ${h} 0 ${h - radius}`,
      `L 0 ${BODY_TOP + radius}`,
      `Q 0 ${BODY_TOP} ${radius} ${BODY_TOP}`,
      'Z',
    ].join(' ');

    edgePath = `M 1 ${BODY_TOP + radius} Q 1 ${BODY_TOP + 1} ${radius} ${BODY_TOP + 1} L ${Math.max(radius + 34, cradleStart - 18)} ${BODY_TOP + 1}`;
  }

  const ambientShadow: ViewStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.ambientShadow.offset },
    shadowOpacity: token.ambientShadow.opacity * shadowScale,
    shadowRadius: token.ambientShadow.radius,
    elevation: 12,
  };
  const contactShadow: ViewStyle = {
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: token.contact.offset },
    shadowOpacity: token.contact.opacity * shadowScale,
    shadowRadius: token.contact.radius,
    elevation: 4,
  };

  return (
    <View style={[styles.wrap, ambientShadow]} onLayout={onLayout}>
      <View style={[styles.wrap, contactShadow]}>
        {w > 0 && h > 0 ? (
          <Svg width={w} height={h} style={StyleSheet.absoluteFill} pointerEvents="none">
            <Defs>
              <LinearGradient id="trayAmbient" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor="#ffffff" stopOpacity={isDark ? 0.065 : 0.24} />
                <Stop offset="0.34" stopColor="#ffffff" stopOpacity={isDark ? 0.018 : 0.06} />
                <Stop offset="0.64" stopColor="#ffffff" stopOpacity={0} />
              </LinearGradient>
              <LinearGradient id="trayLower" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0.62" stopColor="#000000" stopOpacity={0} />
                <Stop offset="1" stopColor="#000000" stopOpacity={isDark ? 0.16 : 0.06} />
              </LinearGradient>
            </Defs>
            <Path d={path} fill={backgroundColor} />
            <Path d={path} fill="url(#trayAmbient)" />
            <Path d={path} fill="url(#trayLower)" />
            <Path
              d={edgePath}
              fill="none"
              stroke="#ffffff"
              strokeOpacity={isDark ? 0.11 : 0.3}
              strokeWidth={0.9}
              strokeLinecap="round"
            />
          </Svg>
        ) : null}
        {children}
        <View
          pointerEvents="none"
          style={[
            styles.homeIndicator,
            { backgroundColor: isDark ? 'rgba(255,255,255,0.9)' : 'rgba(28,28,30,0.72)' },
          ]}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    width: '100%',
  },
  homeIndicator: {
    position: 'absolute',
    bottom: 2,
    left: '50%',
    width: 132,
    height: 5,
    marginLeft: -66,
    borderRadius: 3,
  },
});
