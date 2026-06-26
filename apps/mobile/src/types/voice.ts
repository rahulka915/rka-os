import type { VoiceIntent } from '../utils/parseVoiceIntent';

export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  confidence: number; // 0-1
}

export interface VoiceContextType {
  context: 'inbox' | 'quick-add' | 'medication' | 'workout' | 'note';
  onSave: (transcript: string, intent?: VoiceIntent) => void;
}

export interface VoiceSession {
  isActive: boolean;
  transcript: string;
  isFinal: boolean;
  error: string | null;
  state: VoiceState;
  detectedIntent?: VoiceIntent;
}
