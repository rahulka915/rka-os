import { useCallback, useState } from 'react';
import { runOnJS } from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';
import { reorderItems } from 'react-native-reorderable-list';
import { setManualOrder } from '../db/database';

// Light, not Rigid/Heavy: this is the per-swap "detent" that fires on every
// neighbour crossing, potentially many times per drag. Apple's own reorder
// surfaces (Home Screen, Reminders, Settings edit mode) use a light
// selection-style tick here, not an impact style — anything heavier reads as
// buzzy rather than "native" over a whole drag gesture.
function tickHaptic() {
  Haptics.selectionAsync();
}

// Shared drag-to-reorder behaviour for every manually-orderable list.
//
// The per-swap tick (onIndexChange) is the cue that makes reordering read as
// native: iOS fires a light selection tick every time the dragged row
// crosses a neighbour, not just on grab and drop.
//
// `isReordering` is exposed only to hide cosmetic overlays mid-drag; it has no
// bearing on layout. Row height must stay a pure function of the item.
export function useHapticReorder<T extends { id: string }>(
  listKey: string,
  items: T[],
  onReordered: (items: T[]) => void,
) {
  const [isReordering, setIsReordering] = useState(false);

  const beginReorder = useCallback(() => {
    setIsReordering(true);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }, []);

  // onDragStart, onDragEnd and onIndexChange are all invoked on the UI runtime
  // and MUST be worklets — passing a plain JS function throws "Tried to
  // synchronously call a Remote Function on the UI Runtime", which aborts the
  // drag and leaves the list's internal cell bookkeeping inconsistent (that
  // then surfaces as a keyExtractor crash on the next reorder). Anything
  // touching React state or Haptics has to be hopped back via runOnJS.
  // onReorder is the exception — it is a normal JS callback.
  const onDragStart = useCallback(() => {
    'worklet';
    runOnJS(beginReorder)();
  }, [beginReorder]);

  const onIndexChange = useCallback(() => {
    'worklet';
    runOnJS(tickHaptic)();
  }, []);

  const onReorder = useCallback(
    ({ from, to }: { from: number; to: number }) => {
      setIsReordering(false);
      const next = reorderItems(items, from, to);
      onReordered(next);
      setManualOrder(listKey, next.map((item) => item.id));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    },
    [items, listKey, onReordered],
  );

  // VoiceOver has no way to perform the drag gesture itself, so every
  // reorderable list needs a non-gesture equivalent — this backs the drag
  // handle's accessibilityActions (see DragHandleButton). Looks the item up
  // by id rather than taking an index so callers don't need to thread index
  // through their own row components just for this.
  const moveItem = useCallback(
    (itemId: string, direction: 'up' | 'down') => {
      const from = items.findIndex((item) => item.id === itemId);
      if (from === -1) return;
      const to = direction === 'up' ? from - 1 : from + 1;
      if (to < 0 || to >= items.length) return;
      const next = reorderItems(items, from, to);
      onReordered(next);
      setManualOrder(listKey, next.map((item) => item.id));
      Haptics.selectionAsync();
    },
    [items, listKey, onReordered],
  );

  return { isReordering, onDragStart, onIndexChange, onReorder, moveItem };
}
