import { StyleSheet, Text, View } from 'react-native';
import { EnsoLoader } from './ui/EnsoLoader';

// Matches app.json's expo-splash-screen backgroundColor so this screen reads
// as a continuation of the native splash, not a jump-cut to a new color.
const SPLASH_BACKGROUND = '#0F0F10';

export function AppLoadingScreen() {
  return (
    <View style={styles.container}>
      <EnsoLoader size={56} />
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
