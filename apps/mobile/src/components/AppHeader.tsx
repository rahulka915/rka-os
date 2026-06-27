import { TouchableOpacity } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { XStack, Text, View } from 'tamagui';
import * as Haptics from 'expo-haptics';
import { AvatarCompanion } from './AvatarCompanion';
import { useThemeContext } from '../hooks/useThemeContext';
import { CheckCircle2, Moon, Sun } from '../icons';

interface AppHeaderProps {
  onProfilePress?: () => void;
}

export function AppHeader({ onProfilePress }: AppHeaderProps) {
  const insets = useSafeAreaInsets();
  const { isDark, toggle } = useThemeContext();

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

      {/* Logo (centre) */}
      <Text
        fontSize={13}
        fontWeight="800"
        color="$text"
        style={{ letterSpacing: 2, textTransform: 'uppercase' }}
      >
        RKA OS
      </Text>

      {/* Right: dark toggle + sync */}
      <XStack alignItems="center" gap="$3">
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
