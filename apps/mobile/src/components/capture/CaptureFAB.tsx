import type { StyleProp, ViewStyle } from 'react-native';
import { FabControl } from '../fab/FabControl';
import { useItemComposer } from '../item-composer';
import type { ItemComposerContext } from '../item-composer/types';

interface CaptureFABProps {
  size?: number;
  captureContext?: Partial<ItemComposerContext>;
  onSaved?: () => void;
  onLongPress?: () => boolean | void;
  style?: StyleProp<ViewStyle>;
}

// Tap always opens the typing sheet directly — Speak lives inside that sheet
// (mic icon next to the title field) now, so there's no up-front Type/Speak
// choice here anymore.
export function CaptureFAB({
  size = 56,
  captureContext,
  onSaved,
  onLongPress,
  style,
}: CaptureFABProps) {
  const { openCapture } = useItemComposer();

  const handlePress = () => {
    openCapture({
      context: captureContext ?? { status: 'inbox' },
      onComplete: (r) => {
        if (r.action === 'saved') onSaved?.();
      },
    });
  };

  return (
    <FabControl
      size={size}
      onPress={handlePress}
      onLongPress={onLongPress}
      accessibilityLabel="Add capture"
      style={style}
      hitSlop={12}
    />
  );
}
