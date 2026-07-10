import { StyleSheet, TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, Text, View } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AvatarCompanion } from './AvatarCompanion';
import { useThemeContext } from '../hooks/useThemeContext';
import { CheckCircle2, Moon, Sun } from '../icons';
import { usePersistentTimerState } from '../hooks/usePersistentTimerState';

interface AppHeaderProps {
  onProfilePress?: () => void;
}

export function AppHeader({ onProfilePress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();
  const { timers, isHidden, restorePresentation } = usePersistentTimerState();
  const showTimerRestore = isHidden && timers.length > 0;

  return (
    <XStack
      paddingTop={insets.top + 4}
      paddingBottom="$2"
      paddingHorizontal="$4"
      alignItems="center"
      justifyContent="space-between"
      backgroundColor="$bg"
    >
      {/* Avatar (left) */}
      <AvatarCompanion size="sm" onPress={onProfilePress} />

      {/* Logo (centre) — understated, not competing with the bold hero
          greeting directly below it */}
      <Text
        fontSize={12}
        fontWeight="600"
        color="$textSecondary"
        style={{ letterSpacing: 1.2, textTransform: 'uppercase' }}
      >
        RKA OS
      </Text>

      {/* Right: dark toggle + sync */}
      <XStack alignItems="center" gap="$3">
        {showTimerRestore ? (
          <TouchableOpacity
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              restorePresentation();
            }}
            hitSlop={14}
            accessibilityLabel="Show hidden timer"
            accessibilityRole="button"
            style={styles.timerRestoreButton}
          >
            <View style={[styles.timerRestoreDot, { backgroundColor: isDark ? '#ff9f5a' : '#ff9500' }]} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity
          onPress={() => { Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light); toggle(); }}
          hitSlop={12}
        >
          {isDark
            ? <Sun size={16} color="rgba(242,242,242,0.50)" strokeWidth={1.5} />
            : <Moon size={16} color="rgba(13,13,13,0.35)" strokeWidth={1.5} />
          }
        </TouchableOpacity>
        <XStack alignItems="center" gap={4}>
          <CheckCircle2 size={12} color="#34a853" strokeWidth={2.5} />
          <Text fontSize={11} fontWeight="600" color="$textTertiary">Synced</Text>
        </XStack>
      </XStack>
    </XStack>
  );
}

const styles = StyleSheet.create({
  timerRestoreButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,149,0,0.10)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,149,0,0.18)',
  },
  timerRestoreDot: {
    width: 8,
    height: 8,
    borderRadius: 999,
  },
});
