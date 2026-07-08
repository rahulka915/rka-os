import React, { useCallback, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  interpolate,
  Extrapolate,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Check } from '../icons';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';

interface TaskSwipeItemProps {
  item: Item;
  isDark: boolean;
  index: number;
  onComplete: (id: string) => void;
  onArchive?: (id: string) => void;
  onLongPress?: (id: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
}

// Spring config
const SPRING_CONFIG = {
  damping: 10,
  mass: 1,
  overshootClamping: false,
};

const SWIPE_THRESHOLD = 80;

export function TaskSwipeItem({
  item,
  isDark,
  index,
  onComplete,
  onArchive,
  onLongPress,
  selectionMode = false,
  selected = false,
  onToggleSelect,
}: TaskSwipeItemProps) {
  const palette = getThemeColors(isDark);

  // Animations
  const translateX = useSharedValue(0);
  // null = auto height (natural content size); only pinned to a measured pixel value right
  // before the collapse-to-0 animation on complete. A hardcoded starting height here caused
  // clipping once the row grew taller (bigger checkbox/padding) than the guessed constant.
  const itemHeight = useSharedValue<number | null>(null);
  const itemOpacity = useSharedValue(1);
  const enterOffsetY = useSharedValue(20);
  const enterOpacity = useSharedValue(0);

  // Entrance animation (staggered)
  useEffect(() => {
    const delayMs = index * 50;

    enterOpacity.value = withDelay(
      delayMs,
      withTiming(1, { duration: 200 })
    );

    enterOffsetY.value = withDelay(
      delayMs,
      withSpring(0, SPRING_CONFIG)
    );
  }, [index]);

  // Gesture handling
  const panGesture = Gesture.Pan()
    .enabled(!selectionMode)
    .onUpdate((event) => {
      if (event.translationX < 0) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const shouldComplete =
        event.translationX < -SWIPE_THRESHOLD || event.velocityX < -500;

      if (shouldComplete) {
        translateX.value = withTiming(-300, { duration: 180 });
        if (itemHeight.value !== null) {
          itemHeight.value = withTiming(0, { duration: 200 });
        }
        itemOpacity.value = withTiming(0, { duration: 150 });

        runOnJS(setTimeout)(() => {
          runOnJS(onComplete)(item.id);
        }, 180);

        runOnJS(Haptics.notificationAsync)(
          Haptics.NotificationFeedbackType.Success
        );
      } else {
        translateX.value = withSpring(0, SPRING_CONFIG);
        runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Light);
      }
    });

  const longPressGesture = Gesture.LongPress()
    .minDuration(400)
    .onStart(() => {
      runOnJS(Haptics.impactAsync)(Haptics.ImpactFeedbackStyle.Heavy);
      if (onLongPress) runOnJS(onLongPress)(item.id);
    });

  // Race, not Simultaneous — a horizontal drag should claim the touch as a swipe and never
  // also fire the long-press; composing both through GestureDetector avoids the legacy
  // TouchableOpacity + RNGH conflict that wrapping this component externally would hit.
  const composedGesture = Gesture.Race(panGesture, longPressGesture);

  const bgColor = interpolate(
    translateX.value,
    [0, -SWIPE_THRESHOLD],
    [0, 1],
    Extrapolate.CLAMP
  );

  const completeLabelOpacity = interpolate(
    translateX.value,
    [0, -SWIPE_THRESHOLD * 0.8],
    [0, 1],
    Extrapolate.CLAMP
  );

  const animatedTaskStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => ({
    backgroundColor: `rgba(52, 171, 83, ${bgColor})`,
    opacity: bgColor,
  }));

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: completeLabelOpacity,
  }));

  const animatedEnterStyle = useAnimatedStyle(() => ({
    opacity: enterOpacity.value,
    transform: [{ translateY: enterOffsetY.value }],
  }));

  const animatedContainerStyle = useAnimatedStyle(() => ({
    height: itemHeight.value === null ? undefined : itemHeight.value,
    opacity: itemOpacity.value,
  }));

  return (
    <Animated.View
      style={[
        s.container,
        animatedEnterStyle,
        animatedContainerStyle,
      ]}
      onLayout={(e) => {
        if (itemHeight.value === null) itemHeight.value = e.nativeEvent.layout.height;
      }}
    >
      <GestureDetector gesture={composedGesture}>
        <Animated.View style={s.swipeContainer}>
          {/* Background reveal */}
          <Animated.View style={[s.swipeBg, animatedBgStyle]}>
            <Animated.View style={animatedLabelStyle}>
              <Check size={16} color="#fff" strokeWidth={2.5} />
              <Text style={s.swipeLabel}>Complete</Text>
            </Animated.View>
          </Animated.View>

          {/* Task row */}
          <Animated.View
            style={[
              s.taskRow,
              { backgroundColor: palette.surface },
              animatedTaskStyle,
            ]}
          >
            <Pressable
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (selectionMode) {
                  onToggleSelect?.(item.id);
                } else {
                  onComplete(item.id);
                }
              }}
              hitSlop={8}
              style={[
                s.checkbox,
                selectionMode && selected
                  ? { borderColor: palette.primary, backgroundColor: palette.primary }
                  : { borderColor: palette.textMuted },
              ]}
            >
              {selectionMode && selected ? (
                <Check size={16} color="#fff" strokeWidth={3} />
              ) : null}
            </Pressable>
            <Pressable
              style={s.taskContent}
              disabled={!selectionMode}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                onToggleSelect?.(item.id);
              }}
            >
              <Text
                style={[s.taskTitle, { color: palette.text }]}
                numberOfLines={1}
              >
                {item.title}
              </Text>
              {item.notes && (
                <Text
                  style={[s.taskNotes, { color: palette.textSecondary }]}
                  numberOfLines={1}
                >
                  {item.notes}
                </Text>
              )}
            </Pressable>
            {!selectionMode ? (
              <Text style={[s.chevron, { color: palette.textMuted }]}>›</Text>
            ) : null}
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
    borderRadius: 999, // fully rounded — RN clips to a pill shape once radius exceeds half the row height
    marginHorizontal: 16,
    marginBottom: 8,
  },
  swipeContainer: {
    position: 'relative',
    flex: 1,
  },
  swipeBg: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingRight: 20,
  },
  swipeLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
    marginLeft: 4,
  },
  taskRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 14,
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskNotes: {
    fontSize: 12,
    fontWeight: '400',
    marginTop: 2,
  },
  chevron: {
    fontSize: 18,
    fontWeight: '300',
  },
});
