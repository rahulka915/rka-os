import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors } from '../../theme';

export function DragHandle({
  isDark,
  style,
  width = 38,
}: {
  isDark: boolean;
  style?: StyleProp<ViewStyle>;
  width?: number;
}) {
  const palette = getThemeColors(isDark);

  return <View style={[styles.handle, { width, backgroundColor: palette.handle }, style]} />;
}

const styles = StyleSheet.create({
  handle: {
    height: 5,
    borderRadius: 999,
    alignSelf: 'center',
  },
});
