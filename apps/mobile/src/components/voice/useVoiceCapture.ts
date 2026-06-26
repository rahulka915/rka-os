import { useEffect, useRef, useCallback, useState } from 'react';
import * as Speech from 'expo-speech-recognition';
import * as Haptics from 'expo-haptics';
import type { VoiceSession } from '../../types/voice';

export function useVoiceCapture() {
  const [session, setSession] = useState<VoiceSession>({
    isActive: false,
    transcript: '',
    isFinal: false,
    error: null,
    state: 'idle',
  });

  const sessionRef = useRef<VoiceSession>(session);

  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const startListening = useCallback(async () => {
    try {
      // Request mic permissions
      const result = await Speech.requestMicrophonePermissionsAsync();
      if (!result.granted) {
        setSession((prev) => ({
          ...prev,
          error: 'Microphone permission denied',
          state: 'error',
        }));
        return;
      }

      setSession((prev) => ({
        ...prev,
        isActive: true,
        state: 'listening',
        transcript: '',
        error: null,
      }));

      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Start speech recognition
      await Speech.startSpeechRecognitionAsync({
        language: 'en-US',
        maxAlternatives: 1,
        shouldReportPartialResults: true,
        onStart: () => {
          setSession((prev) => ({ ...prev, state: 'listening' }));
        },
        onResult: (result) => {
          const { transcript, isFinal } = result;
          setSession((prev) => ({
            ...prev,
            transcript,
            isFinal,
            state: isFinal ? 'processing' : 'listening',
          }));

          if (isFinal) {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
        },
        onError: (error) => {
          setSession((prev) => ({
            ...prev,
            error: error.message || 'Speech recognition failed',
            state: 'error',
          }));
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        },
      });
    } catch (error: any) {
      setSession((prev) => ({
        ...prev,
        error: error.message || 'Failed to start recording',
        state: 'error',
      }));
    }
  }, []);

  const stopListening = useCallback(async () => {
    try {
      await Speech.stopSpeechRecognitionAsync();
      setSession((prev) => ({
        ...prev,
        isActive: false,
        state: 'idle',
      }));
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch (error: any) {
      setSession((prev) => ({
        ...prev,
        error: error.message || 'Failed to stop recording',
        state: 'error',
      }));
    }
  }, []);

  const reset = useCallback(() => {
    setSession({
      isActive: false,
      transcript: '',
      isFinal: false,
      error: null,
      state: 'idle',
    });
  }, []);

  return { session, startListening, stopListening, reset };
}
