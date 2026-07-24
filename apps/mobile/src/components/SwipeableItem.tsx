import { useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import Reanimated, { SharedValue, useAnimatedStyle, interpolate, Extrapolation } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { spacing, radius } from '../theme';

export interface SwipeAction {
  key: string;
  icon: React.ReactNode;
  label: string;
  color: string;
  onPress: () => void;
}

interface SwipeableItemProps {
  children: React.ReactNode;
  leftAction?: SwipeAction;
  rightActions?: SwipeAction[];
}

function LeftAction({ drag, action, onPress }: {
  drag: SharedValue<number>;
  action: SwipeAction;
  onPress: () => void;
}) {
  const style = useAnimatedStyle(() => ({
    transform: [{ scale: interpolate(drag.value, [0, 80], [0.8, 1], Extrapolation.CLAMP) }],
    opacity: interpolate(drag.value, [0, 60], [0, 1], Extrapolation.CLAMP),
  }));

  return (
    <Reanimated.View style={[styles.leftAction, style]}>
      <TouchableOpacity style={[styles.actionBtn, { backgroundColor: action.color }]} onPress={onPress}>
        {action.icon}
        <Text style={styles.actionLabel}>{action.label}</Text>
      </TouchableOpacity>
    </Reanimated.View>
  );
}

function RightActions({ drag, actions, onPress }: {
  drag: SharedValue<number>;
  actions: SwipeAction[];
  onPress: (action: SwipeAction) => void;
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
      {actions.map((action) => (
        <TouchableOpacity
          key={action.key}
          style={[styles.actionBtn, { backgroundColor: action.color }]}
          onPress={() => onPress(action)}
        >
          {action.icon}
          <Text style={styles.actionLabel}>{action.label}</Text>
        </TouchableOpacity>
      ))}
    </Reanimated.View>
  );
}

export function SwipeableItem({ children, leftAction, rightActions }: SwipeableItemProps) {
  const swipeRef = useRef<SwipeableMethods>(null);
  const close = () => swipeRef.current?.close();

  const runAction = (action: SwipeAction) => {
    action.onPress();
    close();
  };

  return (
    <ReanimatedSwipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={60}
      rightThreshold={60}
      enableTrackpadTwoFingerGesture
      renderLeftActions={
        leftAction
          ? (_, drag) => <LeftAction drag={drag} action={leftAction} onPress={() => runAction(leftAction)} />
          : undefined
      }
      renderRightActions={
        rightActions && rightActions.length > 0
          ? (_, drag) => <RightActions drag={drag} actions={rightActions} onPress={runAction} />
          : undefined
      }
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
  actionLabel: { color: '#fff', fontSize: 11, fontWeight: '600', fontFamily: 'Inter_600SemiBold' },
});
