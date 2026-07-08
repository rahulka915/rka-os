import { ComponentType } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { Plus } from '../icons';

interface LensFABProps {
  onPress: () => void;
  icon?: ComponentType<{ size?: number; color?: string; strokeWidth?: number }>;
}

// Per-screen "create here" affordance — distinct from the global quick-add FAB in the tab bar
// (that one is universal capture; this one is scoped to the Lens screen it's rendered in).
export function LensFAB({ onPress, icon: Icon = Plus }: LensFABProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <TouchableOpacity
      onPress={() => {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
        onPress();
      }}
      style={[styles.fab, { backgroundColor: palette.text }]}
      hitSlop={8}
      activeOpacity={0.8}
    >
      <Icon size={18} color={palette.bg} strokeWidth={2.5} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  fab: {
    width: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
