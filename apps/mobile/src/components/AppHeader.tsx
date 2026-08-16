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
    <RNView style={[styles.row, { paddingTop: insets.top + 14 }]}>
      <TouchableOpacity
        style={styles.settingsButton}
        onPress={press(onSettingsPress)}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <SettingsMedallionIcon size={34} />
      </TouchableOpacity>

      <RNView style={styles.wordmarkGroup}>
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
    flexDirection: 'row',
    alignItems: 'center',
  },
  circleButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmarkLogo: {
    width: 30,
    height: 30,
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
