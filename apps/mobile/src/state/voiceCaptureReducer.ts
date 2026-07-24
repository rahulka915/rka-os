export type VoiceCaptureState =
  | 'idle' | 'opening' | 'requesting-permission' | 'listening'
  | 'speech-detected' | 'processing' | 'review' | 'saving' | 'saved'
  | 'no-speech' | 'permission-denied' | 'error';

export type VoiceErrorKind = 'unsupported' | 'transcription' | 'save' | 'unknown';

export type VoiceCaptureContext = {
  status: VoiceCaptureState;
  interimTranscript: string;
  transcript: string;
  audioLevel: number;
  errorKind?: VoiceErrorKind;
  errorMessage?: string;
};

export type VoiceAction =
  | { type: 'OPEN' }
  | { type: 'REQUEST_PERMISSION' }
  | { type: 'PERMISSION_GRANTED' }
  | { type: 'PERMISSION_DENIED' }
  | { type: 'UNSUPPORTED' }
  | { type: 'LISTENING_STARTED' }
  | { type: 'SPEECH_DETECTED' }
  | { type: 'INTERIM'; text: string }
  | { type: 'AUDIO_LEVEL'; level: number }
  | { type: 'STOP' }
  | { type: 'FINALIZED'; text: string }
  | { type: 'EDIT'; text: string }
  | { type: 'SAVE' }
  | { type: 'SAVE_SUCCESS' }
  | { type: 'SAVE_FAILURE'; message?: string }
  | { type: 'RECOGNITION_ERROR'; message?: string }
  | { type: 'RETRY' }
  | { type: 'CANCEL' }
  | { type: 'RESET' };

export const initialVoiceState: VoiceCaptureContext = {
  status: 'idle',
  interimTranscript: '',
  transcript: '',
  audioLevel: 0,
};

export function voiceCaptureReducer(
  s: VoiceCaptureContext,
  a: VoiceAction,
): VoiceCaptureContext {
  switch (a.type) {
    case 'OPEN':
      return {
        ...initialVoiceState,
        status: 'opening',
      };

    case 'REQUEST_PERMISSION':
      return { ...s, status: 'requesting-permission' };

    case 'PERMISSION_GRANTED':
      return { ...s, status: 'listening' };

    case 'PERMISSION_DENIED':
      return { ...s, status: 'permission-denied' };

    case 'UNSUPPORTED':
      return { ...s, status: 'error', errorKind: 'unsupported' };

    case 'LISTENING_STARTED':
      return { ...s, status: 'listening' };

    case 'SPEECH_DETECTED':
      if (s.status === 'listening' || s.status === 'speech-detected') {
        return { ...s, status: 'speech-detected' };
      }
      return s;

    case 'INTERIM': {
      const nextStatus =
        s.status === 'listening' ? 'speech-detected' : s.status;
      return { ...s, status: nextStatus as VoiceCaptureState, interimTranscript: a.text };
    }

    case 'AUDIO_LEVEL':
      return { ...s, audioLevel: Math.max(0, Math.min(1, a.level)) };

    case 'STOP':
      if (s.status === 'listening' || s.status === 'speech-detected') {
        return { ...s, status: 'processing' };
      }
      return s;

    case 'FINALIZED': {
      const trimmed = a.text.trim();
      if (!trimmed) {
        return { ...s, status: 'no-speech', interimTranscript: '' };
      }
      return {
        ...s,
        status: 'review',
        transcript: trimmed,
        interimTranscript: '',
      };
    }

    case 'EDIT':
      if (s.status === 'review') {
        return { ...s, transcript: a.text };
      }
      return s;

    case 'SAVE':
      if (s.status === 'review') {
        return { ...s, status: 'saving' };
      }
      return s;

    case 'SAVE_SUCCESS':
      return { ...s, status: 'saved' };

    case 'SAVE_FAILURE':
      return {
        ...s,
        status: 'error',
        errorKind: 'save',
        errorMessage: a.message,
        // transcript preserved — do not clear
      };

    case 'RECOGNITION_ERROR':
      return {
        ...s,
        status: 'error',
        errorKind: 'transcription',
        errorMessage: a.message,
        // interim/transcript preserved
      };

    case 'RETRY':
      if (s.errorKind === 'save') {
        return { ...s, status: 'saving' };
      }
      if (
        s.status === 'no-speech' ||
        s.status === 'permission-denied' ||
        s.status === 'error'
      ) {
        return { ...initialVoiceState, status: 'opening' };
      }
      return s;

    case 'CANCEL':
    case 'RESET':
      return { ...initialVoiceState };

    default:
      return s;
  }
}
