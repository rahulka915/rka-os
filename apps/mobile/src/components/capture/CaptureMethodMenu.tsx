import { useEffect } from 'react';
import { View, Text, TouchableOpacity, Pressable, StyleSheet } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withDelay,
  useReducedMotion,
} from 'react-native-reanimated';
import { itemComposerMaterial } from '../../theme/itemComposer';
import { fontSize, spacing, radius } from '../../theme/spacing';

// Heroicons available in the project
import { Pencil } from '../../icons';
import MicrophoneIcon from 'react-native-heroicons/outline/MicrophoneIcon';

interface CaptureMethodMenuProps {
  visible: boolean;
  onSelectType: () => void;
  onSelectSpeak: () => void;
  onDismiss: () => void;
}

const ITEM_HEIGHT = 52;
const MENU_WIDTH = 160;

function MenuItem({
  label,
  icon,
  onPress,
  delay,
  visible,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  delay: number;
  visible: boolean;
}) {
  const mat = itemComposerMaterial.dark;
  const reducedMotion = useReducedMotion();

  const opacity = useSharedValue(0);
  const translateY = useSharedValue(reducedMotion ? 0 : 12);

  useEffect(() => {
    if (visible) {
      opacity.value = withDelay(delay, withTiming(1, { duration: reducedMotion ? 0 : 180 }));
      if (!reducedMotion) {
        translateY.value = withDelay(delay, withTiming(0, { duration: 180 }));
      }
    } else {
      opacity.value = withTiming(0, { duration: 120 });
      if (!reducedMotion) {
        translateY.value = withTiming(12, { duration: 120 });
      }
    }
  }, [visible, delay, opacity, translateY, reducedMotion]);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  return (
    <Animated.View style={style}>
      <TouchableOpacity
        onPress={onPress}
        style={[
          styles.menuItem,
          { backgroundColor: mat.surfaceRaised, borderColor: mat.rim },
        ]}
        accessibilityRole="button"
        accessibilityLabel={label}
        hitSlop={4}
      >
        <View style={styles.menuItemIcon}>{icon}</View>
        <Text style={[styles.menuItemLabel, { color: mat.platinum }]}>{label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

export function CaptureMethodMenu({
  visible,
  onSelectType,
  onSelectSpeak,
  onDismiss,
}: CaptureMethodMenuProps) {
  const mat = itemComposerMaterial.dark;

  const scrimOpacity = useSharedValue(0);
  useEffect(() => {
    scrimOpacity.value = withTiming(visible ? 1 : 0, { duration: 150 });
  }, [visible, scrimOpacity]);

  const scrimStyle = useAnimatedStyle(() => ({
    opacity: scrimOpacity.value,
    pointerEvents: visible ? 'auto' : 'none',
  } as any));

  if (!visible) return null;

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
      {/* Dim scrim — tapping dismisses */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.scrim, scrimStyle]}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onDismiss} accessibilityLabel="Dismiss menu" />
      </Animated.View>

      {/* Menu stack — bottom-right, rising above FAB */}
      <View style={styles.menuAnchor} pointerEvents="box-none">
        <View style={[styles.menuStack, { width: MENU_WIDTH }]} pointerEvents="box-none">
          <MenuItem
            label="Speak"
            icon={<MicrophoneIcon size={18} color={mat.accent} strokeWidth={1.75} />}
            onPress={onSelectSpeak}
            delay={0}
            visible={visible}
          />
          <MenuItem
            label="Type"
            icon={<Pencil size={18} color={mat.platinum} strokeWidth={1.75} />}
            onPress={onSelectType}
            delay={60}
            visible={visible}
          />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  scrim: {
    backgroundColor: 'rgba(0,0,0,0.28)',
  },
  menuAnchor: {
    position: 'absolute',
    bottom: 80,
    right: 20,
    alignItems: 'flex-end',
  },
  menuStack: {
    gap: spacing[2],
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    height: ITEM_HEIGHT,
    borderRadius: radius.card,
    borderWidth: 1,
    paddingHorizontal: spacing[4],
    gap: spacing[3],
  },
  menuItemIcon: {
    width: 24,
    alignItems: 'center',
  },
  menuItemLabel: {
    fontSize: fontSize.base,
    fontWeight: '500',
  },
});
