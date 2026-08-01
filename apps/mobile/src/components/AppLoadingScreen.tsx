import { useEffect } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Reanimated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

// Matches app.json's expo-splash-screen backgroundColor so this screen reads
// as a continuation of the native splash, not a jump-cut to a new color.
const SPLASH_BACKGROUND = '#0F0F10';

const logoArtwork = require('../../assets/splash-icon.png');

const CYCLE_DURATION_MS = 1400;

export function AppLoadingScreen() {
  const phase = useSharedValue(0);

  useEffect(() => {
    phase.value = withRepeat(
      withSequence(
        withTiming(1, { duration: CYCLE_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
        withTiming(0, { duration: CYCLE_DURATION_MS, easing: Easing.inOut(Easing.sin) }),
      ),
      -1,
      false,
    );
    return () => cancelAnimation(phase);
  }, [phase]);

  const logoStyle = useAnimatedStyle(() => ({
    opacity: 0.72 + phase.value * 0.28,
    transform: [{ scale: 0.94 + phase.value * 0.06 }],
  }));

  return (
    <View style={styles.container}>
      <Reanimated.Image source={logoArtwork} style={[styles.logo, logoStyle]} resizeMode="contain" />
      <Text style={styles.wordmark}>
        RKA <Text style={styles.wordmarkAccent}>OS</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: SPLASH_BACKGROUND,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
  },
  logo: {
    width: 96,
    height: 96,
  },
  wordmark: {
    // The app's global Text.defaultProps forces fontFamily: 'Inter_400Regular'
    // (see App.tsx), but this screen renders precisely when Inter hasn't
    // finished loading yet — using that font here would show blank/tofu
    // glyphs until the font swaps in. Explicitly fall back to the system
    // font for this one screen.
    fontFamily: undefined,
    fontSize: 15,
    fontWeight: '700',
    letterSpacing: 2,
    color: '#f2f2f2',
  },
  wordmarkAccent: {
    fontFamily: undefined,
    color: '#4E9E86',
  },
});
