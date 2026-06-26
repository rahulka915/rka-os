import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { User } from '../icons';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top }]}>
      <View style={[styles.avatar, { backgroundColor: palette.fill }]}>
        <User size={36} color={palette.textMuted} strokeWidth={1.5} />
      </View>
      <Text style={[styles.title, { color: palette.text }]}>Me</Text>
      <Text style={[styles.sub, { color: palette.textSecondary }]}>Profile coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  avatar: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  sub: {
    fontSize: 14,
    fontWeight: '400',
  },
});
