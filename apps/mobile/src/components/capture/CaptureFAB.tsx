import { useState } from 'react';
import type { StyleProp, ViewStyle } from 'react-native';
import { FabControl } from '../fab/FabControl';
import { CaptureMethodMenu } from './CaptureMethodMenu';
import { VoiceCaptureOverlay } from './VoiceCaptureOverlay';
import { useItemComposer } from '../item-composer';
import { useOverlayHost } from '../../hooks/useOverlayHost';
import type { ItemComposerContext } from '../item-composer/types';

interface CaptureFABProps {
  size?: number;
  captureContext?: Partial<ItemComposerContext>;
  onSaved?: () => void;
  onLongPress?: () => boolean | void;
  style?: StyleProp<ViewStyle>;
}

export function CaptureFAB({
  size = 56,
  captureContext,
  onSaved,
  onLongPress,
  style,
}: CaptureFABProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const { openCapture } = useItemComposer();
  const { setOverlay } = useOverlayHost();

  const closeVoiceOverlay = () => {
    setOverlay('capture-voice', null);
  };

  const openVoiceOverlay = () => {
    setOverlay(
      'capture-voice',
      <VoiceCaptureOverlay
        onSaved={() => {
          onSaved?.();
          closeVoiceOverlay();
        }}
        onClose={closeVoiceOverlay}
        onTypeInstead={() => {
          openCapture({
            context: captureContext ?? { status: 'inbox' },
            onComplete: (r) => {
              if (r.action === 'saved') onSaved?.();
            },
          });
        }}
      />,
    );
  };

  const handlePress = () => {
    setMenuOpen((prev) => !prev);
  };

  const handleSelectType = () => {
    setMenuOpen(false);
    openCapture({
      context: captureContext ?? { status: 'inbox' },
      onComplete: (r) => {
        if (r.action === 'saved') onSaved?.();
      },
    });
  };

  const handleSelectSpeak = () => {
    setMenuOpen(false);
    openVoiceOverlay();
  };

  const handleDismiss = () => {
    setMenuOpen(false);
  };

  return (
    <>
      <CaptureMethodMenu
        visible={menuOpen}
        onSelectType={handleSelectType}
        onSelectSpeak={handleSelectSpeak}
        onDismiss={handleDismiss}
      />
      <FabControl
        size={size}
        onPress={handlePress}
        onLongPress={onLongPress}
        accessibilityLabel="Add capture"
        style={style}
        hitSlop={12}
      />
    </>
  );
}
