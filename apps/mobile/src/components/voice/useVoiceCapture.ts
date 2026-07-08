import { useCallback, useState } from 'react';
import type { VoiceSession } from '../../types/voice';

export function useVoiceCapture() {
  const [session, setSession] = useState<VoiceSession>({
    isActive: false,
    transcript: '',
    isFinal: false,
    error: null,
    state: 'idle',
  });

  const startListening = useCallback(async () => {
    setSession({
      isActive: false,
      transcript: '',
      isFinal: false,
      error: 'Voice capture is disabled for now',
      state: 'idle',
    });
  }, []);

  const stopListening = useCallback(async () => {
    setSession((prev) => ({
      ...prev,
      isActive: false,
      state: 'idle',
    }));
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
