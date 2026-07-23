import type { ReactNode } from 'react';
import {
  Pressable,
  StyleSheet,
  View,
  type AccessibilityRole,
  type AccessibilityState,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

interface HeaderStoneButtonProps {
  children: ReactNode;
  isDark: boolean;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  accessibilityRole?: AccessibilityRole;
  accessibilityState?: AccessibilityState;
  testID?: string;
}

export function HeaderStoneButton({
  children,
  isDark,
  onPress,
  accessibilityLabel,
  accessibilityHint,
  accessibilityRole = 'button',
  accessibilityState,
  testID,
}: HeaderStoneButtonProps) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole={accessibilityRole}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      accessibilityState={accessibilityState}
      hitSlop={2}
      style={({ pressed }) => [
        styles.pressable,
        {
          shadowColor: isDark ? '#000000' : '#71695b',
          shadowOpacity: isDark ? 0.5 : 0.2,
        },
        pressed && styles.pressed,
      ]}
    >
      <LinearGradient
        colors={isDark
          ? ['#353944', '#1b1e26', '#0d0f14']
          : ['#fffdf6', '#ddd7ca', '#aaa397']}
        locations={[0, 0.56, 1]}
        start={{ x: 0.25, y: 0 }}
        end={{ x: 0.75, y: 1 }}
        style={[
          styles.face,
          { borderColor: isDark ? 'rgba(255,255,255,0.11)' : 'rgba(70,58,43,0.18)' },
        ]}
      >
        <LinearGradient
          pointerEvents="none"
          colors={isDark
            ? ['rgba(255,255,255,0.13)', 'rgba(255,255,255,0)']
            : ['rgba(255,255,255,0.72)', 'rgba(255,255,255,0)']}
          style={styles.upperLight}
        />
        <View
          pointerEvents="none"
          style={[
            styles.innerRing,
            { borderColor: isDark ? 'rgba(0,0,0,0.46)' : 'rgba(91,78,59,0.18)' },
          ]}
        />
        {children}
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: {
    width: 44,
    height: 44,
    borderRadius: 22,
    shadowOffset: { width: 0, height: 4 },
    shadowRadius: 7,
    elevation: 5,
  },
  pressed: {
    transform: [{ scale: 0.96 }],
    shadowOffset: { width: 0, height: 2 },
    shadowRadius: 3,
  },
  face: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  upperLight: {
    position: 'absolute',
    left: 5,
    right: 5,
    top: 3,
    height: 17,
    borderRadius: 12,
  },
  innerRing: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 22,
    borderWidth: 1,
  },
});
