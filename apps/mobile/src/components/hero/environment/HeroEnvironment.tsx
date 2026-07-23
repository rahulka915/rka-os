import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Animated, {
  Easing,
  interpolate,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import { HERO_ENVIRONMENT_ASSETS } from './heroEnvironmentAssets';
import { HeroRegistrationGuides } from './HeroRegistrationGuides';
import {
  HERO_LAYER_ORDER,
  HERO_SCENE_HEIGHT,
  HERO_SCENE_WIDTH,
  mergeHeroRegistration,
  resolveHeroViewport,
  type HeroLayerId,
  type HeroLayerRegistration,
  type HeroViewportRegistration,
} from './heroEnvironmentRegistration';

export type HeroTimeOfDay = 'morning' | 'day' | 'evening' | 'night';
export type HeroWeather = 'clear' | 'rain' | 'snow' | 'fireflies' | 'fallingPetals';
export type HeroInboxState = 'empty' | 'partial' | 'full';
export type HeroFocusState = 'idle' | 'active' | 'complete';

export interface HeroEnvironmentProps {
  timeOfDay?: HeroTimeOfDay;
  weather?: HeroWeather;
  inboxState?: HeroInboxState;
  focusState?: HeroFocusState;
  parallaxEnabled?: boolean;
  parallaxX?: number;
  parallaxY?: number;
  viewportWidth?: number;
  viewportHeight?: number;
  sceneWidth?: number;
  sceneHeight?: number;
  sceneOffsetX?: number;
  sceneOffsetY?: number;
  sceneScale?: number;
  showGuides?: boolean;
  layerVisibility?: Partial<Record<HeroLayerId, boolean>>;
  registrationOverrides?: Partial<Record<HeroLayerId, Partial<HeroLayerRegistration>>>;
  accessible?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
}

const INBOX_LAYER_BY_STATE: Record<HeroInboxState, HeroLayerId> = {
  empty: 'hero_inbox_tray_empty',
  partial: 'hero_inbox_tray_partial',
  full: 'hero_inbox_tray_full',
};

const WEATHER_LAYER_BY_STATE: Partial<Record<HeroWeather, HeroLayerId>> = {
  rain: 'hero_rain',
  snow: 'hero_snow',
  fireflies: 'hero_fireflies',
  fallingPetals: 'hero_falling_petals',
};

const STATEFUL_LAYERS = new Set<HeroLayerId>([
  'hero_inbox_tray_empty',
  'hero_inbox_tray_partial',
  'hero_inbox_tray_full',
  'hero_scroll',
  'hero_scroll_open',
  'hero_morning_mist',
  'hero_evening_haze',
  'hero_rain',
  'hero_snow',
  'hero_fireflies',
  'hero_falling_petals',
]);

const TIME_GRADIENTS: Record<HeroTimeOfDay, readonly [string, string, string]> = {
  morning: ['#d8c6ae', '#c7b9ab', '#879ba6'],
  day: ['#bfc9c7', '#b6c0bd', '#839ba5'],
  evening: ['#a78079', '#8a777d', '#4d5e6e'],
  night: ['#222945', '#17213b', '#0e1728'],
};

const GRADE_COLORS: Record<HeroTimeOfDay, string> = {
  morning: 'rgba(235,174,119,0.10)',
  day: 'rgba(117,157,170,0.05)',
  evening: 'rgba(130,78,105,0.16)',
  night: 'rgba(21,29,67,0.34)',
};

function HeroCrossfade({ visible, reduceMotion, children }: { visible: boolean; reduceMotion: boolean; children: React.ReactNode }) {
  const opacity = useSharedValue(visible ? 1 : 0);
  useEffect(() => {
    opacity.value = reduceMotion ? (visible ? 1 : 0) : withTiming(visible ? 1 : 0, {
      duration: visible ? 240 : 160,
      easing: Easing.out(Easing.cubic),
    });
  }, [opacity, reduceMotion, visible]);
  const style = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

function HeroImageLayer({
  id,
  registration,
  viewport,
  parallaxEnabled,
  parallaxX,
  parallaxY,
}: {
  id: HeroLayerId;
  registration: HeroLayerRegistration;
  viewport: HeroViewportRegistration;
  parallaxEnabled: boolean;
  parallaxX: number;
  parallaxY: number;
}) {
  const factor = parallaxEnabled ? registration.parallax ?? 0 : 0;
  const width = HERO_SCENE_WIDTH * registration.scale * viewport.sceneScale;
  const height = HERO_SCENE_HEIGHT * registration.scale * viewport.sceneScale;
  return (
    <Image
      source={HERO_ENVIRONMENT_ASSETS[id]}
      resizeMode="stretch"
      style={{
        position: 'absolute',
        left: registration.x * viewport.sceneScale + parallaxX * factor * 3,
        top: registration.y * viewport.sceneScale + parallaxY * factor * 2,
        width,
        height,
        opacity: registration.opacity ?? 1,
        transform: registration.rotation ? [{ rotate: `${registration.rotation}deg` }] : undefined,
      }}
    />
  );
}

function AmbientGroup({
  kind,
  enabled,
  reduceMotion,
  children,
}: {
  kind: 'clouds' | 'water' | 'atmosphere' | 'weather';
  enabled: boolean;
  reduceMotion: boolean;
  children: React.ReactNode;
}) {
  const phase = useSharedValue(0);
  useEffect(() => {
    if (!enabled || reduceMotion) {
      phase.value = 0;
      return;
    }
    const duration = kind === 'clouds' ? 28000 : kind === 'water' ? 9000 : 18000;
    phase.value = withRepeat(withTiming(1, { duration, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [enabled, kind, phase, reduceMotion]);
  const style = useAnimatedStyle(() => {
    if (!enabled || reduceMotion) return { transform: [{ translateX: 0 }, { translateY: 0 }], opacity: 1 };
    const amount = interpolate(phase.value, [0, 1], [-1, 1]);
    if (kind === 'clouds') return { transform: [{ translateX: amount * 2.5 }, { translateY: 0 }], opacity: 1 };
    if (kind === 'water') return { transform: [{ translateX: 0 }, { translateY: amount * 0.6 }], opacity: 1 };
    if (kind === 'weather') return { transform: [{ translateX: amount * 1.2 }, { translateY: amount * 2 }], opacity: 1 };
    return { transform: [{ translateX: amount * 2 }, { translateY: amount * 0.5 }], opacity: interpolate(phase.value, [0, 1], [0.88, 1]) };
  });
  return <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, style]}>{children}</Animated.View>;
}

export function HeroEnvironment({
  timeOfDay = 'day',
  weather = 'clear',
  inboxState = 'partial',
  focusState = 'active',
  parallaxEnabled = true,
  parallaxX = 0,
  parallaxY = 0,
  viewportWidth = 390,
  viewportHeight = 179,
  sceneWidth = HERO_SCENE_WIDTH,
  sceneHeight = HERO_SCENE_HEIGHT,
  sceneOffsetX,
  sceneOffsetY,
  sceneScale,
  showGuides = false,
  layerVisibility,
  registrationOverrides,
  accessible = true,
  style,
  testID,
}: HeroEnvironmentProps) {
  const reduceMotion = useReducedMotion();
  const defaultViewport = resolveHeroViewport(viewportWidth, viewportHeight);
  const viewport: HeroViewportRegistration = {
    ...defaultViewport,
    sceneWidth,
    sceneHeight,
    sceneOffsetX: sceneOffsetX ?? defaultViewport.sceneOffsetX,
    sceneOffsetY: sceneOffsetY ?? defaultViewport.sceneOffsetY,
    sceneScale: sceneScale ?? defaultViewport.sceneScale,
  };
  const registration = useMemo(() => mergeHeroRegistration(registrationOverrides), [registrationOverrides]);
  const layer = (id: HeroLayerId) => (
    <HeroImageLayer
      key={id}
      id={id}
      registration={registration[id]}
      viewport={viewport}
      parallaxEnabled={parallaxEnabled && !reduceMotion}
      parallaxX={parallaxX}
      parallaxY={parallaxY}
    />
  );
  const visible = (id: HeroLayerId) => layerVisibility?.[id] !== false;
  const permanentLayers = HERO_LAYER_ORDER.filter((id) => !STATEFUL_LAYERS.has(id) && visible(id));
  const weatherLayer = WEATHER_LAYER_BY_STATE[weather];

  return (
    <View
      testID={testID}
      accessible={accessible}
      accessibilityRole={accessible ? 'image' : undefined}
      accessibilityLabel={accessible ? 'RKA OS veranda overlooking Mount Fuji' : undefined}
      style={[styles.viewport, { width: viewportWidth, height: viewportHeight }, style]}
    >
      {Object.keys(TIME_GRADIENTS).map((period) => (
        <HeroCrossfade key={period} visible={period === timeOfDay} reduceMotion={reduceMotion}>
          <LinearGradient colors={TIME_GRADIENTS[period as HeroTimeOfDay]} style={StyleSheet.absoluteFill} />
        </HeroCrossfade>
      ))}

      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: viewport.sceneOffsetX,
          top: viewport.sceneOffsetY,
          width: viewport.sceneWidth * viewport.sceneScale,
          height: viewport.sceneHeight * viewport.sceneScale,
        }}
      >
        {permanentLayers.map((id) => {
          if (id === 'hero_clouds') {
            return <AmbientGroup key={id} kind="clouds" enabled={parallaxEnabled} reduceMotion={reduceMotion}>{layer(id)}</AmbientGroup>;
          }
          if (id === 'hero_lake') {
            return <AmbientGroup key={id} kind="water" enabled={parallaxEnabled} reduceMotion={reduceMotion}>{layer(id)}</AmbientGroup>;
          }
          return layer(id);
        })}

        {(Object.keys(INBOX_LAYER_BY_STATE) as HeroInboxState[]).map((state) => {
          const id = INBOX_LAYER_BY_STATE[state];
          return visible(id) ? <HeroCrossfade key={id} visible={state === inboxState} reduceMotion={reduceMotion}>{layer(id)}</HeroCrossfade> : null;
        })}
        {(['hero_scroll', 'hero_scroll_open'] as HeroLayerId[]).map((id) => (
          visible(id) ? <HeroCrossfade key={id} visible={id === (focusState === 'idle' ? 'hero_scroll' : 'hero_scroll_open')} reduceMotion={reduceMotion}>{layer(id)}</HeroCrossfade> : null
        ))}

        <AmbientGroup kind="atmosphere" enabled={parallaxEnabled} reduceMotion={reduceMotion}>
          {visible('hero_morning_mist') && <HeroCrossfade visible={timeOfDay === 'morning'} reduceMotion={reduceMotion}>{layer('hero_morning_mist')}</HeroCrossfade>}
          {visible('hero_evening_haze') && <HeroCrossfade visible={timeOfDay === 'evening' || timeOfDay === 'night'} reduceMotion={reduceMotion}>{layer('hero_evening_haze')}</HeroCrossfade>}
        </AmbientGroup>

        {weatherLayer && visible(weatherLayer) && (
          <AmbientGroup kind="weather" enabled={parallaxEnabled} reduceMotion={reduceMotion}>
            {layer(weatherLayer)}
          </AmbientGroup>
        )}
      </View>

      {(Object.keys(GRADE_COLORS) as HeroTimeOfDay[]).map((period) => (
        <HeroCrossfade key={`grade-${period}`} visible={period === timeOfDay} reduceMotion={reduceMotion}>
          <View style={[StyleSheet.absoluteFill, { backgroundColor: GRADE_COLORS[period] }]} />
        </HeroCrossfade>
      ))}
      {showGuides && <HeroRegistrationGuides viewport={viewport} />}
    </View>
  );
}

const styles = StyleSheet.create({
  viewport: {
    overflow: 'hidden',
    backgroundColor: '#9aa4a3',
  },
});
