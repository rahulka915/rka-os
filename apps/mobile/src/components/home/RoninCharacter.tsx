import { useEffect, useRef, useState, type ComponentType } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useSharedValue, withTiming } from 'react-native-reanimated';
import type { RoninCharacterState } from '../../domain/ronin/types';
import { getRoninAsset } from '../../domain/ronin/roninAssets';
import { RONIN_3D_ENABLED, getMoodClip, isOneShotClip } from '../../domain/ronin/roninModel';
import { useRoninGlbBase64 } from '../../domain/ronin/useRoninGlbBase64';
import { useAppIsActive } from '../../hooks/useAppIsActive';
import type { Ronin3DDomProps } from './Ronin3DDom';

interface RoninCharacterProps extends RoninCharacterState {
  style?: ViewStyle;
}

const CROSSFADE_MS = 350;

// The 3D companion renders through an Expo DOM component (web three.js in a
// dom-webview) — no extra native modules, so it works in the existing dev
// client. Required lazily behind the kill switch so the flag fully removes
// three from the module graph; any load failure falls back to static art.
// (Ronin3D.tsx, the native expo-gl variant, stays parked for a future dev
// client with expo-gl — see plan §H.)
let Ronin3DDom: ComponentType<Ronin3DDomProps> | null = null;
if (RONIN_3D_ENABLED) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Ronin3DDom = (require('./Ronin3DDom') as typeof import('./Ronin3DDom')).default;
  } catch {
    Ronin3DDom = null;
  }
}

// Pure character renderer — resolves { mood, outfit } to an asset via
// getRoninAsset() and crossfades between mood changes. The static PNG stack
// below is the always-available fallback; when 3D is enabled and the GLB
// scene reports ready, the PNG fades out and the animated companion takes
// over. On any 3D error the PNG fades straight back in — behavior with the
// flag off (or on 3D failure) is identical to the static-only version.
export function RoninCharacter({ mood, outfit, style }: RoninCharacterProps) {
  const [prevMood, setPrevMood] = useState<RoninCharacterState['mood'] | null>(null);
  const [threeDFailed, setThreeDFailed] = useState(false);
  const prevOpacity = useSharedValue(0);
  const currentOpacity = useSharedValue(1);
  const staticOpacity = useSharedValue(1);
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

  const { glbBase64 } = useRoninGlbBase64(Ronin3DDom !== null && !threeDFailed);
  const appIsActive = useAppIsActive();
  const clip = getMoodClip(mood);
  const show3D = Ronin3DDom !== null && !threeDFailed && glbBase64 !== null;

  return (
    <View style={[styles.container, style]} pointerEvents="none">
      <Animated.View style={[StyleSheet.absoluteFill, { opacity: staticOpacity }]}>
        {previous && (
          <Animated.View style={[StyleSheet.absoluteFill, { opacity: prevOpacity }]}>
            <Image source={previous.source} resizeMode="contain" style={styles.image} />
          </Animated.View>
        )}
        <Animated.View style={[StyleSheet.absoluteFill, { opacity: currentOpacity }]}>
          <Image source={current.source} resizeMode="contain" style={styles.image} />
        </Animated.View>
      </Animated.View>
      {show3D && Ronin3DDom && glbBase64 && (
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          <Ronin3DDom
            glbBase64={glbBase64}
            animation={clip.animation}
            fallbackAnimation={clip.fallbackAnimation}
            oneShot={isOneShotClip(clip.animation)}
            blinkEnabled={mood !== 'resolved'}
            active={appIsActive}
            onSceneReady={async () => {
              staticOpacity.value = withTiming(0, { duration: CROSSFADE_MS });
            }}
            onSceneError={async () => {
              setThreeDFailed(true);
              staticOpacity.value = withTiming(1, { duration: CROSSFADE_MS });
            }}
            dom={{ style: styles.dom, scrollEnabled: false }}
          />
        </View>
      )}
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
  dom: {
    width: '100%',
    height: '100%',
    backgroundColor: 'transparent',
  },
});
