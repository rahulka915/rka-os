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
}: TaskSwipeItemProps) {
  const palette = getThemeColors(isDark);

  // Animations
  const translateX = useSharedValue(0);
  const itemHeight = useSharedValue(64);
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
        itemHeight.value = withTiming(0, { duration: 200 });
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

  return (
    <Animated.View
      style={[
        s.container,
        animatedEnterStyle,
        { height: itemHeight, opacity: itemOpacity },
      ]}
    >
      <GestureDetector gesture={panGesture}>
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
            <View
              style={[
                s.checkbox,
                {
                  borderColor: palette.textMuted,
                },
              ]}
            />
            <View style={s.taskContent}>
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
            </View>
            <Text style={[s.chevron, { color: palette.textMuted }]}>›</Text>
          </Animated.View>
        </Animated.View>
      </GestureDetector>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  container: {
    overflow: 'hidden',
  },
  swipeContainer: {
    position: 'relative',
    flex: 1,
  },
  swipeBg: {
    ...StyleSheet.absoluteFillObject,
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
    paddingVertical: 12,
    gap: 12,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    flexShrink: 0,
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '500',
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
