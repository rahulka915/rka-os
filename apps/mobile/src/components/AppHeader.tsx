import { ActivityIndicator, Image, StyleSheet, TouchableOpacity, View as RNView } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, Text } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { useThemeContext } from '../hooks/useThemeContext';
import { CheckCircle2, AlertTriangle } from '../icons';
import { SettingsMedallionIcon } from './icons/SettingsMedallionIcon';
import { HeaderTray } from './ui/HeaderTray';
import { riverStoneMaterial, HEADER_TOP_PADDING } from '../theme';
import { ThemeStoneButton } from './header/ThemeStoneButton';
import { HeaderStoneButton } from './header/HeaderStoneButton';
import { useBackup } from '../hooks/useBackup';
import { getThemeColors } from '../theme';

interface AppHeaderProps {
  onProfilePress?: () => void;
  onSettingsPress?: () => void;
}

export function AppHeader({ onProfilePress, onSettingsPress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();
  const palette = getThemeColors(isDark);
  const bgColor = isDark ? riverStoneMaterial.dark.base : riverStoneMaterial.light.base;
  const backup = useBackup();
  const syncLabel = !backup.isSignedIn ? 'Sign in' : backup.busy ? 'Syncing…' : backup.error ? 'Retry' : backup.lastBackupAt ? 'Synced' : 'Back up';

  return (
    // Flush, edge-to-edge header — no side margins or top gap, so it reads
    // as a regular attached bar blending seamlessly into the status bar /
    // Dynamic Island instead of a floating carved ledge with its own notch.
    <RNView>
      <HeaderTray isDark={isDark} backgroundColor={bgColor}>
        <XStack
          paddingTop={insets.top + HEADER_TOP_PADDING}
          paddingBottom="$1"
          paddingHorizontal="$4"
          alignItems="center"
          justifyContent="space-between"
        >
          <HeaderStoneButton
            isDark={isDark}
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
              onSettingsPress?.();
            }}
            accessibilityLabel="Settings"
            accessibilityHint="Open settings"
          >
            <SettingsMedallionIcon />
          </HeaderStoneButton>

          {/* Absolute overlay keeps the enlarged brand mark optically centred
              even though the sync cluster is wider than the settings control. */}
          <RNView pointerEvents="none" style={styles.logoCenter}>
            <Image
              source={require('../../assets/notification-icon.png')}
              style={[styles.logo, { tintColor: palette.textSecondary }]}
              resizeMode="contain"
              accessibilityIgnoresInvertColors
            />
          </RNView>

          {/* Right: one tactile appearance button + sync. */}
          <XStack alignItems="center" gap="$2">
            <ThemeStoneButton isDark={isDark} onToggle={toggle} />
            <TouchableOpacity
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
                if (!backup.isSignedIn) onProfilePress?.();
                else backup.backUpNow();
              }}
              disabled={backup.busy}
              accessibilityRole="button"
              accessibilityLabel={syncLabel}
            >
              <XStack alignItems="center" gap={4} minHeight={44}>
                {backup.busy
                  ? <ActivityIndicator size="small" color={isDark ? '#c5c5c5' : '#808080'} />
                  : backup.error
                    ? <AlertTriangle size={12} color="#ff5147" strokeWidth={2.2} />
                    : <CheckCircle2 size={12} color={backup.lastBackupAt ? '#34a853' : (isDark ? '#c5c5c5' : '#808080')} strokeWidth={2.5} />}
                <Text fontSize={11} fontWeight="600" color="$textTertiary">{syncLabel}</Text>
              </XStack>
            </TouchableOpacity>
          </XStack>
        </XStack>
      </HeaderTray>
    </RNView>
  );
}

const styles = StyleSheet.create({
  logoCenter: {
    position: 'absolute',
    left: '50%',
    marginLeft: -26,
    bottom: 0,
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logo: {
    width: 44,
    height: 44,
  },
});
