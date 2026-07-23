import { useMemo, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
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
  collisionSlot?: number;
  accessibilityLabel: string;
  onPreview: () => void;
  onEdit: () => void;
}

const ICON_SIZE = 26;
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

  const visualHeight = Math.max(8, durationHeight);
  const slotOffset = collisionSlot === 0 ? 0 : collisionSlot === 1 ? 6 : -6;
  const markerTop = Math.max(0, top - ICON_SIZE / 2);
  const barTop = Math.max(0, top - markerTop);

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
            styles.durationBar,
            {
              top: barTop,
              height: visualHeight,
              backgroundColor: accentColor,
              opacity: completed ? 0.34 : 0.78,
            },
          ]}
        />
        <View
          pointerEvents="none"
          style={[
            styles.iconDisc,
            {
              backgroundColor: accentSoftColor,
              borderColor: accentColor,
              opacity: completed ? 0.72 : 1,
            },
          ]}
        >
          {icon}
          {completed ? (
            <View style={[styles.completionRing, { borderColor: accentColor }]} />
          ) : null}
        </View>
      </View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  touchTarget: {
    position: 'absolute',
    zIndex: 4,
    alignItems: 'center',
  },
  durationBar: {
    position: 'absolute',
    width: 2,
    borderRadius: 999,
  },
  iconDisc: {
    width: ICON_SIZE,
    height: ICON_SIZE,
    borderRadius: ICON_SIZE / 2,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  completionRing: {
    position: 'absolute',
    top: -4,
    right: -4,
    bottom: -4,
    left: -4,
    borderRadius: 17,
    borderWidth: 1.5,
    opacity: 0.62,
  },
});
