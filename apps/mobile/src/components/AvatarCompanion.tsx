import { View, Text, TouchableOpacity } from 'react-native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';

interface AvatarCompanionProps {
  size?: 'sm' | 'md' | 'lg';
  onPress?: () => void;
  showRing?: boolean;
}

const SIZES = {
  sm: { outer: 36, inner: 32, font: 14, ring: 2 },
  md: { outer: 56, inner: 52, font: 20, ring: 2 },
  lg: { outer: 80, inner: 74, font: 28, ring: 3 },
};

export function AvatarCompanion({ size = 'md', onPress, showRing = false }: AvatarCompanionProps) {
  const { isDark } = useThemeContext();
  const theme = getThemeColors(isDark);
  const s = SIZES[size];

  const bg = theme.bgElevated;
  const textColor = theme.text;
  const ringColor = theme.separator;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={!onPress}
      activeOpacity={onPress ? 0.75 : 1}
      style={{
        width: s.outer,
        height: s.outer,
        borderRadius: s.outer / 2,
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: showRing ? s.ring : 0,
        borderColor: ringColor,
      }}
    >
      {/* Placeholder — will be replaced with actual avatar image/animation */}
      <View
        style={{
          width: s.inner,
          height: s.inner,
          borderRadius: s.inner / 2,
          backgroundColor: bg,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text style={{ fontSize: s.font, fontWeight: '700', fontFamily: 'Inter_700Bold', color: textColor }}>R</Text>
      </View>
    </TouchableOpacity>
  );
}
