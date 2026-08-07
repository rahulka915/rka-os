import { StyleSheet, TouchableOpacity, type AccessibilityActionEvent } from 'react-native';
import { useReorderableDrag } from 'react-native-reorderable-list';
import { DragHandle } from '../../icons';

interface DragHandleButtonProps {
  color: string;
  /** VoiceOver has no way to perform the drag gesture — these back its accessibilityActions instead. */
  onMoveUp?: () => void;
  onMoveDown?: () => void;
}

// Shared grab affordance. `useReorderableDrag` may ONLY be called inside a
// list item component, which is why every row is now its own component —
// that also memoises rows so unrelated parent re-renders (Home ticks once a
// second) no longer re-render every row mid-drag.
//
// delayLongPress is set far below RN's 500ms default: this is a dedicated
// handle, not a whole-row gesture that needs a long-press to disambiguate
// from a tap — there's nothing else this touch target could mean. A near-zero
// delay is what makes a handle feel native (Reminders/Notes/Settings pick the
// row up the instant you touch the handle); the library's drag hook is still
// invoked through the sanctioned long-press codepath (see its README), just
// with the wait made imperceptible instead of removing the mechanism.
export function DragHandleButton({ color, onMoveUp, onMoveDown }: DragHandleButtonProps) {
  const drag = useReorderableDrag();

  const handleAccessibilityAction = (event: AccessibilityActionEvent) => {
    if (event.nativeEvent.actionName === 'increment') onMoveUp?.();
    else if (event.nativeEvent.actionName === 'decrement') onMoveDown?.();
  };

  return (
    <TouchableOpacity
      onLongPress={drag}
      delayLongPress={0}
      hitSlop={10}
      style={styles.handle}
      accessible
      accessibilityLabel="Reorder"
      accessibilityHint="Swipe up or down with one finger to move this item"
      accessibilityRole="adjustable"
      accessibilityActions={[
        { name: 'increment', label: 'Move up' },
        { name: 'decrement', label: 'Move down' },
      ]}
      onAccessibilityAction={handleAccessibilityAction}
    >
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
