import { ReactNode } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { ChevronLeft } from '../icons';

interface LensSurfaceProps {
  title: string;
  icon?: ReactNode;
  onBack?: () => void;
  headerRight?: ReactNode;
  contextBar?: ReactNode;
  children: ReactNode;
  // 'editorial' = Newsreader serif, reserved for top-level editorial screen
  // titles (Tasks, Inbox) per app-wide-refinement-v1. Every other Lens
  // destination keeps the default Inter title.
  titleStyle?: 'default' | 'editorial';
}

// Shared chrome-less container for "Lens" destinations (Projects, Workouts, Medications, ...).
// No border, no corner radius, no close button — these are pushed screens, not sheets.
export function LensSurface({ title, icon, onBack, headerRight, contextBar, children, titleStyle = 'default' }: LensSurfaceProps) {
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
          {icon}
          <Text
            style={[
              titleStyle === 'editorial' ? styles.titleEditorial : styles.title,
              { color: palette.text },
            ]}
            numberOfLines={1}
          >
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
  titleEditorial: {
    fontSize: 30,
    fontFamily: 'Newsreader_600SemiBold',
    letterSpacing: -0.3,
  },
  content: {
    flex: 1,
  },
});
