import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import type { RoninCharacterState } from '../../domain/ronin/types';
import { getRoninAsset } from '../../domain/ronin/roninAssets';

interface RoninCharacterProps extends RoninCharacterState {
  style?: ViewStyle;
}

const CROSSFADE_MS = 350;

// Pure character renderer — resolves { mood, outfit } to an asset via
// getRoninAsset() and crossfades between mood changes. Only handles
// 'static' assets today; a future asset kind (Rive/Lottie/sprite) would
// branch here without changing any caller (RoninHero, etc).
export function RoninCharacter({ mood, outfit, style }: RoninCharacterProps) {
  const [prevMood, setPrevMood] = useState<RoninCharacterState['mood'] | null>(null);
  const prevOpacity = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const moodRef = useRef(mood);

  useEffect(() => {
    if (moodRef.current === mood) return;
    setPrevMood(moodRef.current);
    moodRef.current = mood;

    prevOpacity.value = 1;
    currentOpacity.value = 0;
    prevOpacity.value = withTiming(0, { duration: CROSSFADE_MS });
    currentOpacity.value = withTiming(1, { duration: CROSSFADE_MS });
  }, [mood]);

  const current = getRoninAsset({ mood, outfit });
  const previous = prevMood ? getRoninAsset({ mood: prevMood, outfit }) : null;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      {previous && (
        <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: prevOpacity }]}>
          <Image source={previous.source} resizeMode="contain" style={styles.image} />
        </Animated.View>
      )}
      <Animated.View style={[StyleSheet.absoluteFillObject, { opacity: currentOpacity }]}>
        <Image source={current.source} resizeMode="contain" style={styles.image} />
      </Animated.View>
    </View>
  );
}

// No default aspectRatio here — unlike the old single-figure portrait
// assets, the current placeholder assets are landscape (character + cat
// side by side) and vary in aspect per outfit. Callers size the box
// explicitly (width/height) and resizeMode="contain" fits the art within it.
const styles = StyleSheet.create({
  container: {},
  image: {
    width: '100%',
    height: '100%',
  },
});
