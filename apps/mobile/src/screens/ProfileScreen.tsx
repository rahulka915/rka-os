import { View, Text, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fontSize, spacing } from '../theme';

export function ProfileScreen() {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <Text style={{ fontSize: 64 }}>👤</Text>
      <Text style={styles.title}>Me</Text>
      <Text style={styles.sub}>Profile coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center', gap: spacing[2] },
  title: { fontSize: 22, fontWeight: '700', color: colors.text },
  sub: { fontSize: fontSize.sm, color: colors.textSecondary },
});
