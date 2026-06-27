import { TouchableOpacity, View, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors, radius, spacing } from '../../theme';

export function SurfaceCard({
  children,
  isDark,
  style,
  padding = spacing[3],
  tone = 'default',
}: {
  children: React.ReactNode;
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  padding?: number;
  tone?: 'default' | 'subtle' | 'success';
}) {
  const palette = getThemeColors(isDark);
  const backgroundColor =
    tone === 'success' ? palette.greenSoft : tone === 'subtle' ? palette.fill : palette.surface;

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor,
          borderColor: palette.separator,
          padding,
        },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SurfaceIconButton({
  children,
  isDark,
  onPress,
  style,
  tone = 'neutral',
  size = 32,
}: {
  children: React.ReactNode;
  isDark: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'neutral' | 'danger' | 'accent';
  size?: number;
}) {
  const palette = getThemeColors(isDark);
  const backgroundColor =
    tone === 'danger' ? palette.redSoft : tone === 'accent' ? palette.blueSoft : palette.fill;

  return (
    <TouchableOpacity
      activeOpacity={0.82}
      onPress={onPress}
      style={[
        styles.iconButton,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          backgroundColor,
        },
        style,
      ]}
    >
      {children}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: radius.surface,
    borderWidth: StyleSheet.hairlineWidth,
  },
  iconButton: {
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
});
