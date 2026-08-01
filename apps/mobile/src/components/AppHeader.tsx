import { View as RNView, Text, TouchableOpacity, Image, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { getThemeColors } from '../theme';
import { Settings, Moon, Sun } from '../icons';

// Same three illustration states InboxScrollCard uses on Home's Today
// view — kept in sync here so the header button always matches whatever
// that card would show, not a generic icon.
function inboxIllustration(inboxCount: number) {
  if (inboxCount === 0) return require('../../assets/illustrations/inbox/inbox-empty.png');
  if (inboxCount > 10) return require('../../assets/illustrations/inbox/inbox-full.png');
  return require('../../assets/illustrations/inbox/inbox-active.png');
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
        style={[styles.circleButton, { backgroundColor: palette.fill, borderColor: palette.separator }]}
        onPress={press(onSettingsPress)}
        accessibilityRole="button"
        accessibilityLabel="Settings"
      >
        <Settings size={18} color={palette.textSecondary} strokeWidth={1.75} />
      </TouchableOpacity>

      <Text style={[styles.wordmark, { color: palette.textSecondary }]}>RKA</Text>

      <RNView style={styles.right}>
        <TouchableOpacity
          style={[styles.circleButton, { backgroundColor: palette.fill, borderColor: palette.separator }]}
          onPress={press(toggle)}
          accessibilityRole="button"
          accessibilityLabel="Toggle dark mode"
        >
          {isDark ? (
            <Moon size={18} color="#9DB4FF" strokeWidth={1.75} />
          ) : (
            <Sun size={18} color={palette.textSecondary} strokeWidth={1.75} />
          )}
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
            <RNView style={styles.badge}>
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
    gap: 8,
  },
  circleButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wordmark: {
    fontFamily: 'Georgia',
    fontStyle: 'italic',
    fontWeight: '700',
    fontSize: 15,
    letterSpacing: 0.5,
  },
  inboxButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inboxIllustration: {
    width: 34,
    height: 34,
  },
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#D9506B',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    color: '#ffffff',
    fontSize: 10,
    fontWeight: '700',
  },
});
