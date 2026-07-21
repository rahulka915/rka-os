import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';
import { EnsoLoader } from './EnsoLoader';

export interface LoadingBannerProps {
  message: string;
}

export function LoadingBanner({ message }: LoadingBannerProps) {
  const insets = useSafeAreaInsets();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <View pointerEvents="none" style={[styles.anchor, { bottom: insets.bottom + 16 }]}>
      <View style={[styles.card, { backgroundColor: palette.surface, borderColor: palette.separator }]}>
        <EnsoLoader size={18} />
        <Text style={[styles.message, { color: palette.text }]}>{message}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  // Same anchor shape as PersistentTimerBanner.tsx's `styles.anchor`
  // (position: absolute, left/right 0, high zIndex, centered) — this repo's
  // established idiom for a floating overlay above the tab bar — but
  // bottom-anchored instead of top-anchored, per the approved mockup.
  anchor: {
    position: 'absolute',
    left: 0,
    right: 0,
    zIndex: 1000,
    alignItems: 'center',
  },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  message: {
    fontSize: 13,
    fontWeight: '500',
  },
});
