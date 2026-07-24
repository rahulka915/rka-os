import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

export function HomeScreenExperimental() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <Text style={[styles.label, { color: palette.textMuted }]}>Experimental Home</Text>
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
    fontFamily: 'Inter_500Medium',
  },
});
