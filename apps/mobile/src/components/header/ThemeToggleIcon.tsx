import { useEffect } from 'react';
import { StyleSheet } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  withTiming,
  useSharedValue,
} from 'react-native-reanimated';

const themeLightArtwork = require('../../../assets/icons/header-v2/theme-light.png');
const themeDarkArtwork = require('../../../assets/icons/header-v2/theme-dark.png');

interface ThemeToggleIconProps {
  isDark: boolean;
  size?: number;
}

// Both states render stacked and crossfade via opacity so neither theme's
// artwork ever pops in/out abruptly. Reduce Motion collapses the fade to a
// near-instant swap instead of skipping the animation infra entirely.
export function ThemeToggleIcon({ isDark, size = 34 }: ThemeToggleIconProps) {
  const reduceMotion = useReducedMotion();
  const darkOpacity = useSharedValue(isDark ? 1 : 0);

  useEffect(() => {
    const duration = reduceMotion ? 0 : 220;
    darkOpacity.value = withTiming(isDark ? 1 : 0, { duration });
  }, [isDark, reduceMotion, darkOpacity]);

  const lightStyle = useAnimatedStyle(() => ({ opacity: 1 - darkOpacity.value }));
  const darkStyle = useAnimatedStyle(() => ({ opacity: darkOpacity.value }));

  return (
    <Animated.View style={[styles.wrap, { width: size, height: size }]}>
      <Animated.Image
        source={themeLightArtwork}
        resizeMode="contain"
        style={[styles.image, { width: size, height: size }, lightStyle]}
        accessibilityIgnoresInvertColors
      />
      <Animated.Image
        source={themeDarkArtwork}
        resizeMode="contain"
        style={[styles.image, { width: size, height: size }, darkStyle]}
        accessibilityIgnoresInvertColors
      />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
  },
});
