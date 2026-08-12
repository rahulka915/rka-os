import { useMemo, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import * as Haptics from 'expo-haptics';

interface TimelineMarkerProps {
  top: number;
  left: `${number}%`;
  width: `${number}%`;
  durationHeight: number;
  accentColor: string;
  accentSoftColor: string;
  completed: boolean;
  icon: ReactNode;
  title: string;
  timeLabel: string;
  textColor: string;
  collisionSlot?: number;
  accessibilityLabel: string;
  onPreview: () => void;
  onEdit: () => void;
}

const MIN_TOUCH_TARGET = 44;

export function TimelineMarker({
  top,
  left,
  width,
  durationHeight,
  accentColor,
  accentSoftColor,
  completed,
  icon,
  title,
  timeLabel,
  textColor,
  collisionSlot = 0,
  accessibilityLabel,
  onPreview,
  onEdit,
}: TimelineMarkerProps) {
  const gesture = useMemo(() => {
    const tap = Gesture.Tap()
      .maxDuration(280)
      .runOnJS(true)
      .onEnd((_, success) => {
        if (!success) return;
        void Haptics.selectionAsync();
        onPreview();
      });
    const hold = Gesture.LongPress()
      .minDuration(420)
      .maxDistance(18)
      .runOnJS(true)
      .onStart(() => {
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        onEdit();
      });
    return Gesture.Exclusive(hold, tap);
  }, [onEdit, onPreview]);

  const visualHeight = Math.max(38, Math.min(72, durationHeight));
  const slotOffset = collisionSlot === 0 ? 0 : collisionSlot === 1 ? 6 : -6;
  const markerTop = Math.max(0, top - 3);

  return (
    <GestureDetector gesture={gesture}>
      <View
        accessible
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityHint="Tap for a preview. Touch and hold to edit."
        onAccessibilityTap={onPreview}
        style={[
          styles.touchTarget,
          {
            top: markerTop,
            left,
            width,
            height: MIN_TOUCH_TARGET,
            transform: [{ translateX: slotOffset }],
          },
        ]}
      >
        <View
          pointerEvents="none"
          style={[
            styles.block,
            {
              backgroundColor: accentSoftColor,
              borderColor: accentColor,
              height: visualHeight,
              opacity: completed ? 0.72 : 1,
            },
          ]}
        >
          <View style={[styles.iconDisc, { borderColor: accentColor }]}>{icon}</View>
          <View style={styles.copy}>
            <Text numberOfLines={1} style={[styles.title, { color: textColor }]}>{title}</Text>
            <Text numberOfLines={1} style={[styles.time, { color: accentColor }]}>{timeLabel}</Text>
          </View>
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    position: 'absolute',
    zIndex: 4,
    paddingHorizontal: 3,
  },
  block: {
    width: '100%',
    borderWidth: 1,
    borderLeftWidth: 3,
    borderRadius: 10,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    gap: 8,
    overflow: 'hidden',
  },
  iconDisc: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  copy: {
    flex: 1,
    minWidth: 0,
    gap: 1,
  },
  title: {
    fontSize: 12,
    lineHeight: 15,
    fontFamily: 'Inter_700Bold',
    fontWeight: '700',
  },
  time: {
    fontSize: 10,
    lineHeight: 12,
    fontFamily: 'Inter_600SemiBold',
    fontWeight: '600',
    fontVariant: ['tabular-nums'],
  },
});
