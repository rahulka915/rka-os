import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';

// Deliberately not using the app's theme tokens (getThemeColors), custom fonts, or
// component library (RiverStoneSurface etc.) — this screen is a true visual reset, built
// up from workflow rather than inheriting the existing app's design language. Only
// dark/light background awareness is kept (via the same manual-override-aware isDark
// the rest of the app uses), everything else is plain system defaults.
export function HomeScreenExperimental() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();

  return (
    <View
      style={[
        styles.container,
        { backgroundColor: isDark ? '#000000' : '#ffffff', paddingTop: insets.top },
      ]}
    >
      <Text style={[styles.label, { color: isDark ? '#ffffff' : '#000000' }]}>
        Experimental Home
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: {
    fontSize: 15,
  },
});
