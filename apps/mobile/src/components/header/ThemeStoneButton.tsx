import * as Haptics from 'expo-haptics';
import { Moon, Sun } from '../../icons';
import { HeaderStoneButton } from './HeaderStoneButton';

interface ThemeStoneButtonProps {
  isDark: boolean;
  onToggle: () => void;
}

export function ThemeStoneButton({ isDark, onToggle }: ThemeStoneButtonProps) {
  return (
    <HeaderStoneButton
      isDark={isDark}
      onPress={() => {
        Haptics.selectionAsync().catch(() => {});
        onToggle();
      }}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Dark appearance' : 'Light appearance'}
      accessibilityHint={`Switch to ${isDark ? 'light' : 'dark'} appearance`}
      testID="theme-stone-button"
    >
      {isDark
        ? <Moon size={20} color="#aeb8ff" strokeWidth={1.8} />
        : <Sun size={21} color="#b97822" strokeWidth={1.8} />}
    </HeaderStoneButton>
  );
}
