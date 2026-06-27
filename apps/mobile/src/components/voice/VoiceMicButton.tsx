import React, { useState } from 'react';
import { TouchableOpacity, StyleSheet } from 'react-native';
import { Microphone } from '../../icons';
import { getThemeColors } from '../../theme';
import { VoiceModal } from './VoiceModal';
import type { VoiceContextType } from '../../types/voice';

interface VoiceMicButtonProps {
  isDark: boolean;
  context: VoiceContextType;
  size?: 'small' | 'medium' | 'large';
}

export function VoiceMicButton({
  isDark,
  context,
  size = 'medium',
}: VoiceMicButtonProps) {
  const [voiceModalOpen, setVoiceModalOpen] = useState(false);
  const palette = getThemeColors(isDark);

  const sizeConfig = {
    small: { width: 28, height: 28, iconSize: 14 },
    medium: { width: 40, height: 40, iconSize: 18 },
    large: { width: 56, height: 56, iconSize: 24 },
  };

  const config = sizeConfig[size];

  return (
    <>
      <TouchableOpacity
        style={[
          s.button,
          {
            width: config.width,
            height: config.height,
            backgroundColor: palette.primary,
          },
        ]}
        onPress={() => setVoiceModalOpen(true)}
        activeOpacity={0.8}
      >
        <Microphone size={config.iconSize} color="#fff" strokeWidth={2} />
      </TouchableOpacity>

      <VoiceModal
        visible={voiceModalOpen}
        onClose={() => setVoiceModalOpen(false)}
        context={context}
      />
    </>
  );
}

const s = StyleSheet.create({
  button: {
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
