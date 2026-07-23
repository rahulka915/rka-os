import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  withDelay,
  runOnJS,
  interpolate,
  interpolateColor,
  Extrapolate,
} from 'react-native-reanimated';
import {
  GestureDetector,
  Gesture,
} from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';
import { Check, Archive } from '../icons';
import {
  LacquerDiscControl,
  LACQUER_DISC_COMPLETION_DURATION,
} from './ui/LacquerDiscControl';
import { BlockedBadge } from './BlockedBadge';
import { getThemeColors } from '../theme';
import type { Item } from '../db/types';

interface TaskSwipeItemProps {
  item: Item;
  isDark: boolean;
  index: number;
  onComplete: (id: string) => void;
  onPress?: (item: Item) => void;
  onArchive?: (id: string) => void;
  onLongPress?: (id: string) => void;
  selectionMode?: boolean;
  selected?: boolean;
  onToggleSelect?: (id: string) => void;
  // When set, this task is waiting on `blockedByTitle` — the tick/swipe
  // animations skip straight to calling onComplete (still, immediately, no
  // animation) so the parent's own blocked-check can show why, without a
  // completion animation playing for something that didn't actually complete.
  blockedByTitle?: string;
  // Suppresses the text badge only (enforcement/dimming still applies) — set
  // when a DependencyConnector is already rendered above this row, so the
  // blocker is visually obvious without a redundant "Blocked by X" label.
  hideBlockedBadge?: boolean;
}

// Spring config
const SPRING_CONFIG = {
  damping: 10,
  mass: 1,
  overshootClamping: false,
};

const SWIPE_THRESHOLD = 80;

// Alpha-blends a hex color for the swipe-reveal background — RN has no native rgba(#hex, a).
function hexToRgba(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

export function TaskSwipeItem({
  item,
  isDark,
  index,
  onComplete,
  onPress,
  onArchive,
  onLongPress,
  selectionMode = false,
  selected = false,
  onToggleSelect,
  blockedByTitle,
  hideBlockedBadge = false,
}: TaskSwipeItemProps) {
  const palette = getThemeColors(isDark);
  const [discCompleted, setDiscCompleted] = useState(false);
  const blocked = !!blockedByTitle;

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

  // Gesture handling — left swipe completes (existing), right swipe archives
  // (onArchive was previously accepted but never wired to any gesture, so a
  // single item could only be archived by long-pressing into multi-select
  // mode first; this makes it a direct one-gesture action like Complete).
  const panGesture = Gesture.Pan()
    .enabled(!selectionMode)
    .onUpdate((event) => {
      if (event.translationX < 0 || onArchive) {
        translateX.value = event.translationX;
      }
    })
    .onEnd((event) => {
      const pastCompleteThreshold =
        event.translationX < -SWIPE_THRESHOLD || event.velocityX < -500;
      const shouldComplete = pastCompleteThreshold && !blocked;
      const shouldArchive =
        !!onArchive && (event.translationX > SWIPE_THRESHOLD || event.velocityX > 500);

      if (pastCompleteThreshold && blocked) {
        // Don't play the collapse animation for a completion that isn't
        // actually going to happen — spring back and let the parent's own
        // blocked-check (same as the disc tap) explain why.
        translateX.value = withSpring(0, SPRING_CONFIG);
        runOnJS(Haptics.notificationAsync)(Haptics.NotificationFeedbackType.Warning);
        runOnJS(onComplete)(item.id);
      } else if (shouldComplete) {
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
      } else if (shouldArchive) {
        translateX.value = withTiming(300, { duration: 180 });
        if (itemHeight.value !== null) {
          itemHeight.value = withTiming(0, { duration: 200 });
        }
        itemOpacity.value = withTiming(0, { duration: 150 });

        runOnJS(setTimeout)(() => {
          runOnJS(onArchive!)(item.id);
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

  const transparentGreen = hexToRgba(palette.green, 0);
  const solidGreen = hexToRgba(palette.green, 1);
  const transparentMuted = hexToRgba(palette.textTertiary, 0);
  const solidMuted = hexToRgba(palette.textTertiary, 1);

  const animatedTaskStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
  }));

  const animatedBgStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      backgroundColor: interpolateColor(progress, [0, 1], [transparentGreen, solidGreen]),
      opacity: progress,
    };
  });

  const animatedLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, -SWIPE_THRESHOLD * 0.8],
      [0, 1],
      Extrapolate.CLAMP
    ),
  }));

  const animatedArchiveBgStyle = useAnimatedStyle(() => {
    const progress = interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD],
      [0, 1],
      Extrapolate.CLAMP
    );
    return {
      backgroundColor: interpolateColor(progress, [0, 1], [transparentMuted, solidMuted]),
      opacity: progress,
    };
  });

  const animatedArchiveLabelStyle = useAnimatedStyle(() => ({
    opacity: interpolate(
      translateX.value,
      [0, SWIPE_THRESHOLD * 0.8],
      [0, 1],
      Extrapolate.CLAMP
    ),
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

          {onArchive && (
            <Animated.View style={[s.swipeBgArchive, animatedArchiveBgStyle]}>
              <Animated.View style={animatedArchiveLabelStyle}>
                <Archive size={16} color="#fff" strokeWidth={1.75} />
                <Text style={s.swipeLabel}>Archive</Text>
              </Animated.View>
            </Animated.View>
          )}

          {/* Task row — dark mode uses the same fillStrong/separatorStrong
              card treatment as Home/Menu/Areas so it reads as a distinct row
              against the near-black background; light mode keeps the plain
              flat surface (no border needed there). */}
          <Animated.View
            style={[
              s.taskRow,
              isDark
                ? { backgroundColor: palette.fillStrong, borderWidth: StyleSheet.hairlineWidth, borderColor: palette.separatorStrong }
                : { backgroundColor: palette.surface },
              animatedTaskStyle,
            ]}
          >
            {selectionMode ? (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={`Select ${item.title}`}
                accessibilityState={{ selected }}
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onToggleSelect?.(item.id);
                }}
                style={s.selectionTarget}
              >
                <View
                  style={[
                    s.selectionIndicator,
                    selected
                      ? { borderColor: palette.primary, backgroundColor: palette.primary }
                      : { borderColor: palette.textMuted },
                  ]}
                >
                  {selected ? <Check size={16} color="#fff" strokeWidth={3} /> : null}
                </View>
              </Pressable>
            ) : (
              <LacquerDiscControl
                isCompleted={discCompleted}
                accessibilityLabel={blocked ? `${item.title}, blocked by ${blockedByTitle}` : `Complete ${item.title}`}
                onToggle={() => {
                  if (discCompleted) return;
                  if (blocked) {
                    onComplete(item.id);
                    return;
                  }
                  setDiscCompleted(true);
                  setTimeout(() => onComplete(item.id), LACQUER_DISC_COMPLETION_DURATION);
                }}
              />
            )}
            <Pressable
              style={s.taskContent}
              disabled={selectionMode ? !onToggleSelect : !onPress}
              onPress={() => {
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                if (selectionMode) onToggleSelect?.(item.id);
                else onPress?.(item);
              }}
            >
              <Text
                style={[s.taskTitle, { color: blocked ? palette.textMuted : palette.text }]}
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
              {blocked && !hideBlockedBadge && <BlockedBadge isDark={isDark} title={blockedByTitle!} />}
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
  swipeBgArchive: {
    ...StyleSheet.absoluteFill,
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingLeft: 20,
  },
  swipeLabel: {
    fontSize: 12,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
  selectionTarget: {
    width: 44,
    height: 44,
    flexShrink: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  selectionIndicator: {
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  taskContent: {
    flex: 1,
  },
  taskTitle: {
    fontSize: 16,
    fontWeight: '600',
    fontFamily: 'Inter_600SemiBold',
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
    fontFamily: 'Inter_300Light',
  },
});
