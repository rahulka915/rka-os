import { useEffect, useRef } from 'react';
import { Animated, PanResponder, StyleSheet, View } from 'react-native';
import * as Haptics from 'expo-haptics';
import { Moon, Sun } from '../../icons';

interface Props {
  isDark: boolean;
  onToggle: () => void;
}

const WIDTH = 68;
const THUMB = 28;
const TRAVEL = WIDTH - THUMB - 6;

export function ThemeSlider({ isDark, onToggle }: Props) {
  const thumbX = useRef(new Animated.Value(isDark ? TRAVEL : 0)).current;
  const initialDark = useRef(isDark);
  const selectedDark = useRef(isDark);
  const changedDuringGesture = useRef(false);

  useEffect(() => {
    selectedDark.current = isDark;
    Animated.spring(thumbX, {
      toValue: isDark ? TRAVEL : 0,
      useNativeDriver: true,
      stiffness: 360,
      damping: 30,
      mass: 0.65,
    }).start();
  }, [isDark, thumbX]);

  const select = (nextDark: boolean) => {
    if (selectedDark.current === nextDark) return;
    selectedDark.current = nextDark;
    changedDuringGesture.current = true;
    Haptics.selectionAsync().catch(() => {});
    onToggle();
  };

  const responder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dx) > 3,
    onPanResponderGrant: () => {
      initialDark.current = selectedDark.current;
      changedDuringGesture.current = false;
    },
    onPanResponderMove: (_, gesture) => {
      if (gesture.dx > 10) select(true);
      else if (gesture.dx < -10) select(false);
    },
    onPanResponderRelease: (_, gesture) => {
      if (Math.abs(gesture.dx) < 4) select(!selectedDark.current);
      if (changedDuringGesture.current && initialDark.current !== selectedDark.current) {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Soft).catch(() => {});
      }
    },
  })).current;

  return (
    <View
      {...responder.panHandlers}
      style={[styles.track, { backgroundColor: isDark ? 'rgba(43,127,240,0.16)' : 'rgba(255,159,90,0.16)' }]}
      accessibilityRole="switch"
      accessibilityState={{ checked: isDark }}
      accessibilityLabel={isDark ? 'Dark appearance' : 'Light appearance'}
      accessibilityHint="Tap or slide to change appearance"
    >
      <Animated.View
        pointerEvents="none"
        style={[
          styles.thumb,
          {
            backgroundColor: isDark ? '#252638' : '#fff8eb',
            shadowColor: isDark ? '#6D6DD6' : '#ff9500',
            transform: [{ translateX: thumbX }],
          },
        ]}
      />
      <Sun size={14} color={isDark ? 'rgba(242,237,230,0.35)' : '#ff9500'} strokeWidth={1.8} />
      <Moon size={14} color={isDark ? '#8f9cff' : 'rgba(60,60,67,0.34)'} strokeWidth={1.8} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    width: WIDTH,
    height: 44,
    borderRadius: 22,
    paddingHorizontal: 9,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    overflow: 'visible',
  },
  thumb: {
    position: 'absolute',
    left: 3,
    top: (44 - THUMB) / 2,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    shadowOpacity: 0.45,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    zIndex: 0,
  },
});
