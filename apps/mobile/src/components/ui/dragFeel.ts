import { useMemo } from 'react';
import { Gesture } from 'react-native-gesture-handler';

// Reorder drags are vertical. On Home each row also has a horizontal
// SwipeableItem, and both are pan recognizers — so constrain the reorder pan
// to the Y axis and let it fail on decisive X movement. This is the library's
// documented way for the two gestures to coexist.
export function useVerticalDragGesture() {
  return useMemo(
    () => Gesture.Pan().activeOffsetY([-10, 10]).failOffsetX([-20, 20]),
    [],
  );
}
