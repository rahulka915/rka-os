import { View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors, radius, shadows, spacing } from '../../theme';

export function FloatingSurface({
  children,
  isDark,
  style,
  padded = true,
  elevated = true,
}: {
  children: React.ReactNode;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  padded?: boolean;
  elevated?: boolean;
}) {
  const palette = getThemeColors(isDark);

  return (
    <View
      style={[
        styles.base,
        {
          backgroundColor: palette.surfaceRaised,
          borderColor: palette.separator,
          padding: padded ? spacing[3] : 0,
        },
        elevated ? shadows.floating : shadows.soft,
        style,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: radius.floating,
    borderWidth: StyleSheet.hairlineWidth,
  },
});
