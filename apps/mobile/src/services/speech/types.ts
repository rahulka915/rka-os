export type PermissionResult = { granted: boolean; canAskAgain: boolean };
export type RecognitionOptions = { lang?: string; interimResults?: boolean };
export type FinalTranscript = { transcript: string };
export type RecognitionEvent =
  | { type: 'speechstart' }
  | { type: 'interim'; transcript: string }
  | { type: 'final'; transcript: string }
  | { type: 'audiolevel'; level: number }
  | { type: 'end' }
  | { type: 'error'; message: string };
export type RecognitionListener = (e: RecognitionEvent) => void;
export interface SpeechRecognitionAdapter {
  isSupported(): boolean;
  requestPermission(): Promise<PermissionResult>;
  start(options?: RecognitionOptions): Promise<void>;
  stop(): Promise<FinalTranscript>;
  cancel(): Promise<void>;
  subscribe(listener: RecognitionListener): () => void;
}
