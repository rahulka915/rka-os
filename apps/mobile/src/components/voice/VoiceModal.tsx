import React, { useEffect } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Animated,
} from 'react-native';
import { Microphone, X } from '../../icons';
import { useThemeContext } from '../../hooks/useThemeContext';
import { getThemeColors } from '../../theme';
import { useVoiceCapture } from './useVoiceCapture';
import type { VoiceContextType } from '../../types/voice';

interface VoiceModalProps {
  visible: boolean;
  onClose: () => void;
  context: VoiceContextType;
}

export function VoiceModal({ visible, onClose, context }: VoiceModalProps) {
  const { isDark } = useThemeContext();
  const palette = getThemeColors(isDark);
  const { session, startListening, stopListening, reset } = useVoiceCapture();
  const [editableTranscript, setEditableTranscript] = React.useState('');

  // Auto-start recording when modal opens
  useEffect(() => {
    if (visible) {
      startListening();
    } else {
      stopListening();
      reset();
    }
  }, [visible]);

  // Sync editable transcript with session
  useEffect(() => {
    setEditableTranscript(session.transcript);
  }, [session.transcript]);

  const handleSave = () => {
    if (editableTranscript.trim()) {
      context.onSave(editableTranscript);
      onClose();
      reset();
    }
  };

  const handleClose = () => {
    stopListening();
    reset();
    onClose();
  };

  const statusColor =
    session.state === 'listening'
      ? palette.primary
      : session.state === 'error'
        ? palette.error
        : palette.textSecondary;

  const pulseAnim = React.useRef(new Animated.Value(0)).current;

  React.useEffect(() => {
    if (session.state === 'listening') {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: false,
          }),
          Animated.timing(pulseAnim, {
            toValue: 0,
            duration: 800,
            useNativeDriver: false,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(0);
    }
  }, [session.state]);

  const pulseScale = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.3],
  });

  const pulseOpacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 0],
  });

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent>
      <View style={[s.container, { backgroundColor: 'rgba(0,0,0,0.7)' }]}>
        <View style={[s.sheet, { backgroundColor: palette.surface }]}>
          {/* Header */}
          <View style={s.header}>
            <Text style={[s.title, { color: palette.text }]}>Voice Capture</Text>
            <TouchableOpacity onPress={handleClose} hitSlop={12}>
              <X size={20} color={palette.text} />
            </TouchableOpacity>
          </View>

          {/* Mic button with pulse */}
          <View style={s.micContainer}>
            <Animated.View
              style={[
                s.micPulse,
                {
                  transform: [{ scale: pulseScale }],
                  opacity: pulseOpacity,
                  borderColor: statusColor,
                },
              ]}
            />
            <TouchableOpacity
              onPress={session.isActive ? stopListening : startListening}
              style={[
                s.micButton,
                {
                  backgroundColor: statusColor,
                },
              ]}
            >
              <Microphone size={28} color="#fff" strokeWidth={2} />
            </TouchableOpacity>
          </View>

          {/* Status text */}
          <Text style={[s.status, { color: statusColor }]}>
            {session.state === 'listening'
              ? 'Listening...'
              : session.state === 'processing'
                ? 'Processing...'
                : session.error
                  ? session.error
                  : 'Ready to record'}
          </Text>

          {/* Transcript display */}
          <View
            style={[
              s.transcriptBox,
              { backgroundColor: palette.fill, borderColor: palette.separator },
            ]}
          >
            <TextInput
              style={[s.transcript, { color: palette.text }]}
              placeholder="Your transcript will appear here..."
              placeholderTextColor={palette.textMuted}
              value={editableTranscript}
              onChangeText={setEditableTranscript}
              multiline
              editable={!session.isActive}
            />
          </View>

          {/* Actions */}
          <View style={s.actions}>
            <TouchableOpacity
              onPress={handleClose}
              style={[s.button, { backgroundColor: palette.fill }]}
            >
              <Text style={[s.buttonText, { color: palette.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleSave}
              disabled={!editableTranscript.trim() || session.isActive}
              style={[
                s.button,
                {
                  backgroundColor: palette.primary,
                  opacity: editableTranscript.trim() && !session.isActive ? 1 : 0.5,
                },
              ]}
            >
              <Text style={s.buttonText}>Save</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const s = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sheet: {
    width: '85%',
    borderRadius: 20,
    paddingVertical: 24,
    paddingHorizontal: 20,
    gap: 16,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  micContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    height: 140,
  },
  micPulse: {
    position: 'absolute',
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 2,
  },
  micButton: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  status: {
    textAlign: 'center',
    fontSize: 14,
    fontWeight: '600',
  },
  transcriptBox: {
    borderRadius: 12,
    borderWidth: 1,
    minHeight: 100,
    padding: 12,
  },
  transcript: {
    fontSize: 15,
    lineHeight: 22,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
  },
  button: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#fff',
  },
});
