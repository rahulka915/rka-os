import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { LayoutChangeEvent, StyleProp, ViewStyle } from 'react-native';
import { SkyLayerView } from './SkyLayerView';
import type { SkyLayer } from '../../utils/loopingScroll';

// TEMPORARY: single-combo (dusk-clear) test harness to verify the parallax
// scroll + transparency compositing on real device art before the full
// 45-asset SKY_SCENES registry exists. Delete once AnimatedSkyBackground
// (Task 5) is built against the real registry.
//
// Deliberately does NOT read AccessibilityInfo.isReduceMotionEnabled() —
// product decision: this ambient decorative background should keep
// animating even with the device's Reduce Motion setting on, since the
// primary tester always has it enabled. Carry this same choice into
// AnimatedSkyBackground (Task 5) rather than the spec's original
// reduceMotion-respecting default.
const DUSK_CLEAR_SKY = require('../../../assets/sky/dusk-clear-sky.jpg');
const DUSK_CLEAR_MIDGROUND = require('../../../assets/sky/dusk-clear-midground.png');
const DUSK_CLEAR_FOREGROUND = require('../../../assets/sky/dusk-clear-foreground.png');

const LAYERS: SkyLayer[] = ['sky', 'midground', 'foreground'];
const SOURCES: Record<SkyLayer, ReturnType<typeof require>> = {
  sky: DUSK_CLEAR_SKY,
  midground: DUSK_CLEAR_MIDGROUND,
  foreground: DUSK_CLEAR_FOREGROUND,
};

// LAYER_SCROLL_CONFIG's base loopDurationMs (3-20min) is tuned for slow
// ambient drift, not a "running" feel — while isWalking, speed each layer up
// by this multiplier so the ground visibly moves fast enough to match the
// walk-cycle's ~1s stride instead of looking like the character is jogging
// in place. Sky gets a smaller bump since it's meant to read as a distant,
// slow-moving backdrop even while running.
const WALKING_SPEED_MULTIPLIER: Record<SkyLayer, number> = {
  sky: 3,
  midground: 40,
  foreground: 60,
};

interface SkyTestBackgroundProps {
  style?: StyleProp<ViewStyle>;
  /**
   * Product decision (2026-08-16): sky always drifts (ambient, time
   * passing); midground/foreground only scroll while the ronin sprite is
   * actively walking — the scene shouldn't visibly move when nothing on
   * screen is moving. Carry into AnimatedSkyBackground (Task 5).
   */
  isWalking: boolean;
}

export function SkyTestBackground({ style, isWalking }: SkyTestBackgroundProps) {
  const [size, setSize] = useState({ width: 0, height: 0 });

  function handleLayout(event: LayoutChangeEvent) {
    const { width, height } = event.nativeEvent.layout;
    setSize({ width, height });
  }

  return (
    <View style={[styles.fill, style]} onLayout={handleLayout}>
      {size.width > 0 &&
        size.height > 0 &&
        LAYERS.map((layer) => (
          <SkyLayerView
            key={layer}
            layer={layer}
            sourceA={SOURCES[layer]}
            sourceB={SOURCES[layer]}
            blend={0}
            containerWidth={size.width}
            containerHeight={size.height}
            reduceMotion={false}
            active={layer === 'sky' ? true : isWalking}
            speedMultiplier={isWalking ? WALKING_SPEED_MULTIPLIER[layer] : 1}
          />
        ))}
    </View>
  );
}

const styles = StyleSheet.create({
  fill: {
    ...StyleSheet.absoluteFill,
  },
});
