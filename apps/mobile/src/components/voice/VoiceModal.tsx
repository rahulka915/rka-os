import type { VoiceContextType } from '../../types/voice';

interface VoiceModalProps {
  visible: boolean;
  onClose: () => void;
  context: VoiceContextType;
}

export function VoiceModal(props: VoiceModalProps) {
  const { visible } = props;
  if (!visible) return null;
  return null;
}
