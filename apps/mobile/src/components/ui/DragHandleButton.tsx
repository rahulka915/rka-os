import { StyleSheet, TouchableOpacity } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { DragHandle } from '../../icons';

interface DragHandleButtonProps {
  color: string;
}

// Shared grab affordance. `useReorderableDrag` may ONLY be called inside a
// list item component, which is why every row is now its own component —
// that also memoises rows so unrelated parent re-renders (Home ticks once a
// second) no longer re-render every row mid-drag.
export function DragHandleButton({ color }: DragHandleButtonProps) {
  const drag = useReorderableDrag();
  return (
    <TouchableOpacity onLongPress={drag} delayLongPress={150} hitSlop={10} style={styles.handle}>
      <DragHandle size={18} color={color} strokeWidth={2} />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  handle: {
    width: 32,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
