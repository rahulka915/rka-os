import { useCallback, useEffect, useReducer, useRef } from 'react';
import { getSpeechAdapter } from '../services/speech';
import { analyzeCapture } from '../services/capture/analyzeCapture';
import { saveVoiceCapture } from '../services/capture/inboxCapture';
import {
  voiceCaptureReducer,
  initialVoiceState,
  type VoiceCaptureContext,
} from '../state/voiceCaptureReducer';

export type UseVoiceCaptureReturn = {
  state: VoiceCaptureContext;
  open: () => Promise<void>;
  stop: () => Promise<void>;
  save: (text: string) => Promise<boolean>;
  edit: (text: string) => void;
  retry: () => Promise<void>;
  cancel: () => Promise<void>;
};

export function useVoiceCapture(): UseVoiceCaptureReturn {
  const [state, dispatch] = useReducer(voiceCaptureReducer, initialVoiceState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const adapter = useRef(getSpeechAdapter()).current;
  const openGuard = useRef(false);

  useEffect(() => {
    const unsubscribe = adapter.subscribe((event) => {
      switch (event.type) {
        case 'speechstart':
          dispatch({ type: 'SPEECH_DETECTED' });
          break;
        case 'interim':
          dispatch({ type: 'INTERIM', text: event.transcript });
          break;
        case 'final':
          dispatch({ type: 'FINALIZED', text: event.transcript });
          break;
        case 'audiolevel':
          dispatch({ type: 'AUDIO_LEVEL', level: event.level });
          break;
        case 'error':
          dispatch({ type: 'RECOGNITION_ERROR', message: event.message });
          break;
        case 'end': {
          const cur = stateRef.current;
          if (cur.status === 'listening' || cur.status === 'speech-detected') {
            const accumulated = cur.interimTranscript || cur.transcript;
            dispatch({ type: 'FINALIZED', text: accumulated });
          }
          break;
        }
      }
    });
    return () => {
      unsubscribe();
      adapter.cancel().catch(() => {});
    };
  }, [adapter]);

  const open = useCallback(async () => {
    if (openGuard.current) return;
    openGuard.current = true;
    dispatch({ type: 'OPEN' });
    try {
      if (!adapter.isSupported()) {
        dispatch({ type: 'UNSUPPORTED' });
        return;
      }
      dispatch({ type: 'REQUEST_PERMISSION' });
      const permission = await adapter.requestPermission();
      if (!permission.granted) {
        dispatch({ type: 'PERMISSION_DENIED' });
        return;
      }
      dispatch({ type: 'PERMISSION_GRANTED' });
      await adapter.start({ lang: 'en-US', interimResults: true });
      dispatch({ type: 'LISTENING_STARTED' });
    } catch (e) {
      dispatch({
        type: 'RECOGNITION_ERROR',
        message: e instanceof Error ? e.message : 'Failed to start recognition',
      });
    } finally {
      openGuard.current = false;
    }
  }, [adapter]);

  const stop = useCallback(async () => {
    dispatch({ type: 'STOP' });
    try {
      const result = await adapter.stop();
      const cur = stateRef.current;
      const fallback = cur.interimTranscript || cur.transcript;
      dispatch({ type: 'FINALIZED', text: result.transcript || fallback });
    } catch (e) {
      dispatch({
        type: 'RECOGNITION_ERROR',
        message: e instanceof Error ? e.message : 'Failed to stop recognition',
      });
    }
  }, [adapter]);

  const save = useCallback(async (text: string): Promise<boolean> => {
    dispatch({ type: 'SAVE' });
    try {
      await analyzeCapture(text);
      saveVoiceCapture(text);
      dispatch({ type: 'SAVE_SUCCESS' });
      return true;
    } catch (e) {
      dispatch({
        type: 'SAVE_FAILURE',
        message: e instanceof Error ? e.message : 'Failed to save',
      });
      return false;
    }
  }, []);

  const edit = useCallback((text: string) => {
    dispatch({ type: 'EDIT', text });
  }, []);

  const retry = useCallback(async () => {
    const cur = stateRef.current;
    if (cur.errorKind === 'save') {
      await save(cur.transcript);
    } else {
      await adapter.cancel().catch(() => {});
      await open();
    }
  }, [adapter, open, save]);

  const cancel = useCallback(async () => {
    await adapter.cancel().catch(() => {});
    dispatch({ type: 'CANCEL' });
  }, [adapter]);

  return { state, open, stop, save, edit, retry, cancel };
}
