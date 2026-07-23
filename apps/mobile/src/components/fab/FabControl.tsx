import { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Image,
  Pressable,
  StyleSheet,
  type ImageSourcePropType,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import * as Haptics from 'expo-haptics';

const frames = {
  idle: require('../../../assets/fab/frames/fab-idle-v2.png'),
  pressed: require('../../../assets/fab/frames/fab-pressed-v2.png'),
} satisfies Record<string, ImageSourcePropType>;

interface FabControlProps {
  size: number;
  onPress: () => void;
  onLongPress?: () => boolean | void;
  delayLongPress?: number;
  accessibilityLabel?: string;
  hitSlop?: number;
  style?: StyleProp<ViewStyle>;
}

export function FabControl({
  size,
  onPress,
  onLongPress,
  delayLongPress = 400,
  accessibilityLabel = 'Create',
  hitSlop,
  style,
}: FabControlProps) {
  const [source, setSource] = useState<ImageSourcePropType>(frames.idle);
  const [reduceMotion, setReduceMotion] = useState(false);
  const timers = useRef<Array<ReturnType<typeof setTimeout>>>([]);
  const running = useRef(false);
  const longPressed = useRef(false);

  const clearTimers = () => {
    timers.current.forEach(clearTimeout);
    timers.current = [];
  };

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => {
      clearTimers();
      subscription.remove();
    };
  }, []);

  const activate = () => {
    if (running.current || longPressed.current) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    if (reduceMotion) {
      setSource(frames.idle);
      onPress();
      return;
    }

    clearTimers();
    running.current = true;
    setSource(frames.idle);
    timers.current.push(setTimeout(onPress, 100));
    timers.current.push(setTimeout(() => {
      running.current = false;
      setSource(frames.idle);
    }, 160));
  };

  const hold = () => {
    if (!onLongPress || running.current) return;
    const handled = onLongPress();
    if (handled === false) return;
    longPressed.current = true;
    setSource(frames.idle);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
  };

  return (
    <Pressable
      onPress={activate}
      onLongPress={hold}
      delayLongPress={delayLongPress}
      onPressIn={() => {
        longPressed.current = false;
        if (!running.current) setSource(frames.pressed);
      }}
      onPressOut={() => {
        if (running.current) return;
        timers.current.push(setTimeout(() => {
          longPressed.current = false;
          setSource(frames.idle);
        }, 80));
      }}
      onHoverIn={() => {
        if (!running.current) setSource(frames.idle);
      }}
      onHoverOut={() => {
        if (!running.current) setSource(frames.idle);
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      hitSlop={hitSlop}
      style={[styles.control, { width: size, height: size }, style]}
    >
      <Image
        source={source}
        resizeMode="contain"
        style={{ width: size, height: size }}
        fadeDuration={0}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  control: {
    alignItems: 'center',
    justifyContent: 'center',
  },
});
