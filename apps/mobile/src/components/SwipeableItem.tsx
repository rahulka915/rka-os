import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { colors, spacing, radius } from '../theme';
import { Check, Archive, ArrowRight } from '../icons';

interface SwipeableItemProps {
  children: React.ReactNode;
  onActivate?: () => void;
  onArchive?: () => void;
  onComplete?: () => void;
}

function LeftAction({ drag, onPress }: { drag: SharedValue<number>; onPress: () => void }) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(drag.value, [0, 80], [0.8, 1], Extrapolation.CLAMP) }],
    opacity: interpolate(drag.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={[styles.leftAction, style]}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.green }]} onPress={onPress}>
        <Check size={20} color="#fff" strokeWidth={2.5} />
        <Text style={styles.actionLabel}>Activate</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function RightActions({ drag, onArchive, onComplete }: {
  drag: SharedValue<number>;
  onArchive: () => void;
  onComplete?: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(drag.value, [-80, 0], [1, 0.8], Extrapolation.CLAMP) }],
    opacity: interpolate(drag.value, [-60, 0], [1, 0], Extrapolation.CLAMP),
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
    gap: spacing[2],
    paddingRight: spacing[2],
    marginBottom: spacing[2],
  }));

  return (
    <Reanimated.View style={style}>
      {onComplete && (
        <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.blue }]} onPress={onComplete}>
          <ArrowRight size={20} color="#fff" strokeWidth={2.5} />
          <Text style={styles.actionLabel}>Done</Text>
        </TouchableOpacity>
      )}
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: colors.textTertiary }]} onPress={onArchive}>
        <Archive size={20} color="#fff" strokeWidth={1.5} />
        <Text style={styles.actionLabel}>Archive</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

export function SwipeableItem({ children, onActivate, onArchive, onComplete }: SwipeableItemProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();

  const handleActivate = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onActivate?.();
    close();
  };

  const handleArchive = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    onArchive?.();
    close();
  };

  const handleComplete = () => {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    onComplete?.();
    close();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      enableTrackpadTwoFingerGesture
      renderLeftActions={onActivate ? (_, drag) => <LeftAction drag={drag} onPress={handleActivate} /> : undefined}
      renderRightActions={(_, drag) => <RightActions drag={drag} onArchive={handleArchive} onComplete={onComplete ? handleComplete : undefined} />}
      onSwipeableWillOpen={() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)}
    >
      {children}
    </ReanimatedSwipeable>
  );
}

const styles = StyleSheet.create({
  leftAction: {
    justifyContent: 'center',
    paddingLeft: spacing[2],
    marginBottom: spacing[2],
  },
  actionBtn: {
    justifyContent: 'center',
    alignItems: 'center',
    width: 72,
    borderRadius: radius.card,
    paddingVertical: spacing[3],
    gap: 4,
  },
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '600' },
});
