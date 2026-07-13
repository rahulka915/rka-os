import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ChevronLeft } from '../icons';

interface LensSurfaceProps {
  title: string;
  onBack?: () => void;
  headerRight?: ReactNode;
  contextBar?: ReactNode;
  children: ReactNode;
}

// Shared chrome-less container for "Lens" destinations (Projects, Workouts, Medications, ...).
// No border, no corner radius, no close button — these are pushed screens, not sheets.
export function LensSurface({ title, onBack, headerRight, contextBar, children }: LensSurfaceProps) {
  const insets = useSafeAreaInsets();
  const navigation = useNavigation();
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);

  const canGoBack = navigation.canGoBack();
  const handleBack = onBack ?? (canGoBack ? () => navigation.goBack() : undefined);

  return (
    <View style={[styles.container, { backgroundColor: palette.bg, paddingTop: insets.top + 12 }]}>
      <View style={styles.header}>
        <View style={styles.headerLeft}>
          {handleBack && (
            <TouchableOpacity onPress={handleBack} hitSlop={12} style={styles.backBtn}>
              <ChevronLeft size={20} color={palette.text} strokeWidth={2} />
            </TouchableOpacity>
          )}
          <Text style={[styles.title, { color: palette.text }]} numberOfLines={1}>
            {title}
          </Text>
        </View>
        {headerRight}
      </View>

      {contextBar}

      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    gap: 12,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexShrink: 1,
  },
  backBtn: {
    marginLeft: -4,
  },
  title: {
    fontSize: 22,
    fontWeight: '800',
    fontFamily: 'Inter_800ExtraBold',
    letterSpacing: -0.4,
  },
  content: {
    flex: 1,
  },
});
