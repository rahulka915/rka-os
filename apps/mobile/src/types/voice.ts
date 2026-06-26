export type VoiceState = 'idle' | 'listening' | 'processing' | 'error';

export interface VoiceTranscript {
  text: string;
  isFinal: boolean;
  confidence: number; // 0-1 (Phase 2+)
}

export interface VoiceContextType {
  context: 'inbox' | 'quick-add' | 'medication' | 'workout' | 'note';
  onSave: (transcript: string) => void;
}

export interface VoiceSession {
  isActive: boolean;
  transcript: string;
  isFinal: boolean;
  error: string | null;
  state: VoiceState;
}
