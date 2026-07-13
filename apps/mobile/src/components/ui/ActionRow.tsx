import { Pressable, StyleSheet, Text, View, type StyleProp, type ViewStyle } from 'react-native';
import { getThemeColors, spacing, fontSize } from '../../theme';

export function ActionRow({
  isDark,
  title,
  subtitle,
  leading,
  trailing,
  onPress,
  style,
}: {
  isDark: boolean;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  leading?: React.ReactNode;
  trailing?: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const palette = getThemeColors(isDark);
  const content = (
    <View style={[styles.row, style]}>
      {leading ? <View style={styles.leading}>{leading}</View> : null}
      <View style={styles.copy}>
        {typeof title === 'string' ? <Text style={[styles.title, { color: palette.text }]} numberOfLines={2}>{title}</Text> : title}
        {typeof subtitle === 'string' ? <Text style={[styles.subtitle, { color: palette.textMuted }]} numberOfLines={2}>{subtitle}</Text> : subtitle}
      </View>
      {trailing ? <View style={styles.trailing}>{trailing}</View> : null}
    </View>
  );

  if (!onPress) return content;

  return (
    <Pressable onPress={onPress} style={({ pressed }) => [pressed && styles.pressed]}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing[3],
  },
  leading: {
    flexShrink: 0,
  },
  copy: {
    flex: 1,
    minWidth: 0,
  },
  trailing: {
    flexShrink: 0,
  },
  title: {
    fontSize: fontSize.base,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
    lineHeight: 22,
  },
  subtitle: {
    marginTop: 2,
    fontSize: fontSize.sm,
    fontWeight: '500',
    fontFamily: 'Inter_500Medium',
    lineHeight: 18,
  },
  pressed: {
    opacity: 0.82,
  },
});
