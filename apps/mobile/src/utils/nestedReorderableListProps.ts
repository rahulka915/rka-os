import type { FlatListProps } from 'react-native';

// react-native-reorderable-list's NestedReorderableList is genuinely
// FlatList-based even with scrollable={false} — that prop only disables the
// list's own touch-scroll, not FlatList's viewport-based render windowing.
// Nested inside ScrollViewContainer (a plain ScrollView), FlatList has no
// way to know its true visible bounds are the outer container's, not its
// own — so its windowing math can decide rows are "off-screen" and skip
// rendering/re-rendering them, which is what produces stale/ghosted rows
// and gaps rather than a clean list. removeClippedSubviews is already
// forced off inside the library itself, so it isn't the lever available
// here; disabling the render window is. Safe for these lists since they're
// small (task/step/block counts, not thousands of rows) and bounded.
export function nonVirtualizedListProps(length: number): Pick<FlatListProps<unknown>, 'initialNumToRender' | 'maxToRenderPerBatch' | 'windowSize'> {
  const size = Math.max(length, 1);
  return {
    initialNumToRender: size,
    maxToRenderPerBatch: size,
    windowSize: size,
  };
}
