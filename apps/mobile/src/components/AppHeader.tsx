import { View as RNView, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { SettingsMedallionIcon } from './icons/SettingsMedallionIcon';
import { ThemeToggleIcon } from './header/ThemeToggleIcon';
import { SyncIndicator } from './header/SyncIndicator';

// header-v2 icon pack state mapping (see assets/icons/header-v2/README.md).
function inboxIllustration(inboxCount: number) {
  if (inboxCount === 0) return require('../../assets/icons/header-v2/inbox-empty.png');
  if (inboxCount > 10) return require('../../assets/icons/header-v2/inbox-full.png');
  return require('../../assets/icons/header-v2/inbox-active.png');
}

interface AppHeaderProps {
  onSettingsPress?: () => void;
  onInboxPress?: () => void;
  inboxCount?: number;
}

function press(fn?: () => void) {
  return () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    fn?.();
  };
}

export function AppHeader({ onSettingsPress, onInboxPress, inboxCount = 0 }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();
  const palette = getThemeColors(isDark);

  return (
    <RNView style={[styles.row, { paddingTop: insets.top + 10 }]}>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={press(onSettingsPress)}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <SettingsMedallionIcon size={34} />
      </TouchableOpacity>

      <RNView style={[styles.wordmarkGroup, { top: insets.top + 20 }]}>
        <Image
          source={require('../../assets/branding/rka-logo-mark-transparent.png')}
          style={styles.wordmarkLogo}
          resizeMode="contain"
          accessibilityIgnoresInvertColors
        />
        <SyncIndicator />
      </RNView>

      <RNView style={styles.right}>
        <TouchableOpacity
          style={styles.circleButton}
          onPress={press(toggle)}
          accessibilityRole="button"
          accessibilityLabel={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <ThemeToggleIcon isDark={isDark} size={34} />
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.inboxButton}
          onPress={press(onInboxPress)}
          accessibilityRole="button"
          accessibilityLabel="Inbox"
        >
          <Image
            source={inboxIllustration(inboxCount)}
            style={styles.inboxIllustration}
            resizeMode="contain"
            accessibilityIgnoresInvertColors
          />
          {inboxCount > 0 && (
            <RNView style={[styles.badge, { backgroundColor: palette.badgeAccent }]}>
              <Text style={styles.badgeText}>{inboxCount}</Text>
            </RNView>
          )}
        </TouchableOpacity>
      </RNView>
    </RNView>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  right: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  wordmarkGroup: {
    // Absolute + left:0/right:0 centers on the row's true midpoint,
    // independent of the settings button (44pt) and right-side group
    // (96pt) having different widths — flex space-between alone would
    // center this between their inner edges instead, which visibly skews
    // it left of center. `top` is set inline (insets.top + 20) rather than
    // top:0/bottom:0 stretch-centering — RN doesn't inset absolute children
    // by the parent's padding, so stretching across the full row (which
    // includes the big safe-area paddingTop) centered this well above the
    // button row instead of level with it.
    position: 'absolute',
    left: 0,
    right: 0,
    height: 44,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  circleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkLogo: {
    width: 44,
    height: 44,
  },
  settingsButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxIllustration: {
    // Larger than settings/theme's 34pt artwork — the satchel shape's own
    // baked-in padding (now trimmed/normalized, but still a flatter aspect
    // ratio than the circular medallions) reads as smaller at equal size,
    // so it needs to run bigger to carry equal visual weight in the row.
    width: 42,
    height: 42,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
});
